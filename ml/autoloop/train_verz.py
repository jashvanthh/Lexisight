#!/usr/bin/env python3
"""verZ training — train split excludes oracle Emergency signers."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

from ml.autoloop._utils import load_config


def main():
    cfg = load_config()
    manifest = BASE / cfg["paths"]["manifest_verz"]
    proc_manifest = BASE / "ml/data_processed/manifest.csv"

    if not manifest.exists():
        print("Run: python ml/autoloop/build_manifest_verz.py")
        return 1

    df = pd.read_csv(manifest)
    train = df[(df["is_oracle"] == 0) & (df["split"] != "oracle")].copy()

    # Build training manifest with clip_path from processed npy
    rows = []
    for _, r in train.iterrows():
        npy = BASE / "ml/data_processed" / r["source"] / r["class"] / f"{Path(r['video_path']).stem}.npy"
        if not npy.exists():
            continue
        rows.append(
            {
                "clip_path": str(npy.relative_to(BASE / "ml/data_processed")),
                "class": r["class"],
                "source": r["source"],
                "signer_id": r["signer_id"],
                "split": "",
            }
        )
    if not rows:
        print("No processed clips — run: python ml/autoloop/extract_verz.py")
        return 1

    out_df = pd.DataFrame(rows)
    proc_manifest.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(proc_manifest, index=False)
    print(f"Training manifest: {len(out_df)} clips (oracle excluded)")

    strategy_path = BASE / cfg["paths"]["strategies"]
    if strategy_path.exists():
        with open(strategy_path, encoding="utf-8") as f:
            st = json.load(f)
        print("Strategy:", st.get("active_strategies", []))

  # Delegate to temporal trainer
    from ml.scripts import train_temporal

    sys.argv = ["train_temporal", "--config", "ml/configs/train_temporal.yaml"]
    return train_temporal.main() or 0


if __name__ == "__main__":
    raise SystemExit(main())
