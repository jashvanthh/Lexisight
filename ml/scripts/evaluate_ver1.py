#!/usr/bin/env python3
"""
LexiSight Ver1 Evaluation — Temporal Landmark Transformer v1
=============================================================
Ver1 = word-mode temporal model (30×126 landmarks, ~263 ISL classes).
NOT the static fingerspelling "v1" from the ideology doc.

Checkpoint: training_logs/temporal_best.keras
Deployed:   public/model/tfjs_model/ (browser Word Mode [Ver1])

Usage:
  python ml/scripts/evaluate_ver1.py
  python ml/scripts/evaluate_ver1.py --checkpoint training_logs/temporal_v2_best.keras
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    top_k_accuracy_score,
)
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"
EVAL_DIR = ML_DIR / "eval"
LOGS_DIR = BASE_DIR / "training_logs"
SEQ_LEN = 126  # features per frame (flattened)
FRAMES = 30

sys.path.insert(0, str(BASE_DIR))

from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock
CUSTOM_OBJECTS = {
    "PositionalEncoding": PositionalEncoding,
    "TransformerEncoderBlock": TransformerEncoderBlock,
}


def load_label_map(path: Path) -> dict[int, str]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {int(k): v for k, v in raw.items()}


def build_class_maps(df: pd.DataFrame, label_map: dict[int, str]) -> tuple[pd.DataFrame, dict[str, int], dict[int, str]]:
    """Keep only classes present in the trained label map."""
    allowed = {v for v in label_map.values()}
    df = df[df["class"].isin(allowed)].copy()
    class_to_id = {name: idx for idx, name in label_map.items()}
    id_to_class = label_map
    df["class_id"] = df["class"].map(class_to_id)
    df = df.dropna(subset=["class_id"])
    df["class_id"] = df["class_id"].astype(int)
    return df, class_to_id, id_to_class


def make_splits(df: pd.DataFrame, seed: int, val_ratio: float = 0.2):
    n_signers = df["signer_id"].nunique()
    if n_signers <= 1:
        train_df, val_df = train_test_split(
            df, test_size=val_ratio, stratify=df["class_id"], random_state=seed
        )
        split_mode = "stratified_random (single signer — NOT signer-disjoint)"
    else:
        sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
        train_idx, val_idx = next(sgkf.split(df, df["class_id"], df["signer_id"]))
        train_df = df.iloc[train_idx].copy()
        val_df = df.iloc[val_idx].copy()
        split_mode = "signer_disjoint StratifiedGroupKFold"
    return train_df, val_df, split_mode, n_signers


def load_batch(df: pd.DataFrame, desc: str) -> tuple[np.ndarray, np.ndarray]:
    """
  Load clips as (30, 126) flattened tensors.

  Ver1 (temporal_best.keras) was trained on pre-processed .npy landmarks
  via train_video_only / train_video_v2 — reshape only, no extra
  normalize_skeleton pass. Applying train_temporal's skeleton normalizer
  drops accuracy from ~81% to ~4%.
    """
    x = np.zeros((len(df), FRAMES, SEQ_LEN), dtype=np.float32)
    y = df["class_id"].to_numpy(dtype=np.int32)
    missing = 0
    for i, (_, row) in enumerate(df.iterrows()):
        p = ML_DIR / "data_processed" / row["clip_path"]
        if not p.exists():
            missing += 1
            continue
        try:
            data = np.load(p).astype(np.float32)
            x[i] = data.reshape(FRAMES, -1)
        except Exception:
            missing += 1
    print(f"  [{desc}] loaded {len(df) - missing}/{len(df)} clips ({missing} missing/failed)")
    return x, y


def calibrated_probs(probs: np.ndarray, temperature: float) -> np.ndarray:
    if temperature == 1.0:
        return probs
    logits = np.log(np.clip(probs, 1e-12, 1.0)) / temperature
    logits -= logits.max(axis=1, keepdims=True)
    exp = np.exp(logits)
    return exp / exp.sum(axis=1, keepdims=True)


def ece_score(y_true: np.ndarray, y_pred: np.ndarray, confidences: np.ndarray, n_bins: int = 15) -> float:
    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total = len(y_true)
    for i in range(n_bins):
        mask = (confidences > bins[i]) & (confidences <= bins[i + 1])
        if not mask.any():
            continue
        acc = (y_true[mask] == y_pred[mask]).mean()
        conf = confidences[mask].mean()
        ece += (mask.sum() / total) * abs(acc - conf)
    return float(ece)


def per_class_metrics(y_true, y_pred, probs, id_to_class, n_classes):
    prec, rec, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=range(n_classes), zero_division=0
    )
    rows = []
    for cid in range(n_classes):
        mask = y_true == cid
        if not mask.any():
            continue
        conf = probs[mask, cid] if mask.any() else np.array([])
        rows.append(
            {
                "class": id_to_class[cid],
                "support": int(support[cid].item() if hasattr(support[cid], "item") else support[cid]),
                "accuracy": float((y_pred[mask] == cid).mean()),
                "precision": float(prec[cid]),
                "recall": float(rec[cid]),
                "f1": float(f1[cid]),
                "avg_confidence": float(conf.mean()) if len(conf) else None,
            }
        )
    return rows


def top_confusions(cm: np.ndarray, id_to_class: dict[int, str], k: int = 15):
    pairs = []
    n = cm.shape[0]
    for i in range(n):
        for j in range(n):
            if i != j and cm[i, j] > 0:
                pairs.append((int(cm[i, j]), id_to_class[i], id_to_class[j]))
    pairs.sort(reverse=True)
    return [{"count": c, "true": t, "predicted": p} for c, t, p in pairs[:k]]


def evaluate_split(name, model, x, y, id_to_class, temperature, batch_size):
    t0 = time.perf_counter()
    raw_probs = model.predict(x, batch_size=batch_size, verbose=0)
    infer_ms = (time.perf_counter() - t0) / max(len(x), 1) * 1000
    probs = calibrated_probs(raw_probs, temperature)
    y_pred = probs.argmax(axis=1)
    conf = probs.max(axis=1)
    n_classes = probs.shape[1]
    labels = list(range(n_classes))

    top1 = accuracy_score(y, y_pred)
    top3 = top_k_accuracy_score(y, probs, k=3, labels=labels)
    top5 = top_k_accuracy_score(y, probs, k=5, labels=labels)
    macro_f1 = f1_score(y, y_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y, y_pred, average="weighted", zero_division=0)
    ece = ece_score(y, y_pred, conf)

    correct_mask = y_pred == y
    margin = np.sort(probs, axis=1)[:, -1] - np.sort(probs, axis=1)[:, -2]

    per_class = per_class_metrics(y, y_pred, probs, id_to_class, n_classes)
    accs = [r["accuracy"] for r in per_class if r["support"] > 0]
    below_85 = [r["class"] for r in per_class if r["accuracy"] < 0.85 and r["support"] >= 1]
    below_50 = [r["class"] for r in per_class if r["accuracy"] < 0.50 and r["support"] >= 1]

    return {
        "split": name,
        "n_samples": int(len(y)),
        "top1_accuracy": float(top1),
        "top3_accuracy": float(top3),
        "top5_accuracy": float(top5),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "ece": ece,
        "inference_ms_per_sample": float(infer_ms),
        "confidence": {
            "mean": float(conf.mean()),
            "correct_mean": float(conf[correct_mask].mean()) if correct_mask.any() else None,
            "wrong_mean": float(conf[~correct_mask].mean()) if (~correct_mask).any() else None,
        },
        "margin": {
            "mean": float(margin.mean()),
            "correct_mean": float(margin[correct_mask].mean()) if correct_mask.any() else None,
            "wrong_mean": float(margin[~correct_mask].mean()) if (~correct_mask).any() else None,
        },
        "per_class_summary": {
            "classes_evaluated": len(accs),
            "median_accuracy": float(np.median(accs)) if accs else None,
            "classes_below_85pct": below_85,
            "classes_below_50pct": below_50,
            "count_below_85": len(below_85),
            "count_below_50": len(below_50),
        },
        "per_class": per_class,
        "top_confusions": top_confusions(confusion_matrix(y, y_pred, labels=labels), id_to_class),
        "y_true": y,
        "y_pred": y_pred,
        "probs": probs,
    }


def normalize_word_label(name: str) -> str:
    """Match manifest class names to INCLUDE folder labels."""
    s = re.sub(r"^\d+\.\s*", "", name.strip(), flags=re.I)
    return s.upper().replace("_", " ")


def load_include_category_map() -> dict[str, str]:
    """Map each ISL word → INCLUDE_FULL category folder (Adjectives, Greetings, …)."""
    root = BASE_DIR / "Datasets" / "INCLUDE_FULL DATASET"
    mapping: dict[str, str] = {}
    if not root.exists():
        return mapping
    for cat_dir in root.iterdir():
        if not cat_dir.is_dir():
            continue
        cat_name = cat_dir.name.replace("_", " ")
        for word_dir in cat_dir.iterdir():
            if word_dir.is_dir():
                mapping[normalize_word_label(word_dir.name)] = cat_name
    return mapping


def build_dataset_inventory(
    manifest: pd.DataFrame,
    eval_df: pd.DataFrame,
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    label_map: dict[int, str],
    val_per_class: list[dict],
) -> dict:
    """Document which corpora were used, excluded, and the full evaluated vocabulary."""
    manifest_counts = manifest["source"].value_counts().to_dict()
    acc_by_class = {r["class"]: r for r in val_per_class}
    categories = load_include_category_map()

    train_counts = train_df["class"].value_counts().to_dict()
    val_counts = val_df["class"].value_counts().to_dict()

    vocabulary = []
    for idx in sorted(label_map.keys()):
        word = label_map[idx]
        norm = normalize_word_label(word)
        row = {
            "class_id": idx,
            "word": word,
            "category": categories.get(norm, categories.get(word, "Unknown")),
            "total_clips": int((eval_df["class"] == word).sum()),
            "train_clips": int(train_counts.get(word, 0)),
            "val_clips": int(val_counts.get(word, 0)),
            "val_accuracy": acc_by_class.get(word, {}).get("accuracy"),
            "val_f1": acc_by_class.get(word, {}).get("f1"),
        }
        vocabulary.append(row)

    by_category: dict[str, list] = defaultdict(list)
    for row in vocabulary:
        by_category[row["category"]].append(row)

    clip_counts = eval_df["class"].value_counts()
    return {
        "manifest_totals": manifest_counts,
        "used": {
            "id": "include",
            "display_name": "INCLUDE_FULL",
            "description": (
                "Indian Sign Language videos from IIT Madras / AI4Bharat INCLUDE corpus "
                "(Sridhar et al., 2020). Landmark sequences extracted with MediaPipe Hands, "
                "30 frames per clip, stored as .npy tensors."
            ),
            "raw_path": "Datasets/INCLUDE_FULL DATASET",
            "processed_path": "ml/data_processed/include/",
            "clips_in_manifest": int(manifest_counts.get("include", 0)),
            "clips_evaluated": len(eval_df),
            "classes": len(vocabulary),
            "signer_ids": sorted(eval_df["signer_id"].dropna().unique().tolist()),
            "clips_per_class": {
                "min": int(clip_counts.min()),
                "max": int(clip_counts.max()),
                "mean": round(float(clip_counts.mean()), 1),
                "median": float(clip_counts.median()),
            },
        },
        "excluded": [
            {
                "id": "static_images",
                "display_name": "ISL static image sets (A–Z, 0–9)",
                "clips_in_manifest": int(manifest_counts.get("static_images", 0)),
                "reason": "Used for the separate static/fingerspelling model, not Ver1 temporal words.",
            },
            {
                "id": "cislr",
                "display_name": "CISLR v1.5-a",
                "clips_in_manifest": int(manifest_counts.get("cislr", 0)),
                "reason": "Not present in current manifest; not trained into this Ver1 checkpoint.",
            },
            {
                "id": "isl_daily_words",
                "display_name": "ISL_Daily_Words",
                "clips_in_manifest": 0,
                "reason": "Not merged into this build (ideology: prioritize when multi-signer depth exists).",
            },
            {
                "id": "isl_emergency",
                "display_name": "ISL_Emergency",
                "clips_in_manifest": 0,
                "reason": "Not merged into this build.",
            },
        ],
        "vocabulary": vocabulary,
        "by_category": {k: v for k, v in sorted(by_category.items())},
        "category_counts": {k: len(v) for k, v in sorted(by_category.items())},
    }


def plot_confusion(y_true, y_pred, id_to_class, out_path: Path, top_n: int = 40):
    labels_ids = sorted(set(y_true) | set(y_pred))
    labels = [id_to_class[i] for i in labels_ids]
    cm = confusion_matrix(y_true, y_pred, labels=labels_ids)
    freq = cm.sum(axis=1)
    order = np.argsort(freq)[::-1][:top_n]
    cm_sub = cm[np.ix_(order, order)]
    lab_sub = [labels[i] for i in order]
    fig, ax = plt.subplots(figsize=(14, 12))
    sns.heatmap(cm_sub, xticklabels=lab_sub, yticklabels=lab_sub, cmap="Blues", ax=ax)
    ax.set_title("Ver1 Temporal — Validation Confusion (top 40 classes by support)")
    plt.xticks(rotation=90, fontsize=7)
    plt.yticks(rotation=0, fontsize=7)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def write_markdown(report: dict, md_path: Path):
    m = report["metrics"]
    val = m["validation"]
    train = m["train"]
    inv = report.get("data_inventory", {})
    used = inv.get("used", {})
    lines = [
        "# LexiSight Ver1 Evaluation Report",
        "",
        f"**Generated:** {report['timestamp']}",
        f"**Model:** {report['model']['name']} (`{report['model']['checkpoint']}`)",
        f"**Architecture:** Temporal Landmark Transformer v1 — input `(30, 126)`, **{report['model']['n_classes']}** classes",
        f"**Deployed as:** Word Mode `[Ver1]` → `public/model/tfjs_model/`",
        f"**Label map:** `public/model/label_map.json`",
        "",
        "> **Ver1** = temporal **word** model (263 ISL signs). **v1** in the ideology doc = static fingerspelling (A–Z, 0–9) — different model.",
        "",
        "## Data sources",
        "",
        "### Used for training & evaluation",
        "",
        f"| Property | Value |",
        f"|----------|-------|",
        f"| Dataset | **{used.get('display_name', 'INCLUDE_FULL')}** (`{used.get('id', 'include')}`) |",
        f"| Description | {used.get('description', '')} |",
        f"| Raw videos | `{used.get('raw_path', '—')}` |",
        f"| Processed landmarks | `{used.get('processed_path', '—')}` |",
        f"| Clips in manifest | {used.get('clips_in_manifest', 0):,} |",
        f"| Clips evaluated (this run) | {used.get('clips_evaluated', 0):,} |",
        f"| Word classes | **{used.get('classes', 0)}** |",
        f"| Signer IDs | {', '.join(used.get('signer_ids', [])) or '—'} |",
        f"| Clips per class (min / mean / max) | {used.get('clips_per_class', {}).get('min', '—')} / {used.get('clips_per_class', {}).get('mean', '—')} / {used.get('clips_per_class', {}).get('max', '—')} |",
        "",
        "### Not used in Ver1 (present elsewhere in repo / ideology)",
        "",
        "| Dataset | Clips in manifest | Why excluded |",
        "|---------|-------------------|--------------|",
    ]
    for ex in inv.get("excluded", []):
        lines.append(
            f"| {ex.get('display_name', ex.get('id'))} | {ex.get('clips_in_manifest', 0):,} | {ex.get('reason', '')} |"
        )

    if inv.get("manifest_totals"):
        lines += [
            "",
            "### Full manifest inventory (all sources)",
            "",
            "| Source | Clip count |",
            "|--------|------------|",
        ]
        for src, cnt in sorted(inv["manifest_totals"].items(), key=lambda x: -x[1]):
            lines.append(f"| `{src}` | {cnt:,} |")

    lines += [
        "",
        "## Train / validation split",
        "",
        f"| Field | Value |",
        f"|-------|-------|",
        f"| Split method | {report['dataset']['split_method']} |",
        f"| Random seed | {report['dataset']['seed']} |",
        f"| Validation ratio | {report['dataset']['val_ratio']:.0%} |",
        f"| Train clips | {train['n_samples']:,} |",
        f"| Validation clips | {val['n_samples']:,} |",
        f"| Preprocessing | {report.get('preprocessing', 'reshape only')} |",
        "",
        "## Vocabulary — 263 ISL words",
        "",
        "All words below are in `label_map.json` and the model softmax. "
        "Categories come from INCLUDE_FULL folder structure (`Datasets/INCLUDE_FULL DATASET/<Category>/<Word>/`).",
        "",
    ]

    if inv.get("category_counts"):
        lines += [
            "### Words per INCLUDE category",
            "",
            "| Category | # words |",
            "|----------|---------|",
        ]
        for cat, n in sorted(inv["category_counts"].items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"| {cat} | {n} |")
        lines.append("")

    lines += [
        "### Full word list by category",
        "",
    ]
    for cat, rows in inv.get("by_category", {}).items():
        lines.append(f"#### {cat} ({len(rows)} words)")
        lines.append("")
        word_bits = []
        for r in sorted(rows, key=lambda x: x["word"]):
            acc = r.get("val_accuracy")
            acc_s = f", val {acc * 100:.0f}%" if acc is not None else ""
            word_bits.append(
                f"**{r['word']}** ({r['total_clips']} clips{acc_s})"
            )
        # wrap ~8 words per line for readability
        for i in range(0, len(word_bits), 6):
            lines.append("- " + " · ".join(word_bits[i : i + 6]))
        lines.append("")

    lines += [
        "### Vocabulary table (with validation metrics)",
        "",
        "Detailed per-class CSV: `ml/eval/ver1_per_class.csv`",
        "",
        "| # | Word | Category | Total | Train | Val | Val acc |",
        "|---|------|----------|-------|-------|-----|---------|",
    ]
    for r in inv.get("vocabulary", []):
        acc = r.get("val_accuracy")
        acc_s = f"{acc * 100:.1f}%" if acc is not None else "—"
        lines.append(
            f"| {r['class_id']} | {r['word']} | {r['category']} | {r['total_clips']} | "
            f"{r['train_clips']} | {r['val_clips']} | {acc_s} |"
        )

    lines += [
        "",
        "## Overall metrics",
        "",
        "| Split | Top-1 | Top-3 | Top-5 | Macro F1 | ECE | ms/sample |",
        "|-------|-------|-------|-------|----------|-----|-----------|",
        f"| Validation | {val['top1_accuracy']*100:.2f}% | {val['top3_accuracy']*100:.2f}% | {val['top5_accuracy']*100:.2f}% | {val['macro_f1']:.3f} | {val['ece']:.4f} | {val['inference_ms_per_sample']:.1f} |",
        f"| Train (overfit check) | {train['top1_accuracy']*100:.2f}% | {train['top3_accuracy']*100:.2f}% | {train['top5_accuracy']*100:.2f}% | {train['macro_f1']:.3f} | {train['ece']:.4f} | {train['inference_ms_per_sample']:.1f} |",
        "",
        f"**Train–val gap (top-1):** {(train['top1_accuracy'] - val['top1_accuracy'])*100:.2f} pp",
        "",
        "## Calibration",
        "",
        f"- Temperature applied: **{report['calibration']['temperature']}**",
        f"- Mean confidence (val): {val['confidence']['mean']:.3f} (correct {val['confidence']['correct_mean']:.3f}, wrong {val['confidence']['wrong_mean']:.3f})",
        "",
        "## Per-class health (validation)",
        "",
        f"- Classes below 85% accuracy: **{val['per_class_summary']['count_below_85']}**",
        f"- Classes below 50% accuracy: **{val['per_class_summary']['count_below_50']}**",
        f"- Median per-class accuracy: **{val['per_class_summary']['median_accuracy']*100:.1f}%**" if val['per_class_summary']['median_accuracy'] else "",
        "",
        "### Worst 15 classes",
        "",
        "| Class | Acc | Support | Top confusion |",
        "|-------|-----|---------|---------------|",
    ]
    worst = sorted(
        [r for r in val["per_class"] if r["support"] > 0],
        key=lambda r: r["accuracy"],
    )[:15]
    conf_map = {c["true"]: c["predicted"] for c in val["top_confusions"]}
    for r in worst:
        conf = conf_map.get(r["class"], "—")
        lines.append(f"| {r['class']} | {r['accuracy']*100:.1f}% | {r['support']} | {conf} |")

    lines += [
        "",
        "### Top 15 confusion pairs",
        "",
        "| Count | True | Predicted |",
        "|-------|------|-----------|",
    ]
    for c in val["top_confusions"]:
        lines.append(f"| {c['count']} | {c['true']} | {c['predicted']} |")

    lines += [
        "",
        "## Honest limitations",
        "",
    ]
    for note in report["limitations"]:
        lines.append(f"- {note}")

    lines += [
        "",
        "## Verdict",
        "",
        f"**{report['verdict']}** — {report['verdict_detail']}",
        "",
        f"Artifacts: `{report['artifacts']['json']}`, confusion matrix PNG, per-class CSV.",
    ]
    md_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Evaluate LexiSight Ver1 temporal model")
    parser.add_argument("--checkpoint", default=str(LOGS_DIR / "temporal_best.keras"))
    parser.add_argument("--label-map", default=str(BASE_DIR / "public" / "model" / "label_map.json"))
    parser.add_argument("--temperature", type=float, default=None)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--val-ratio", type=float, default=0.2)
    args = parser.parse_args()

    checkpoint = Path(args.checkpoint)
    label_map_path = Path(args.label_map)
    calib_path = BASE_DIR / "public" / "model" / "calibration_temperature.json"
    temperature = args.temperature
    if temperature is None and calib_path.exists():
        with open(calib_path, encoding="utf-8") as f:
            temperature = float(json.load(f).get("temperature", 1.0))
    if temperature is None:
        temperature = 1.0

    print("=" * 60)
    print("  LexiSight Ver1 Evaluation (Temporal Transformer)")
    print("=" * 60)

    label_map = load_label_map(label_map_path)
    n_classes = len(label_map)

    print(f"\nLoading checkpoint: {checkpoint}")
    model = tf.keras.models.load_model(
        str(checkpoint), custom_objects=CUSTOM_OBJECTS, compile=False
    )
    assert model.output_shape[-1] == n_classes, (
        f"Label map has {n_classes} classes but model outputs {model.output_shape[-1]}"
    )

    manifest = pd.read_csv(ML_DIR / "data_processed" / "manifest.csv")
    df = manifest[manifest["source"] == "include"].copy()
    manifest_full = manifest
    df, _, id_to_class = build_class_maps(df, label_map)

    train_df, val_df, split_mode, n_signers = make_splits(df, args.seed, args.val_ratio)

    print(f"\nDataset: {len(df)} INCLUDE clips, {df['class'].nunique()} classes")
    print(f"Signers: {n_signers} | Split: {split_mode}")
    print(f"Train: {len(train_df)} | Val: {len(val_df)}")
    print("\nLoading tensors (reshape-only — matches Ver1 training pipeline)...")
    x_train, y_train = load_batch(train_df, "train")
    x_val, y_val = load_batch(val_df, "val")

    print("\nRunning inference...")
    train_metrics = evaluate_split(
        "train", model, x_train, y_train, id_to_class, temperature, args.batch_size
    )
    val_metrics = evaluate_split(
        "validation", model, x_val, y_val, id_to_class, temperature, args.batch_size
    )

    gap = train_metrics["top1_accuracy"] - val_metrics["top1_accuracy"]
    verdict = "PASS" if val_metrics["top1_accuracy"] >= 0.90 and gap < 0.10 else "NEEDS WORK"
    verdict_detail = (
        f"Val top-1 {val_metrics['top1_accuracy']*100:.1f}%, gap {gap*100:.1f} pp"
    )

    limitations = [
        "INCLUDE manifest has only 1 unique signer_id — validation is NOT signer-independent.",
        "95% headline from ideology may not reflect new signers; wild-test accuracy is unknown.",
        "Per-class support is low (~16 videos/class) — high variance on rare signs.",
    ]
    if n_signers <= 1:
        limitations.insert(0, "CRITICAL: 1.0 signers/class — model may have learned a person, not ISL.")

    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    data_inventory = build_dataset_inventory(
        manifest_full, df, train_df, val_df, label_map, val_metrics["per_class"]
    )

    # Strip heavy arrays from JSON
    val_export = {k: v for k, v in val_metrics.items() if k not in ("y_true", "y_pred", "probs")}
    train_export = {k: v for k, v in train_metrics.items() if k not in ("y_true", "y_pred", "probs")}

    report = {
        "report_type": "ver1_temporal_evaluation",
        "timestamp": ts,
        "model": {
            "name": "TemporalLandmarkTransformer_v1",
            "checkpoint": str(checkpoint.relative_to(BASE_DIR)),
            "input_shape": [FRAMES, SEQ_LEN],
            "n_classes": n_classes,
            "browser_path": "public/model/tfjs_model/",
        },
        "calibration": {"temperature": temperature},
        "dataset": {
            "source": "include",
            "total_clips": len(df),
            "n_classes": int(df["class"].nunique()),
            "unique_signers": int(n_signers),
            "split_method": split_mode,
            "val_ratio": args.val_ratio,
            "seed": args.seed,
        },
        "metrics": {"train": train_export, "validation": val_export},
        "preprocessing": "reshape(30,126) from .npy — no normalize_skeleton (matches train_video_only/v2)",
        "data_inventory": data_inventory,
        "limitations": limitations,
        "verdict": verdict,
        "verdict_detail": verdict_detail,
        "artifacts": {},
    }

    json_path = EVAL_DIR / "ver1_eval_report.json"
    md_path = EVAL_DIR / "VER1_EVALUATION_REPORT.md"
    cm_path = EVAL_DIR / "ver1_confusion_matrix.png"
    csv_path = EVAL_DIR / "ver1_per_class.csv"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    pd.DataFrame(val_metrics["per_class"]).sort_values("accuracy").to_csv(csv_path, index=False)
    plot_confusion(val_metrics["y_true"], val_metrics["y_pred"], id_to_class, cm_path)

    report["artifacts"] = {
        "json": str(json_path.relative_to(BASE_DIR)),
        "markdown": str(md_path.relative_to(BASE_DIR)),
        "confusion_matrix": str(cm_path.relative_to(BASE_DIR)),
        "per_class_csv": str(csv_path.relative_to(BASE_DIR)),
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    write_markdown(report, md_path)

    print("\n" + "=" * 60)
    print(f"  VALIDATION Top-1: {val_metrics['top1_accuracy']*100:.2f}%")
    print(f"  VALIDATION Top-3: {val_metrics['top3_accuracy']*100:.2f}%")
    print(f"  Train–Val gap:    {gap*100:.2f} pp")
    print(f"  Verdict: {verdict} — {verdict_detail}")
    print(f"\n  Report: {md_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
