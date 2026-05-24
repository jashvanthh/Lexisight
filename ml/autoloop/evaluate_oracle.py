#!/usr/bin/env python3
"""AutoLoop Stage 2 — evaluate checkpoint on locked Emergency oracle signers."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, confusion_matrix, top_k_accuracy_score

BASE = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE))

from ml.autoloop._utils import load_config, load_json
from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock
from ml.scripts.train_temporal import normalize_skeleton
from ml.scripts.train_holistic import build_holistic_temporal_model

CUSTOM = {
    "PositionalEncoding": PositionalEncoding,
    "TransformerEncoderBlock": TransformerEncoderBlock,
}
SEQ = 30
HOLISTIC_FEAT = 225
HANDS_FEAT = 126


def load_label_map(ckpt: Path) -> dict[str, int]:
    """Load class->id from verZ+ label map if trained; else build from oracle manifest."""
    for candidate in (
        BASE / "public/model/label_map_verz_plus.json",
        BASE / "public/model/label_map_holistic_v2.json",
        BASE / "public/model/label_map.json",
    ):
        if candidate.exists():
            with open(candidate, encoding="utf-8") as f:
                raw = json.load(f)
            # files store id->class strings
            return {v.upper(): int(k) for k, v in raw.items()}
    return {}


def load_clips(
    manifest: pd.DataFrame,
    processed_root: Path,
    class_to_id: dict[str, int] | None = None,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Load .npy if exists else skip — extraction must run first."""
    X, y = [], []
    if class_to_id:
        label_map = class_to_id
        id_to_label = {i: c for c, i in label_map.items()}
        labels = [id_to_label[i] for i in range(len(id_to_label))]
    else:
        labels = sorted(manifest["class"].unique())
        label_map = {c: i for i, c in enumerate(labels)}
    for _, row in manifest.iterrows():
        npy = processed_root / row.get("clip_path", "")
        if not npy or not Path(npy).exists():
            stem = Path(row["video_path"]).stem
            guess = processed_root / row["source"] / row["class"] / f"{stem}.npy"
            if not guess.exists():
                continue
            npy = guess
        else:
            npy = Path(npy)
        try:
            d = np.load(npy).astype(np.float32)
            if d.shape == (SEQ, HOLISTIC_FEAT):
                X.append(d)
            elif d.shape == (SEQ, 2, 21, 3):
                d = normalize_skeleton(d)
                X.append(d.reshape(SEQ, HANDS_FEAT))
            else:
                X.append(d.reshape(SEQ, -1))
            cls = str(row["class"]).upper()
            if cls not in label_map:
                continue
            y.append(label_map[cls])
        except Exception:
            continue
    if class_to_id:
        return np.array(X, dtype=np.float32), np.array(y, dtype=int), labels
    id2l = {i: c for c, i in label_map.items()}
    return np.array(X, dtype=np.float32), np.array(y, dtype=int), [id2l[i] for i in range(len(id2l))]


def evaluate_model(model, X, y, labels, temperature=1.0):
    if len(X) == 0:
        return {"error": "no_clips_loaded", "n_samples": 0}
    probs = model.predict(X, batch_size=32, verbose=0)
    if temperature != 1.0:
        logits = np.log(np.clip(probs, 1e-12, 1))
        logits /= temperature
        logits -= logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs /= probs.sum(axis=1, keepdims=True)
    pred = probs.argmax(axis=1)
    top3 = top_k_accuracy_score(y, probs, k=3, labels=range(probs.shape[1]))
    top5 = top_k_accuracy_score(y, probs, k=5, labels=range(probs.shape[1]))
    conf = probs.max(axis=1)
    correct = pred == y
    ece_bins = 15
    ece = 0.0
    for i in range(ece_bins):
        lo, hi = i / ece_bins, (i + 1) / ece_bins
        mask = (conf > lo) & (conf <= hi)
        if not mask.any():
            continue
        ece += mask.mean() * abs(correct[mask].mean() - conf[mask].mean())

    cm = confusion_matrix(y, pred, labels=range(len(labels)))
    per_class = {}
    for i, lab in enumerate(labels):
        mask = y == i
        if not mask.any():
            continue
        per_class[lab] = {
            "support": int(mask.sum()),
            "accuracy": float((pred[mask] == i).mean()),
            "avg_confidence": float(conf[mask].mean()),
        }
    pairs = []
    for i in range(len(labels)):
        for j in range(len(labels)):
            if i != j and cm[i, j] > 0:
                pairs.append({"true": labels[i], "predicted": labels[j], "count": int(cm[i, j])})
    pairs.sort(key=lambda x: -x["count"])

    return {
        "generalization_score": float(accuracy_score(y, pred)),
        "top3_accuracy": float(top3),
        "top5_accuracy": float(top5),
        "ece": float(ece),
        "n_samples": int(len(y)),
        "n_classes": len(labels),
        "per_class": per_class,
        "top_confusions": pairs[:20],
        "confidence": {
            "mean": float(conf.mean()),
            "correct_mean": float(conf[correct].mean()) if correct.any() else None,
            "wrong_mean": float(conf[~correct].mean()) if (~correct).any() else None,
        },
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--checkpoint", default=None)
    p.add_argument("--manifest", default=None)
    p.add_argument("--output", default=None)
    args = p.parse_args()

    cfg = load_config()
    ckpt = Path(args.checkpoint or BASE / cfg["checkpoint"])
    default_manifest = BASE / "ml/data_processed/manifest_verz_plus_oracle.csv"
    manifest_path = Path(args.manifest or default_manifest)
    out = Path(args.output or BASE / cfg["paths"]["eval_output"])

    if not manifest_path.exists():
        print("Run: python ml/autoloop/build_manifest_verz.py first")
        return 1

    df = pd.read_csv(manifest_path)
    oracle = df[(df["is_oracle"] == 1) | (df["split"] == "oracle")]
    print(f"Oracle eval: {len(oracle)} videos, {oracle['class'].nunique()} classes")

    if not ckpt.exists():
        ckpt = BASE / "training_logs/temporal_best.keras"
        print(f"Using fallback checkpoint: {ckpt}")

    model = tf.keras.models.load_model(str(ckpt), custom_objects=CUSTOM, compile=False)
    proc = BASE / "ml/data_processed"
    class_to_id = load_label_map(ckpt)
    if class_to_id:
        print(f"Using trained label map ({len(class_to_id)} classes)")
    X, y, labels = load_clips(oracle, proc, class_to_id or None)

    if len(X) == 0:
        report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "checkpoint": str(ckpt),
            "error": "no_processed_clips",
            "note": "Run landmark extraction for oracle videos first.",
            "oracle_videos": len(oracle),
        }
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print("No .npy clips yet — wrote stub eval. Run extraction next.")
        return 0

    temp_path = BASE / "public/model/calibration_temperature.json"
    temp = 1.05
    if temp_path.exists():
        temp = float(load_json(temp_path).get("temperature", 1.05))

    metrics = evaluate_model(model, X, y, labels, temp)
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "checkpoint": str(ckpt.relative_to(BASE) if ckpt.is_relative_to(BASE) else ckpt),
        "oracle_signers": load_json(BASE / "ml/autoloop/oracle_signers.json")["signer_ids"],
        "metrics": metrics,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    gs = metrics.get("generalization_score", 0)
    print(f"Generalization Score: {gs*100:.2f}% | ECE: {metrics.get('ece',0):.4f}")
    print(f"Saved {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
