#!/usr/bin/env python3
"""Copy letter/number images into public/library/letters|numbers/ and refresh manifest."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import time
from pathlib import Path

BASE = Path(__file__).parent.parent
LIB_ROOT = BASE / "public" / "library"
LETTERS_OUT = LIB_ROOT / "letters"
NUMBERS_OUT = LIB_ROOT / "numbers"
PLACEHOLDER_ROOT = BASE / "public" / "dictionary-media"
MANIFEST_OUT = BASE / "src" / "data" / "islLettersNumbers.slim.json"
SPEC = BASE / "src" / "data" / "dictionaryLettersNumbers.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".mov", ".webm"}
PRIMARY_DATASET = BASE / "New Datasets" / "ISL_Alphabet_Numbers_1"
DATASET_DIRS = [PRIMARY_DATASET]
EXTRA_DATASET_DIRS = [
    BASE / "New Datasets" / "ISL_Alphabet_Numbers_Voxera",
    BASE / "Datasets" / "ISL_Alphabet_Numbers_1",
]

def safe_name(label: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "", label.strip().upper()) or "SIGN"


def is_letter(label: str) -> bool:
    return len(label) == 1 and label.isalpha()


def is_digit(label: str) -> bool:
    return len(label) == 1 and label.isdigit()


def guess_label(path: Path) -> str | None:
    """Label from parent folder (Indian/9/0.jpg → 9) or filename stem."""
    parent = path.parent.name.upper()
    if is_letter(parent) or is_digit(parent):
        return parent

    stem = path.stem.upper().replace("_", " ").strip()
    if stem.startswith("LETTER "):
        stem = stem.replace("LETTER ", "", 1).strip()
    if stem.startswith("NUMBER "):
        stem = stem.replace("NUMBER ", "", 1).strip()
    if stem.startswith("DIGIT "):
        stem = stem.replace("DIGIT ", "", 1).strip()
    if is_letter(stem) or is_digit(stem):
        return stem
    parts = re.split(r"[\s\-_]+", stem)
    for p in reversed(parts):
        if is_letter(p) or is_digit(p):
            return p
    return None


def pick_class_image(class_dir: Path) -> Path | None:
    """One reference frame per class — prefer 0.jpg then 1.jpg."""
    if not class_dir.is_dir():
        return None
    for name in ("0.jpg", "0.jpeg", "0.png", "1.jpg", "1.jpeg", "1.png"):
        candidate = class_dir / name
        if candidate.is_file():
            return candidate
    files = sorted(
        (p for p in class_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS),
        key=lambda p: (len(p.stem), p.stem),
    )
    return files[0] if files else None


def scan_indian_layout(root: Path, found: dict[str, Path]) -> None:
    """ISL_Alphabet_Numbers_1/Indian/{A-Z|0-9}/*.jpg"""
    indian = root / "Indian"
    if not indian.is_dir():
        return
    for class_dir in sorted(indian.iterdir()):
        if not class_dir.is_dir():
            continue
        label = class_dir.name.upper()
        if not (is_letter(label) or is_digit(label)):
            continue
        path = pick_class_image(class_dir)
        if not path:
            continue
        prev = found.get(label)
        if prev is None or path.stat().st_size > prev.stat().st_size:
            found[label] = path


def scan_sources(include_extra: bool = False) -> dict[str, Path]:
    """Prefer ISL_Alphabet_Numbers_1/Indian/{class}/0.jpg — never replace with larger Voxera aug shots."""
    found: dict[str, Path] = {}
    roots = list(DATASET_DIRS)
    if include_extra:
        roots.extend(EXTRA_DATASET_DIRS)

    for root in roots:
        if not root.exists():
            continue
        scan_indian_layout(root, found)
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
                continue
            if "Indian" in path.parts and path.parent.name.upper() in {
                *map(chr, range(ord("A"), ord("Z") + 1)),
                *[str(d) for d in range(10)],
            }:
                continue
            label = guess_label(path)
            if not label or label in found:
                continue
            found[label] = path
    return found


def write_placeholder_svg(dest: Path, label: str, accent: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img">
  <rect width="320" height="220" fill="#0a1525"/>
  <rect x="8" y="8" width="304" height="204" rx="12" fill="#0d1f33" stroke="{accent}" stroke-width="2"/>
  <text x="160" y="128" text-anchor="middle" font-family="Syne,Arial,sans-serif" font-size="96" font-weight="800" fill="{accent}">{label}</text>
</svg>'''
    dest.write_text(svg, encoding="utf-8")


def media_type_for(path: Path) -> str:
    return "video" if path.suffix.lower() in {".mp4", ".mov", ".webm", ".avi"} else "image"


def find_existing_media(out_dir: Path, dest_name: str) -> Path | None:
    """Use photos already placed in public/library/letters|numbers/."""
    if not out_dir.is_dir():
        return None
    for ext in sorted(IMAGE_EXTS, key=len):
        for name in (dest_name, dest_name.upper(), dest_name.lower()):
            candidate = out_dir / f"{name}{ext}"
            if candidate.is_file():
                return candidate
    matches = sorted(
        p for p in out_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS and guess_label(p) == dest_name.upper()
    )
    return matches[0] if matches else None


def build(args) -> int:
    with open(SPEC, encoding="utf-8") as f:
        spec = json.load(f)

    scanned = scan_sources(include_extra=getattr(args, "include_extra_datasets", False))
    rows: list[dict] = []

    sections: list[tuple[str, Path]] = [
        ("letters", LETTERS_OUT),
        ("numbers", NUMBERS_OUT),
    ]
    if getattr(args, "numbers_only", False):
        sections = [("numbers", NUMBERS_OUT)]
    elif getattr(args, "letters_only", False):
        sections = [("letters", LETTERS_OUT)]

    for section_key, out_dir in sections:
        section = spec[section_key]
        placeholder_dir = PLACEHOLDER_ROOT / section["folder"]
        out_dir.mkdir(parents=True, exist_ok=True)

        for label in section["items"]:
            label = str(label).upper() if section_key == "letters" else str(label)
            dest_name = safe_name(label)
            src = scanned.get(label)

            rel_library = None
            rel_placeholder = f"/dictionary-media/{section['folder']}/{dest_name}.svg"

            existing = find_existing_media(out_dir, dest_name)
            force = getattr(args, "force", False)

            if src and not args.placeholders_only:
                dest = out_dir / f"{dest_name}{src.suffix.lower()}"
                if not args.no_copy:
                    shutil.copy2(src, dest)
                rel_library = dest.relative_to(BASE / "public").as_posix()
                media = media_type_for(dest)
                video = f"/{rel_library}"
            elif existing and not args.placeholders_only and not force:
                rel_library = existing.relative_to(BASE / "public").as_posix()
                media = media_type_for(existing)
                video = f"/{rel_library}"
            else:
                ph = placeholder_dir / f"{dest_name}.svg"
                if not ph.exists() or args.regen_placeholders:
                    write_placeholder_svg(ph, label, section["accent"])
                media = "image"
                video = rel_placeholder

            source = section["source"]
            if section_key == "numbers" and src:
                source = "ISL_Alphabet_Numbers_1"

            rows.append({
                "id": f"{section_key}_{dest_name.lower()}",
                "label": label,
                "category": section["category"],
                "source": source,
                "library": section_key,
                "video": video,
                "mediaType": media,
            })

    if (args.numbers_only or args.letters_only) and MANIFEST_OUT.exists():
        with open(MANIFEST_OUT, encoding="utf-8") as f:
            prev = json.load(f)
        keep_lib = "letters" if args.numbers_only else "numbers"
        rows = [i for i in prev.get("items", []) if i.get("library") == keep_lib] + rows

    manifest = {
        "source": "Letters + Numbers",
        "mediaVersion": int(time.time()),
        "count": len(rows),
        "libraries": {
            "letters": {
                "id": "letters",
                "title": spec["letters"]["title"],
                "icon": spec["letters"]["icon"],
                "accent": spec["letters"]["accent"],
                "folder": "library/letters",
                "count": len(spec["letters"]["items"]),
            },
            "numbers": {
                "id": "numbers",
                "title": spec["numbers"]["title"],
                "icon": spec["numbers"]["icon"],
                "accent": spec["numbers"]["accent"],
                "folder": "library/numbers",
                "count": len(spec["numbers"]["items"]),
            },
        },
        "items": rows,
    }
    with open(MANIFEST_OUT, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    digits = sorted((k for k in scanned if k.isdigit()), key=int)
    print(f"Wrote {len(rows)} manifest entries -> {MANIFEST_OUT}")
    print(f"  dataset labels: {len(scanned)} (digits: {''.join(digits) or 'none'})")
    print(f"  library: {LETTERS_OUT} | {NUMBERS_OUT}")
    print(f"  placeholders: {PLACEHOLDER_ROOT}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-copy", action="store_true")
    ap.add_argument("--placeholders-only", action="store_true")
    ap.add_argument("--regen-placeholders", action="store_true")
    ap.add_argument("--numbers-only", action="store_true", help="Copy/update 0-9 only")
    ap.add_argument("--letters-only", action="store_true", help="Copy/update A-Z only")
    ap.add_argument(
        "--force",
        action="store_true",
        help="Always overwrite library files from dataset (ignore stale copies)",
    )
    ap.add_argument(
        "--include-extra-datasets",
        action="store_true",
        help="Also scan Voxera / legacy folders (default: ISL_Alphabet_Numbers_1 only)",
    )
    return build(ap.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
