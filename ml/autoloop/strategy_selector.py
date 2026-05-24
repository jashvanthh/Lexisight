#!/usr/bin/env python3
"""AutoLoop Stage 4 — pick interventions from failure cards (Optuna-ready)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

from ml.autoloop._utils import load_config, load_yaml

AUTOLOOP = Path(__file__).parent

FOCUS_TO_STRATEGIES = {
    "low_support": ["speed_augment_4x", "spatial_jitter"],
    "high_confusion": ["hard_negative_injection", "confusion_pair_oversample"],
    "overfitting": ["dropout_increase", "weight_decay_increase"],
    "signer_generalization": ["emergency_oversample_3x", "signer_disjoint_enforce"],
    "calibration": ["temperature_sweep"],
    "speed_sensitivity": ["temporal_speed_augment"],
    "general_low_accuracy": ["emergency_oversample_3x", "hard_negative_injection"],
    "no_data": ["run_extraction"],
}


def select(failures_report: dict, library: dict, prev_state: dict | None = None) -> dict:
    focus = failures_report.get("focus", "general_low_accuracy")
    strategies = list(FOCUS_TO_STRATEGIES.get(focus, ["spatial_jitter"]))
    # Add strategies from top failure categories
    for f in failures_report.get("failures", [])[:3]:
        for s in FOCUS_TO_STRATEGIES.get(f["category"], []):
            if s not in strategies:
                strategies.append(s)

    state = dict(library.get("defaults", {}))
    state["active_strategies"] = strategies
    state["focus"] = focus
    state["rationale"] = failures_report.get("failures", [{}])[0].get("message", "")

    if "dropout_increase" in strategies:
        state["dropout"] = min(0.45, float(state.get("dropout", 0.3)) + 0.05)
    if "weight_decay_increase" in strategies:
        state["weight_decay"] = min(0.05, float(state.get("weight_decay", 0.01)) * 2)
    if "emergency_oversample_3x" in strategies:
        state["emergency_loss_weight"] = 3.0
    if "temperature_sweep" in strategies:
        state["temperature"] = 1.1

    pairs = [
        {"true": f.get("true"), "predicted": f.get("predicted")}
        for f in failures_report.get("failures", [])
        if f.get("category") == "high_confusion"
    ]
    state["confusion_pairs"] = pairs[:8]
    return state


def main():
    p = argparse.ArgumentParser()
    args = p.parse_args()
    cfg = load_config()
    lib = load_yaml(AUTOLOOP / "strategy_library.yaml")
    with open(BASE / "ml/autoloop/autoloop_failures.json", encoding="utf-8") as f:
        fr = json.load(f)
    state = select(fr, lib)
    out = BASE / cfg["paths"]["strategies"]
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    print("Strategies:", state["active_strategies"])
    print("Saved", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
