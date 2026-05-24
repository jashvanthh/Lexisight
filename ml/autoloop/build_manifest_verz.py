#!/usr/bin/env python3
"""
verZ — Build unified video manifest from all corpora.
Output: ml/data_processed/manifest_verz.csv

Columns: video_path, class, source, signer_id, is_oracle, split
Oracle Emergency signers are tagged is_oracle=1 (never used in training).
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

import yaml

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

from ml.autoloop._utils import (
    clean_class_name,
    is_oracle_row,
    load_oracle_signers,
    parse_signer,
)

VERZ_CFG = BASE / "ml" / "verz" / "datasets.yaml"
OUT = BASE / "ml" / "data_processed" / "manifest_verz.csv"
MERGE_MAP = BASE / "scripts" / "dataset_merge_map.json"


def scan_videos(root: Path, source: str, oracle_set: set[str]) -> list[dict]:
    rows = []
    if not root.exists():
        print(f"  skip {source}: not found {root}")
        return rows
    for v in root.rglob("*"):
        if v.suffix.lower() not in {".mp4", ".avi", ".mov", ".mkv"}:
            continue
        cls = clean_class_name(v.parent.name)
        if cls.lower() in {"SAMPLE VIDEOS", "VIDEO_DATASET", "RAW_DATA", "CROPPED_DATA", ""}:
            cls = clean_class_name(v.parent.parent.name)
        signer = parse_signer(v.name, source)
        oracle = is_oracle_row(signer, source, oracle_set)
        rows.append(
            {
                "video_path": str(v.relative_to(BASE)),
                "class": cls,
                "source": source,
                "signer_id": signer,
                "is_oracle": int(oracle),
                "split": "oracle" if oracle else "",
            }
        )
    return rows


def scan_include(root: Path, oracle_set: set[str]) -> list[dict]:
    rows = []
    for cat in root.iterdir():
        if not cat.is_dir():
            continue
        for word_dir in cat.iterdir():
            if not word_dir.is_dir():
                continue
            cls = clean_class_name(word_dir.name)
            for v in word_dir.glob("*"):
                if v.suffix.lower() not in {".mp4", ".avi", ".mov"}:
                    continue
                signer = parse_signer(v.stem, "include")
                rows.append(
                    {
                        "video_path": str(v.relative_to(BASE)),
                        "class": cls,
                        "source": "include",
                        "signer_id": signer,
                        "is_oracle": 0,
                        "split": "",
                    }
                )
    return rows


def scan_cislr(root: Path, oracle_set: set[str]) -> list[dict]:
    rows = []
    csv_path = root / "dataset.csv"
    vid_dir = root / "CISLR_v1.5-a_videos" / "CISLR_v1.5-a_videos"
    if not csv_path.exists():
        vid_dir = root / "CISLR_v1.5-a_videos"
    if not csv_path.exists():
        return scan_videos(root, "cislr", oracle_set)
    import csv as csvmod

    with open(csv_path, encoding="utf-8") as f:
        for row in csvmod.DictReader(f):
            uid = row.get("uid", "")
            gloss = clean_class_name(row.get("gloss", ""))
            if not gloss:
                continue
            vp = vid_dir / f"{uid}.mp4"
            if not vp.exists():
                continue
            rows.append(
                {
                    "video_path": str(vp.relative_to(BASE)),
                    "class": gloss,
                    "source": "cislr",
                    "signer_id": row.get("speaker_id", "unknown") or "unknown",
                    "is_oracle": 0,
                    "split": "",
                }
            )
    return rows


def filter_by_merge_map(rows: list[dict], min_total: int = 3) -> list[dict]:
    if not MERGE_MAP.exists():
        return rows
    with open(MERGE_MAP, encoding="utf-8") as f:
        merge = json.load(f)
    allowed = {clean_class_name(k) for k, v in merge.items() if sum(v.values()) >= min_total}
    # also allow keys that match after clean
    out = []
    for r in rows:
        if r["class"] in allowed or r["source"] == "include":
            out.append(r)
    return out


def main():
    with open(VERZ_CFG, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    oracle_set = load_oracle_signers()
    print("verZ manifest build | oracle signers:", sorted(oracle_set))

    all_rows: list[dict] = []
    ds = cfg["datasets"]

    all_rows.extend(scan_include(BASE / ds["include"]["path"], oracle_set))
    all_rows.extend(scan_videos(BASE / ds["emergency"]["path"], "emergency", oracle_set))
    all_rows.extend(scan_videos(BASE / ds["daily"]["path"], "daily", oracle_set))
    all_rows.extend(scan_cislr(BASE / ds["cislr"]["path"], oracle_set))

    before = len(all_rows)
    all_rows = [r for r in all_rows if r["signer_id"] != "unknown" or r["source"] != "emergency"]
    all_rows = filter_by_merge_map(all_rows, min_total=3)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = ["video_path", "class", "source", "signer_id", "is_oracle", "split"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(all_rows)

    by_src = defaultdict(int)
    oracle_n = 0
    for r in all_rows:
        by_src[r["source"]] += 1
        if r["is_oracle"]:
            oracle_n += 1
    print(f"Wrote {len(all_rows)} rows ({before} before filter) -> {OUT}")
    print("By source:", dict(by_src))
    print("Oracle clips:", oracle_n)


if __name__ == "__main__":
    main()
