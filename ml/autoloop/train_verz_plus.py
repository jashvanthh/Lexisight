#!/usr/bin/env python3
"""verZ-Plus training entry point.

Re-runs the manifest builder so `has_npy` reflects the current state
of extraction, writes a training-ready manifest containing only rows
with extracted .npy files, then delegates to `ml/scripts/train_holistic.py`.

Usage:
    python ml/autoloop/train_verz_plus.py
    python ml/autoloop/train_verz_plus.py --hard-neg-mining
    python ml/autoloop/train_verz_plus.py --epochs 30   # quick run
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

PROCESSED = BASE / "ml" / "data_processed"
MANIFEST_FULL = PROCESSED / "manifest_verz_plus.csv"
MANIFEST_TRAIN = PROCESSED / "manifest_verz_plus_train.csv"  # rows with .npy only
TRAIN_CONFIG = BASE / "ml" / "configs" / "train_verz_plus.yaml"


def refresh_manifest(full_rebuild: bool = False) -> int:
    """Update has_npy flags and train CSV (lightweight by default)."""
    script = (
        "build_manifest_verz_plus.py"
        if full_rebuild
        else "refresh_train_manifest.py"
    )
    return subprocess.call(
        [sys.executable, str(BASE / "ml" / "autoloop" / script)],
        cwd=str(BASE),
    )


def write_train_manifest() -> tuple[int, int]:
    df = pd.read_csv(MANIFEST_FULL)
    before = len(df)
    if "has_npy" in df.columns:
        ready = df["has_npy"].astype(str).str.lower().isin({"true", "1", "yes"})
        df = df[ready].copy()
    after = len(df)
    df.to_csv(MANIFEST_TRAIN, index=False)
    return before, after


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hard-neg-mining", action="store_true")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--skip-refresh", action="store_true",
                        help="Skip has_npy scan; use existing manifest_verz_plus_train.csv")
    parser.add_argument("--full-rebuild", action="store_true",
                        help="Full manifest rebuild from manifest_verz.csv (slow)")
    parser.add_argument("--lazy-load", action="store_true",
                        help="Load landmarks per batch (low RAM, slower)")
    parser.add_argument("--resume", action="store_true",
                        help="Continue from training_logs/verz_plus_best.keras")
    parser.add_argument("--initial-epoch", type=int, default=None,
                        help="Override resume epoch (0-based)")
    args = parser.parse_args()

    if not args.skip_refresh:
        print(">> Refreshing train manifest (has_npy scan) ...")
        rc = refresh_manifest(full_rebuild=args.full_rebuild)
        if rc != 0:
            print("Manifest refresh failed.")
            return rc
    elif not MANIFEST_TRAIN.exists():
        print(">> Building train manifest ...")
        rc = refresh_manifest(full_rebuild=False)
        if rc != 0:
            return rc

    if not MANIFEST_TRAIN.exists():
        print(f"!! Missing {MANIFEST_TRAIN}. Run refresh_train_manifest.py first.")
        return 1

    df = pd.read_csv(MANIFEST_TRAIN)
    after = len(df)
    print(f">> Training manifest: {after} rows ready.")
    if after < 500:
        print("!! Too few extracted clips — extract more before training.")
        return 1

    # Class breakdown
    cc = df["class"].value_counts()
    print(f"   Classes: {len(cc)}  median clips/class: {cc.median():.0f}")
    print(f"   Sources: {df['source'].value_counts().to_dict()}")

    cmd = [
        sys.executable,
        str(BASE / "ml" / "scripts" / "train_holistic.py"),
        "--config",
        str(TRAIN_CONFIG.relative_to(BASE)).replace("\\", "/"),
    ]
    if args.hard_neg_mining:
        cmd.append("--hard-neg-mining")
    if args.epochs is not None:
        cmd.extend(["--epochs", str(args.epochs)])
    if args.batch_size is not None:
        cmd.extend(["--batch-size", str(args.batch_size)])
    if args.lazy_load:
        cmd.append("--lazy-load")
    if args.resume:
        cmd.append("--resume")
    if args.initial_epoch is not None:
        cmd.extend(["--initial-epoch", str(args.initial_epoch)])

    print(">>", " ".join(cmd))
    return subprocess.call(cmd, cwd=str(BASE))


if __name__ == "__main__":
    raise SystemExit(main())
