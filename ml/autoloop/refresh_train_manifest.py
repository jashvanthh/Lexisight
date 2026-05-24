#!/usr/bin/env python3
"""Lightweight: set has_npy on manifest_verz_plus.csv and write train-only CSV."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))
PROCESSED = BASE / "ml" / "data_processed"

SOURCE_TO_DIR = {
    "include": "holistic",
    "cislr": "cislr_holistic",
    "daily": "daily_holistic",
    "emergency": "emergency_holistic",
}


def npy_path(source: str, class_name: str, video_path: str) -> Path:
    folder = SOURCE_TO_DIR[source]
    stem = Path(video_path).stem
    return PROCESSED / folder / class_name / f"{stem}.npy"


def main() -> int:
    full = PROCESSED / "manifest_verz_plus.csv"
    if not full.exists():
        print("Run build_manifest_verz_plus.py first")
        return 1

    df = pd.read_csv(full)
    has = []
    for _, r in df.iterrows():
        p = npy_path(r["source"], r["class"], r["video_path"])
        ok = p.exists()
        has.append(ok)
        rel = str(p.relative_to(PROCESSED)).replace("\\", "/") if ok else ""
        # store path only when ready (reuse column if present)
    df["has_npy"] = has
    df["clip_path"] = [
        str(npy_path(r["source"], r["class"], r["video_path"]).relative_to(PROCESSED)).replace("\\", "/")
        if h
        else ""
        for (_, r), h in zip(df.iterrows(), has)
    ]

    train = df[df["has_npy"]].copy()
    out = PROCESSED / "manifest_verz_plus_train.csv"
    train.to_csv(out, index=False)
    df.to_csv(full, index=False)

    print(f"Ready: {len(train)} / {len(df)} clips")
    print(train["source"].value_counts().to_dict())
    print(f"Classes: {train['class'].nunique()}")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
