#!/usr/bin/env python3
"""Build dictionary videos: public/library/include/ and public/library/cislr/."""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
from pathlib import Path

BASE = Path(__file__).parent.parent
INCLUDE_SRC = BASE / "Datasets" / "INCLUDE_FULL DATASET"
CISLR_DIR = BASE / "Datasets" / "CISLR DATASET copy"
CISLR_CSV = CISLR_DIR / "dataset.csv"
CISLR_VIDEOS = CISLR_DIR / "CISLR_v1.5-a_videos" / "CISLR_v1.5-a_videos"
LIB_ROOT = BASE / "public" / "library"
INCLUDE_OUT = LIB_ROOT / "include"
CISLR_OUT = LIB_ROOT / "cislr"
MANIFEST = BASE / "src" / "data" / "islVideoLibrary.json"


def clean_include(name: str) -> str:
    return re.sub(r"^\d+\.\s*", "", name.strip()).upper().replace("_", " ")


def safe_word(label: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", label.strip()).strip("_") or "SIGN"


def safe_category(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.strip())
    return re.sub(r"\s+", "_", s).strip("_") or "Other"


def dest_include(category: str, label: str, ext: str) -> Path:
    return INCLUDE_OUT / safe_category(category) / f"{safe_word(label)}{ext.lower()}"


def dest_cislr(category: str, label: str) -> Path:
    return CISLR_OUT / safe_category(category) / f"{safe_word(label)}.mp4"


def collect_include(args, taken: set[str]) -> list[dict]:
    if not INCLUDE_SRC.exists():
        return []
    rows = []
    for cat_dir in sorted(INCLUDE_SRC.iterdir()):
        if not cat_dir.is_dir():
            continue
        category = cat_dir.name.replace("_", " ").strip()
        for word_dir in sorted(cat_dir.iterdir()):
            if not word_dir.is_dir():
                continue
            label = clean_include(word_dir.name)
            if label in taken:
                continue
            vids = []
            for ext in (".MOV", ".mov", ".mp4", ".MP4", ".avi"):
                vids.extend(word_dir.glob(f"*{ext}"))
            if not vids:
                continue
            vids.sort(key=lambda p: p.stat().st_size)
            chosen = vids[0]
            dest = dest_include(category, label, chosen.suffix)
            if not args.no_copy:
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    shutil.copy2(chosen, dest)
            rel = dest.relative_to(BASE / "public").as_posix()
            rows.append({
                "id": f"inc_{safe_word(label).lower()}",
                "label": label,
                "category": category,
                "library": "include",
                "source": "INCLUDE",
                "video": f"/{rel}",
            })
            taken.add(label)
    return rows


def collect_cislr(args, taken_include: set[str]) -> list[dict]:
    if not CISLR_CSV.exists() or not CISLR_VIDEOS.exists():
        return []
    by_gloss: dict[str, list[tuple[Path, str]]] = {}
    with open(CISLR_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            uid = r["uid"].strip()
            gloss = r["gloss"].strip()
            cat = (r.get("category") or "Other").strip() or "Other"
            if not uid or not gloss:
                continue
            vid = CISLR_VIDEOS / f"{uid}.mp4"
            if vid.exists():
                by_gloss.setdefault(gloss, []).append((vid, cat))
    rows = []
    for gloss, candidates in by_gloss.items():
        label = gloss.upper()
        candidates.sort(key=lambda t: t[0].stat().st_size)
        vid, cat = candidates[0]
        dest = dest_cislr(cat, label)
        if not args.no_copy:
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                shutil.copy2(vid, dest)
        rel = dest.relative_to(BASE / "public").as_posix()
        rows.append({
            "id": f"cislr_{safe_word(label).lower()}",
            "label": label,
            "category": cat.title() if cat.islower() else cat,
            "library": "cislr",
            "source": "CISLR",
            "video": f"/{rel}",
        })
    return rows


def migrate_flat(include_rows: list[dict], cislr_rows: list[dict]) -> None:
    moved = 0
    for row in include_rows:
        dest = BASE / "public" / row["video"].lstrip("/")
        if dest.exists():
            continue
        label = row["label"]
        for leg in (
            LIB_ROOT / Path(row["video"]).name,
            LIB_ROOT / f"{safe_word(label)}.mp4",
            LIB_ROOT / f"{safe_word(label)}.mov",
            LIB_ROOT / f"{safe_word(label)}.MOV",
        ):
            if leg.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(leg), str(dest))
                moved += 1
                break
    for row in cislr_rows:
        dest = BASE / "public" / row["video"].lstrip("/")
        if dest.exists():
            continue
        leg = LIB_ROOT / f"cislr_{safe_word(row['label'])}.mp4"
        if leg.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(leg), str(dest))
            moved += 1
    print(f"Moved {moved} files into include/ and cislr/")


def write_manifest(include_rows: list[dict], cislr_rows: list[dict]) -> None:
    def pack(rows: list[dict], key: str, title: str) -> dict:
        return {
            "id": key,
            "title": title,
            "count": len(rows),
            "categories": sorted({r["category"] for r in rows}),
            "items": rows,
        }

    inc = pack(include_rows, "include", "INCLUDE Full")
    cis = pack(cislr_rows, "cislr", "CISLR")
    all_items = sorted(include_rows + cislr_rows, key=lambda r: r["label"])
    manifest = {
        "source": "INCLUDE + CISLR",
        "count": len(all_items),
        "libraries": {"include": inc, "cislr": cis},
        "items": all_items,
    }
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    slim_path = MANIFEST.with_name("islVideoLibrary.slim.json")
    slim_items = [
        {k: r[k] for k in ("id", "label", "category", "source", "video") if k in r}
        for r in all_items
    ]
    slim = {
        "source": manifest["source"],
        "count": manifest["count"],
        "categories": sorted({r["category"] for r in all_items}),
        "items": slim_items,
    }
    with open(slim_path, "w", encoding="utf-8") as f:
        json.dump(slim, f, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cislr", action="store_true")
    ap.add_argument("--no-include", action="store_true")
    ap.add_argument("--no-copy", action="store_true")
    ap.add_argument("--migrate-only", action="store_true")
    args = ap.parse_args()

    INCLUDE_OUT.mkdir(parents=True, exist_ok=True)
    if args.cislr:
        CISLR_OUT.mkdir(parents=True, exist_ok=True)

    plan = argparse.Namespace(no_copy=True, max_mb=99)
    taken: set[str] = set()
    include_rows = [] if args.no_include else collect_include(plan, taken)
    cislr_rows = collect_cislr(plan, taken) if args.cislr else []

    if args.migrate_only:
        migrate_flat(include_rows, cislr_rows)
    elif not args.no_copy:
        taken2: set[str] = set()
        include_rows = [] if args.no_include else collect_include(args, taken2)
        cislr_rows = collect_cislr(args, taken2) if args.cislr else []

    write_manifest(include_rows, cislr_rows)
    print(f"include={len(include_rows)} cislr={len(cislr_rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
