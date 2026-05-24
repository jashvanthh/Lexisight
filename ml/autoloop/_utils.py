"""Shared AutoLoop / verZ utilities."""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

BASE = Path(__file__).parent.parent.parent
AUTOLOOP = Path(__file__).parent


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_config() -> dict:
    return load_yaml(AUTOLOOP / "config.yaml")


def load_oracle_signers() -> set[str]:
    data = load_json(AUTOLOOP / "oracle_signers.json")
    return {str(s).lower() for s in data["signer_ids"]}


def clean_class_name(name: str) -> str:
    name = re.sub(r"_(Cropped|Raw)", "", name, flags=re.I)
    name = re.sub(r"^\d+\.\s*", "", name.strip(), flags=re.I)
    name = re.sub(r"[\d_,\-]", " ", name).upper().strip()
    return re.sub(r"\s+", " ", name)


def parse_signer(filename: str, source: str) -> str:
    m = re.search(r"(?:signer|person|p|s|m|f)[\s_-]*(\d+)", filename, re.I)
    if m:
        return f"s{int(m.group(1)):03d}"
    if source == "include" and filename.upper().startswith("MVI"):
        return filename.split("_")[0].upper()
    return "unknown"


def is_oracle_row(signer_id: str, source: str, oracle_set: set[str]) -> bool:
    if source != "emergency":
        return False
    return signer_id.lower() in oracle_set
