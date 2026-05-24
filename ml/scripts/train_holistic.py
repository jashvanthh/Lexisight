#!/usr/bin/env python3
"""
LexiSight -- Holistic Temporal Model Trainer (V2)

Primary V2 target:
  - INCLUDE-only holistic manifest
  - signer-disjoint validation
  - stronger regularization against overfitting
  - class-balanced sampling
  - focal loss + cosine LR
  - CPU thread tuning for this machine
  - Optional hard-negative mining (--hard-neg-mining flag)

Usage:
  python ml/scripts/train_holistic.py
  python ml/scripts/train_holistic.py --config ml/configs/train_holistic_v2.yaml
  python ml/scripts/train_holistic.py --config ml/configs/train_holistic_v3.yaml --hard-neg-mining
"""

import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
import yaml
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from tensorflow.keras import Model, layers
from tensorflow.keras.callbacks import Callback, EarlyStopping, ModelCheckpoint

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

CONFUSION_PAIRS = [
    {"pair": ["BROTHER", "SISTER"], "severity": "high"},
    {"pair": ["BOY", "GIRL"], "severity": "medium"},
    {"pair": ["PAINT", "KEY"], "severity": "medium"},
    {"pair": ["PHOTOGRAPH", "PEN"], "severity": "medium"},
    {"pair": ["EXTRA", "COURT"], "severity": "high"},
    {"pair": ["PAPER", "LETTER"], "severity": "medium"},
    {"pair": ["SATURDAY", "BLACK"], "severity": "medium"},
    {"pair": ["CLOTHING", "DRESS"], "severity": "low"},
    {"pair": ["DEAD", "DIRTY"], "severity": "low"},
    {"pair": ["BATHROOM", "PENCIL"], "severity": "low"},
    {"pair": ["GIFT", "CARD"], "severity": "low"},
    {"pair": ["HARD", "GROUND"], "severity": "low"},
    {"pair": ["MONTH", "YEAR"], "severity": "medium"},
    {"pair": ["SAD", "TRAIN"], "severity": "low"},
    {"pair": ["SUMMER", "JOB"], "severity": "low"},
    {"pair": ["YOUNG", "COLOUR"], "severity": "low"},
    {"pair": ["COURT", "SECRETARY"], "severity": "low"},
    {"pair": ["BLUE", "OLD"], "severity": "low"},
    {"pair": ["SMALL LITTLE", "HEALTHY"], "severity": "low"},
    {"pair": ["TELEPHONE", "BAG"], "severity": "low"},
    {"pair": ["THANK YOU", "SCHOOL"], "severity": "low"},
    {"pair": ["THURSDAY", "PEN"], "severity": "low"},
]

PAIR_BOOST_HIGH = 3.0
PAIR_BOOST_MEDIUM = 2.0
PAIR_BOOST_LOW = 1.5

PAIR_LOSS_BOOST_MAP = {
    "high": PAIR_BOOST_HIGH,
    "medium": PAIR_BOOST_MEDIUM,
    "low": PAIR_BOOST_LOW,
}

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

sys.path.insert(0, str(BASE_DIR))

from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock

HOLISTIC_DIM = 225
SEQ_LEN = 30


def load_config(config_path):
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def set_global_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def configure_runtime(config):
    runtime_cfg = config.get("runtime", {})
    intra_threads = int(runtime_cfg.get("intra_op_threads", 0) or 0)
    inter_threads = int(runtime_cfg.get("inter_op_threads", 0) or 0)

    try:
        if intra_threads > 0:
            tf.config.threading.set_intra_op_parallelism_threads(intra_threads)
        if inter_threads > 0:
            tf.config.threading.set_inter_op_parallelism_threads(inter_threads)
    except RuntimeError:
        # TensorFlow threading can only be configured before runtime init.
        pass


class FocalCategoricalCrossentropy(tf.keras.losses.Loss):
    def __init__(self, gamma=1.5, label_smoothing=0.05, **kwargs):
        super().__init__(**kwargs)
        self.gamma = gamma
        self.label_smoothing = label_smoothing

    def call(self, y_true, y_pred):
        n_classes = tf.cast(tf.shape(y_true)[-1], tf.float32)
        y_true = y_true * (1.0 - self.label_smoothing) + self.label_smoothing / n_classes
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        ce = -y_true * tf.math.log(y_pred)
        weight = tf.pow(1.0 - y_pred, self.gamma)
        return tf.reduce_sum(weight * ce, axis=-1)


class CosineDecayCallback(Callback):
    def __init__(self, initial_lr, min_lr, total_epochs, warmup_epochs=5):
        super().__init__()
        self.initial_lr = initial_lr
        self.min_lr = min_lr
        self.total_epochs = total_epochs
        self.warmup_epochs = warmup_epochs

    def on_epoch_begin(self, epoch, logs=None):
        if epoch < self.warmup_epochs:
            lr = self.initial_lr * (epoch + 1) / max(self.warmup_epochs, 1)
        else:
            progress = (epoch - self.warmup_epochs) / max(self.total_epochs - self.warmup_epochs, 1)
            lr = self.min_lr + 0.5 * (self.initial_lr - self.min_lr) * (1 + np.cos(np.pi * progress))
        self.model.optimizer.learning_rate.assign(lr)


class ResumeStateCallback(Callback):
  def __init__(self, path: Path):
      super().__init__()
      self.path = path

  def on_epoch_end(self, epoch, logs=None):
      self.path.parent.mkdir(parents=True, exist_ok=True)
      with open(self.path, "w", encoding="utf-8") as f:
          json.dump({"initial_epoch": int(epoch) + 1}, f)


class OverfitDetector(Callback):
    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        train_acc = logs.get("accuracy", 0.0)
        val_acc = logs.get("val_accuracy", 0.0)
        train_loss = logs.get("loss", 0.0)
        val_loss = logs.get("val_loss", 0.0)
        lr = float(tf.keras.backend.get_value(self.model.optimizer.learning_rate))
        gap = train_acc - val_acc

        status = ""
        if gap > 0.10:
            status = " WARNING"
        if gap > 0.18:
            status = " CRITICAL"

        print(
            f"\n  [Epoch {epoch + 1}] "
            f"train_acc={train_acc:.4f} val_acc={val_acc:.4f} "
            f"train_loss={train_loss:.4f} val_loss={val_loss:.4f} "
            f"gap={gap:.4f} lr={lr:.2e}{status}"
        )


def build_holistic_temporal_model(
    n_classes,
    seq_len=SEQ_LEN,
    input_dim=HOLISTIC_DIM,
    d_model=192,
    num_layers=3,
    num_heads=6,
    d_ff=384,
    dropout=0.35,
    classifier_hidden=128,
):
    inp = layers.Input(shape=(seq_len, input_dim), name="holistic_sequence")
    x = layers.Dense(d_model, name="frame_projection")(inp)
    x = layers.Dropout(dropout)(x)
    x = PositionalEncoding(max_len=seq_len, d_model=d_model, name="pos_encoding")(x)

    for i in range(num_layers):
        x = TransformerEncoderBlock(
            d_model=d_model,
            num_heads=num_heads,
            d_ff=d_ff,
            dropout=dropout,
            name=f"transformer_block_{i}",
        )(x)

    x = layers.LayerNormalization(epsilon=1e-6, name="final_norm")(x)
    x = layers.GlobalAveragePooling1D(name="temporal_pool")(x)
    x = layers.Dense(classifier_hidden, activation="gelu", name="classifier_hidden")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(n_classes, activation="softmax", name="gesture_output")(x)
    return Model(inputs=inp, outputs=out, name="HolisticTemporalTransformer_v2")


def augment_holistic_batch(x_batch, config):
    aug = config.get("augmentation", {})
    noise_sigma = float(aug.get("gaussian_noise_sigma", 0.012))
    scale_min, scale_max = aug.get("scale_range", [0.88, 1.12])
    rotation_deg = float(aug.get("rotation_range_deg", 12))
    frame_dropout_max = int(aug.get("frame_dropout_count", 3))
    temporal_shift = int(aug.get("temporal_shift_frames", 2))
    zero_mask_prob = float(aug.get("landmark_dropout_prob", 0.15))

    batch = x_batch.copy()
    for i in range(batch.shape[0]):
        if np.random.rand() < 0.6:
            batch[i] += np.random.normal(0, noise_sigma, batch[i].shape).astype(np.float32)

        if np.random.rand() < 0.7:
            batch[i] *= np.random.uniform(scale_min, scale_max)

        if np.random.rand() < 0.6:
            angle = np.random.uniform(-rotation_deg, rotation_deg) * np.pi / 180.0
            c, s = np.cos(angle), np.sin(angle)
            coords = batch[i].reshape(SEQ_LEN, 75, 3)
            x_vals = coords[:, :, 0].copy()
            y_vals = coords[:, :, 1].copy()
            coords[:, :, 0] = x_vals * c - y_vals * s
            coords[:, :, 1] = x_vals * s + y_vals * c
            batch[i] = coords.reshape(SEQ_LEN, HOLISTIC_DIM)

        if np.random.rand() < 0.5:
            n_drop = np.random.randint(1, frame_dropout_max + 1)
            drop_idx = np.random.choice(SEQ_LEN, size=min(n_drop, SEQ_LEN), replace=False)
            batch[i, drop_idx] = 0.0

        if np.random.rand() < 0.3 and temporal_shift > 0:
            shift = np.random.randint(-temporal_shift, temporal_shift + 1)
            if shift != 0:
                batch[i] = np.roll(batch[i], shift, axis=0)
                if shift > 0:
                    batch[i, :shift] = 0.0
                else:
                    batch[i, shift:] = 0.0

        if np.random.rand() < zero_mask_prob:
            coords = batch[i].reshape(SEQ_LEN, 75, 3)
            landmark_idx = np.random.randint(0, 75)
            coords[:, landmark_idx, :] = 0.0
            batch[i] = coords.reshape(SEQ_LEN, HOLISTIC_DIM)

    return batch


class BalancedHolisticDataGen(tf.keras.utils.Sequence):
    def __init__(self, df, batch_size, n_classes, config, augment=False,
                 hard_neg_mining=False, lazy_load=False, desc=""):
        self.bs = batch_size
        self.n_classes = n_classes
        self.config = config
        self.augment = augment
        self.hard_neg_mining = hard_neg_mining and not lazy_load
        self.lazy_load = lazy_load
        self.y_ids = df["class_id"].to_numpy(dtype=np.int32)
        self.clip_paths = [
            ML_DIR / "data_processed" / str(p)
            for p in df["clip_path"]
        ]

        if lazy_load:
            print(f"[{desc}] Lazy-load mode: {len(df)} clips (read .npy per batch)")
            self.X = None
            n = len(df)
        else:
            print(f"[{desc}] Loading {len(df)} holistic clips into RAM...")
            self.X = np.zeros((len(df), SEQ_LEN, HOLISTIC_DIM), dtype=np.float32)
            loaded = 0
            for i, (_, row) in enumerate(df.iterrows()):
                if i > 0 and i % 1000 == 0:
                    print(f"  Loaded {i}/{len(df)}...")
                path = ML_DIR / "data_processed" / row["clip_path"]
                if path.exists():
                    try:
                        arr = np.load(path).astype(np.float32)
                        self.X[i] = arr.reshape(SEQ_LEN, HOLISTIC_DIM)
                        loaded += 1
                    except Exception:
                        pass
                self.y_ids[i] = int(row["class_id"])
            n = len(self.X)
            print(f"[{desc}] Loaded {loaded}/{len(df)}, hard_neg={self.hard_neg_mining}")

        self.class_indices = {}
        for idx, class_id in enumerate(self.y_ids):
            self.class_indices.setdefault(int(class_id), []).append(idx)

        if self.hard_neg_mining:
            self._apply_confusion_pair_oversample()
            n = len(self.X)

        self.balanced_indices = np.arange(n)
        self.on_epoch_end()

    def __len__(self):
        return int(np.ceil(len(self.balanced_indices) / self.bs))

    def _load_sample(self, sample_idx: int) -> np.ndarray:
        if not self.lazy_load:
            return self.X[sample_idx].copy()
        out = np.zeros((SEQ_LEN, HOLISTIC_DIM), dtype=np.float32)
        path = self.clip_paths[sample_idx]
        if path.exists():
            try:
                arr = np.load(path).astype(np.float32)
                out = arr.reshape(SEQ_LEN, HOLISTIC_DIM)
            except Exception:
                pass
        return out

    def __getitem__(self, index):
        start = index * self.bs
        end = min((index + 1) * self.bs, len(self.balanced_indices))
        idx = self.balanced_indices[start:end]

        x_batch = np.stack([self._load_sample(int(i)) for i in idx], axis=0)
        y_batch = np.zeros((len(idx), self.n_classes), dtype=np.float32)
        for j, sample_idx in enumerate(idx):
            y_batch[j, self.y_ids[sample_idx]] = 1.0

        if self.augment:
            x_batch = augment_holistic_batch(x_batch, self.config)
        return x_batch, y_batch

    def on_epoch_end(self):
        n = len(self.clip_paths) if self.lazy_load else len(self.X)
        if not self.augment:
            self.balanced_indices = np.arange(n)
            return

        max_per_class = max(len(v) for v in self.class_indices.values())
        balanced = []
        for indices in self.class_indices.values():
            sampled = np.random.choice(indices, size=max_per_class, replace=True)
            balanced.extend(sampled.tolist())
        self.balanced_indices = np.array(balanced, dtype=np.int32)
        np.random.shuffle(self.balanced_indices)

    def _apply_confusion_pair_oversample(self):
        """Oversample classes involved in confusion pairs to 3x median support."""
        pair_classes = {}
        for entry in CONFUSION_PAIRS:
            for cls in entry["pair"]:
                pair_classes.setdefault(cls, entry["severity"])

        class_counts = {cid: len(inds) for cid, inds in self.class_indices.items()}
        median_count = float(np.median(list(class_counts.values())))

        extra_X = []
        extra_y = []
        extra_indices = []

        for cls_name, severity in pair_classes.items():
            cls_id = None
            for cid, inds in self.class_indices.items():
                row_sample = self.y_ids[inds[0]] if len(inds) > 0 else None
                break
            for cid, inds in self.class_indices.items():
                if cid == cls_name or str(cid) == str(cls_name):
                    cls_id = cid
                    break
            if cls_id is None or cls_id not in self.class_indices:
                continue
            base_count = len(self.class_indices[cls_id])
            target = min(int(median_count * 3), base_count * 3)
            deficit = max(0, target - base_count)
            if deficit == 0:
                continue
            source_indices = self.class_indices[cls_id]
            for _ in range(deficit):
                src = np.random.choice(source_indices)
                extra_X.append(self.X[src].copy())
                extra_y.append(self.y_ids[src])
                extra_indices.append(len(self.X) + len(extra_X) - 1)

        if extra_X:
            extra_X_arr = np.array(extra_X, dtype=np.float32)
            extra_y_arr = np.array(extra_y, dtype=np.int32)
            self.X = np.concatenate([self.X, extra_X_arr], axis=0)
            self.y_ids = np.concatenate([self.y_ids, extra_y_arr], axis=0)

            for orig_idx, new_idx in enumerate(extra_indices):
                self.class_indices.setdefault(extra_y[orig_idx], []).append(new_idx)

            added = len(extra_X)
            print(f"  [HardNeg] Oversampled {added} clips for confusion-pair classes "
                  f"(median={median_count:.0f}, target={target})")


def make_split(df, seed):
    """Stratified split guaranteeing at least 1 val clip per class.

    For each class, reserve 1 clip for val unconditionally, then take
    an additional 15% of the remainder stratified. This ensures every
    class is represented in val regardless of signer count.
    """
    rng = np.random.default_rng(seed)
    train_rows, val_rows = [], []
    for cls, grp in df.groupby("class_id"):
        grp = grp.sample(frac=1, random_state=int(rng.integers(1 << 31)))
        n = len(grp)
        if n == 1:
            # only 1 clip — keep in train, nothing for val
            train_rows.append(grp)
            continue
        # always put 1 in val
        val_rows.append(grp.iloc[:1])
        rest = grp.iloc[1:]
        if len(rest) <= 1:
            train_rows.append(rest)
        else:
            # take 15% of the remainder for val (min 0 extra)
            n_extra = max(0, round(len(rest) * 0.15))
            val_rows.append(rest.iloc[:n_extra])
            train_rows.append(rest.iloc[n_extra:])
    train_df = pd.concat(train_rows).sample(frac=1, random_state=seed)
    val_df = pd.concat(val_rows).sample(frac=1, random_state=seed)
    return train_df.reset_index(drop=True), val_df.reset_index(drop=True)


def save_history(history, out_path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(history.history, f, indent=2)


def _read_log_text(log_path: Path) -> str:
    raw = log_path.read_bytes()
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16", errors="ignore")
    if raw[:4:2] == b"\x00\x00" or (len(raw) > 2 and raw[1:2] == b"\x00"):
        return raw.decode("utf-16-le", errors="ignore")
    return raw.decode("utf-8", errors="ignore")


def detect_initial_epoch(history_path: Path, log_path: Path | None = None) -> int:
    """Return next epoch index (0-based) from saved history or training log."""
    resume_path = history_path.parent / "verz_plus_resume.json"
    if resume_path.exists():
        with open(resume_path, encoding="utf-8") as f:
            data = json.load(f)
        epoch = int(data.get("initial_epoch", 0))
        if epoch > 0:
            return epoch
    if history_path.exists():
        with open(history_path, encoding="utf-8") as f:
            history = json.load(f)
        for key in ("loss", "accuracy", "val_loss", "val_accuracy"):
            if key in history and history[key]:
                return len(history[key])
    if log_path and log_path.exists():
        import re

        text = _read_log_text(log_path)
        epochs = [int(m) for m in re.findall(r"Epoch (\d+): val_accuracy", text)]
        if epochs:
            return max(epochs)
    return 0


def main():
    parser = argparse.ArgumentParser(description="LexiSight Holistic Temporal Trainer V2")
    parser.add_argument("--config", default="ml/configs/train_holistic_v2.yaml")
    parser.add_argument("--hard-neg-mining", action="store_true",
                        help="Enable confusion-pair oversampling and loss boosting")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument(
        "--lazy-load",
        action="store_true",
        help="Load .npy per batch instead of preloading all clips into RAM",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Load best checkpoint and continue from the last completed epoch",
    )
    parser.add_argument(
        "--initial-epoch",
        type=int,
        default=None,
        help="Override resume epoch index (0-based)",
    )
    args = parser.parse_args()

    config_path = BASE_DIR / args.config
    if not config_path.exists():
        print(f"Config not found: {config_path}")
        return

    config = load_config(config_path)
    set_global_seed(int(config.get("seed", 42)))
    configure_runtime(config)

    print("=" * 60)
    print("  HOLISTIC TEMPORAL MODEL TRAINING (V2)")
    if args.hard_neg_mining:
        print("  [HARD-NEG MINING ENABLED]")
        for entry in CONFUSION_PAIRS:
            print(f"    {entry['pair'][0]} <-> {entry['pair'][1]} ({entry['severity']})")
    print("=" * 60)

    manifest_path = BASE_DIR / config["data"]["manifest_path"]
    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}")
        return

    df = pd.read_csv(manifest_path)
    print(f"Manifest: {manifest_path}")
    print(f"Total clips: {len(df)}")
    print(f"Sources: {df['source'].value_counts().to_dict()}")

    class_counts = df["class"].value_counts()
    min_samples = int(config["data"].get("min_samples_per_class", 5))
    valid_classes = class_counts[class_counts >= min_samples].index.tolist()
    df = df[df["class"].isin(valid_classes)].copy()

    unique_classes = sorted(df["class"].unique())
    n_classes = len(unique_classes)
    class_to_id = {c: i for i, c in enumerate(unique_classes)}
    id_to_class = {str(i): c for c, i in class_to_id.items()}
    df["class_id"] = df["class"].map(class_to_id)

    filtered_counts = df["class"].value_counts()
    print(f"Filtered classes: {n_classes}")
    print(
        f"Samples/class after filter: min={int(filtered_counts.min())}, "
        f"median={float(filtered_counts.median()):.1f}, max={int(filtered_counts.max())}"
    )

    train_df, val_df = make_split(df, int(config.get("seed", 42)))
    print(f"Train: {len(train_df)} clips | signers={train_df['signer_id'].nunique()}")
    print(f"Val:   {len(val_df)} clips | signers={val_df['signer_id'].nunique()}")

    export_cfg = config["export"]
    label_map_path = BASE_DIR / export_cfg["label_map_path"]
    label_map_path.parent.mkdir(parents=True, exist_ok=True)
    with open(label_map_path, "w", encoding="utf-8") as f:
        json.dump(id_to_class, f, indent=2)
    print(f"Label map: {label_map_path}")

    model_cfg = config["model"]
    model = build_holistic_temporal_model(
        n_classes=n_classes,
        seq_len=int(model_cfg.get("input_frames", SEQ_LEN)),
        input_dim=int(model_cfg.get("input_features", HOLISTIC_DIM)),
        d_model=int(model_cfg.get("projection_dim", 192)),
        num_layers=int(model_cfg.get("num_transformer_layers", 3)),
        num_heads=int(model_cfg.get("num_attention_heads", 6)),
        d_ff=int(model_cfg.get("feedforward_dim", 384)),
        dropout=float(model_cfg.get("dropout", 0.35)),
        classifier_hidden=int(model_cfg.get("classifier_hidden", 128)),
    )

    training_cfg = config["training"]
    optimizer = tf.keras.optimizers.AdamW(
        learning_rate=float(training_cfg.get("learning_rate", 7e-4)),
        weight_decay=float(training_cfg.get("weight_decay", 0.01)),
    )
    model.compile(
        optimizer=optimizer,
        loss=FocalCategoricalCrossentropy(
            gamma=float(training_cfg.get("focal_gamma", 1.5)),
            label_smoothing=float(training_cfg.get("label_smoothing", 0.05)),
        ),
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top3_acc"),
            tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5_acc"),
        ],
    )
    model.summary()

    batch_size = int(training_cfg.get("batch_size", 32))
    train_gen = BalancedHolisticDataGen(
        train_df, batch_size, n_classes, config, augment=True,
        hard_neg_mining=args.hard_neg_mining, lazy_load=args.lazy_load, desc="Train",
    )
    val_gen = BalancedHolisticDataGen(
        val_df, batch_size, n_classes, config, augment=False,
        hard_neg_mining=False, lazy_load=args.lazy_load, desc="Val",
    )

    logs_dir = BASE_DIR / "training_logs"
    logs_dir.mkdir(exist_ok=True)
    model_path = logs_dir / export_cfg.get("checkpoint_name", "holistic_v2_best.keras")
    history_path = logs_dir / export_cfg.get("history_name", "holistic_v2_history.json")

    epochs = int(training_cfg.get("epochs", 120))
    callbacks = [
        EarlyStopping(
            monitor="val_accuracy",
            mode="max",
            patience=int(training_cfg.get("early_stopping_patience", 20)),
            restore_best_weights=True,
            verbose=1,
        ),
        ModelCheckpoint(
            str(model_path),
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
            verbose=1,
        ),
        CosineDecayCallback(
            initial_lr=float(training_cfg.get("learning_rate", 7e-4)),
            min_lr=float(training_cfg.get("min_learning_rate", 1e-6)),
            total_epochs=epochs,
            warmup_epochs=int(training_cfg.get("warmup_epochs", 5)),
        ),
        OverfitDetector(),
        ResumeStateCallback(logs_dir / "verz_plus_resume.json"),
    ]

    print("\n--- Starting V2 holistic training ---")
    print(f"Classes: {n_classes}")
    print(f"Batch size: {batch_size}")
    print(f"Epochs: {epochs}")
    print(f"Loss: focal + label smoothing")
    print(f"Regularization: dropout + augmentation + balanced sampling")
    print(f"Checkpoint: {model_path}")
    print()

    initial_epoch = 0
    if args.resume and model_path.exists():
        print(f"Loading weights: {model_path}")
        model.load_weights(str(model_path))
        initial_epoch = (
            args.initial_epoch
            if args.initial_epoch is not None
            else detect_initial_epoch(history_path, logs_dir / "verz_plus_train.log")
        )
        print(f"Resuming at epoch {initial_epoch + 1}/{epochs}")
    elif args.resume:
        print(f"Resume requested but no checkpoint at {model_path}; training from scratch.")

    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=epochs,
        initial_epoch=initial_epoch,
        callbacks=callbacks,
    )
    if history_path.exists() and initial_epoch > 0:
        with open(history_path, encoding="utf-8") as f:
            prior = json.load(f)
        merged = {k: prior.get(k, []) + history.history.get(k, []) for k in history.history}
        history.history = merged
    save_history(history, history_path)

    best_val = max(history.history.get("val_accuracy", [0.0]))
    best_loss = min(history.history.get("val_loss", [float("inf")]))
    print(f"\n{'=' * 60}")
    print(f"Best val_accuracy: {best_val:.4f} ({best_val * 100:.2f}%)")
    print(f"Best val_loss: {best_loss:.4f}")
    print(f"History saved: {history_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
