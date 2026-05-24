#!/usr/bin/env python3
"""
verZ — Build unified manifest from all registered datasets.
Run: python ml/verz/build_manifest.py

Outputs: ml/data_processed/manifest_verz.csv (planned)
Today: prints inventory only — extraction merge is next step.
"""

import json
from pathlib import Path

import pandas as pd
import yaml

BASE = Path(__file__).parent.parent.parent
CFG = Path(__file__).parent / "datasets.yaml"


def main():
    with open(CFG, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    print("=" * 60)
    print("  verZ dataset inventory")
    print("=" * 60)

    rows = []
    for ds_id, ds in cfg["datasets"].items():
        p = BASE / ds["path"]
        exists = p.exists()
        n_videos = 0
        if exists and ds.get("type") == "video":
            n_videos = sum(
                1
                for _ in p.rglob("*")
                if _.suffix.lower() in {".mp4", ".avi", ".mov", ".mkv"}
            )
        rows.append(
            {
                "id": ds_id,
                "path": ds["path"],
                "exists": exists,
                "type": ds.get("type"),
                "role": ds.get("role"),
                "videos": n_videos,
            }
        )

    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    cur = BASE / "ml" / "data_processed" / "manifest.csv"
    if cur.exists():
        m = pd.read_csv(cur)
        print("\nCurrent manifest.csv:")
        print(m.groupby("source").size().to_string())

    print("\nNext: extract landmarks per source → merge into manifest_verz.csv → train verz_best.keras")


if __name__ == "__main__":
    main()
