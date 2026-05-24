#!/usr/bin/env python3
"""
verZ-Plus training manifest builder.

Inputs:
  ml/data_processed/manifest_verz.csv   (raw verZ rows)
  Existing .npy files under:
    ml/data_processed/holistic/<class>/<stem>.npy            (INCLUDE)
    ml/data_processed/cislr_holistic/<class>/<stem>.npy      (CISLR)
    ml/data_processed/daily_holistic/<class>/<stem>.npy      (to be extracted)
    ml/data_processed/emergency_holistic/<class>/<stem>.npy  (to be extracted)

Output:
  ml/data_processed/manifest_verz_plus.csv     -> only trainable rows
  ml/data_processed/manifest_verz_plus_oracle.csv -> oracle rows (held out)
  ml/data_processed/manifest_verz_plus_missing.csv -> rows still needing extraction

Rules:
  - Drop oracle rows from training manifest (is_oracle == 1 OR split == 'oracle').
  - Keep INCLUDE / Daily / Emergency rows (multi-shot training data).
  - Keep CISLR rows ONLY where the class also appears in INCLUDE/Daily/Emergency
    (overlap mining; CISLR-only classes would be 1-shot junk for training).
  - Filter to classes with >= MIN_CLIPS_PER_CLASS clips after the merge.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

PROCESSED = BASE / "ml" / "data_processed"
MANIFEST_IN = PROCESSED / "manifest_verz.csv"
MANIFEST_TRAIN = PROCESSED / "manifest_verz_plus.csv"
MANIFEST_ORACLE = PROCESSED / "manifest_verz_plus_oracle.csv"
MANIFEST_MISSING = PROCESSED / "manifest_verz_plus_missing.csv"

# Map verZ source -> processed-data subfolder name (holistic .npy)
SOURCE_TO_DIR = {
    "include": "holistic",
    "cislr": "cislr_holistic",
    "daily": "daily_holistic",
    "emergency": "emergency_holistic",
}

MIN_CLIPS_PER_CLASS = 3


def npy_path(source: str, class_name: str, video_path: str) -> Path:
    folder = SOURCE_TO_DIR.get(source)
    if folder is None:
        return None  # unknown source
    stem = Path(video_path).stem
    return PROCESSED / folder / class_name / f"{stem}.npy"


def main() -> int:
    if not MANIFEST_IN.exists():
        print(f"Missing {MANIFEST_IN}. Run build_manifest_verz.py first.")
        return 1

    df = pd.read_csv(MANIFEST_IN)
    print(f"Loaded {len(df)} rows from {MANIFEST_IN.name}")

    # Split oracle
    oracle_mask = (df["is_oracle"] == 1) | (df["split"].astype(str) == "oracle")
    oracle_df = df[oracle_mask].copy()
    pool = df[~oracle_mask].copy()
    print(f"  Oracle rows: {len(oracle_df)}  (held out)")
    print(f"  Pool rows:   {len(pool)}")

    # Trainable classes = union of INCLUDE / Daily / Emergency classes
    multi_shot_sources = {"include", "daily", "emergency"}
    trainable_classes = set(
        pool[pool["source"].isin(multi_shot_sources)]["class"].unique()
    )
    print(f"  Trainable classes (multi-shot sources): {len(trainable_classes)}")

    # CISLR overlap mine: keep CISLR rows ONLY for classes already trainable
    keep = pool[pool["source"].isin(multi_shot_sources)].copy()
    cislr_overlap = pool[
        (pool["source"] == "cislr") & (pool["class"].isin(trainable_classes))
    ].copy()
    print(f"  CISLR overlap clips kept: {len(cislr_overlap)}")
    print(f"  CISLR-only classes dropped: "
          f"{len(set(pool[pool['source']=='cislr']['class'].unique()) - trainable_classes)}")

    train = pd.concat([keep, cislr_overlap], ignore_index=True)

    # Annotate npy_path / has_npy
    paths = []
    has_npy_list = []
    for _, r in train.iterrows():
        p = npy_path(r["source"], r["class"], r["video_path"])
        rel = "" if p is None else str(p.relative_to(PROCESSED)).replace("\\", "/")
        paths.append(rel)
        has_npy_list.append(p is not None and p.exists())
    train["clip_path"] = paths
    train["has_npy"] = has_npy_list

    # Apply min-clips-per-class filter (counts include both extracted + missing)
    counts = train["class"].value_counts()
    keep_classes = set(counts[counts >= MIN_CLIPS_PER_CLASS].index)
    before = len(train)
    train = train[train["class"].isin(keep_classes)].copy()
    print(f"  After min-{MIN_CLIPS_PER_CLASS}-clips filter: "
          f"{len(train)} rows ({before - len(train)} dropped, "
          f"{len(keep_classes)} classes kept)")

    # Same for oracle
    oracle_paths = []
    oracle_has_npy = []
    for _, r in oracle_df.iterrows():
        p = npy_path(r["source"], r["class"], r["video_path"])
        rel = "" if p is None else str(p.relative_to(PROCESSED)).replace("\\", "/")
        oracle_paths.append(rel)
        oracle_has_npy.append(p is not None and p.exists())
    oracle_df["clip_path"] = oracle_paths
    oracle_df["has_npy"] = oracle_has_npy

    # Save outputs
    PROCESSED.mkdir(parents=True, exist_ok=True)
    train.to_csv(MANIFEST_TRAIN, index=False)
    oracle_df.to_csv(MANIFEST_ORACLE, index=False)
    missing = train[~train["has_npy"]].copy()
    missing.to_csv(MANIFEST_MISSING, index=False)

    # Summary
    print()
    print("=" * 60)
    print(f"  Train manifest:  {MANIFEST_TRAIN.name}  ({len(train)} rows)")
    print(f"  Oracle manifest: {MANIFEST_ORACLE.name} ({len(oracle_df)} rows)")
    print(f"  Missing extract: {MANIFEST_MISSING.name} ({len(missing)} rows)")
    print()
    print("  Train rows by source:")
    for src, n in train["source"].value_counts().items():
        extracted = train[(train["source"] == src) & train["has_npy"]].shape[0]
        print(f"    {src:10s}  {n:6d}  ({extracted} have .npy, {n-extracted} need extraction)")
    print()
    print("  Class distribution:")
    cc = train["class"].value_counts()
    print(f"    Total classes:      {len(cc)}")
    print(f"    Classes >= 3 clips: {(cc>=3).sum()}")
    print(f"    Classes >= 5 clips: {(cc>=5).sum()}")
    print(f"    Classes >=10 clips: {(cc>=10).sum()}")
    print(f"    Median clips/class: {cc.median():.0f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
