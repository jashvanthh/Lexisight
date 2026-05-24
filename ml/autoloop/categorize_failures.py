#!/usr/bin/env python3
"""AutoLoop Stage 3 — rule-based failure categorizer + human-readable cards."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

from ml.autoloop._utils import load_config

SEVERITY_WEIGHT = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}


def categorize(eval_report: dict, train_metrics: dict | None = None) -> dict:
    m = eval_report.get("metrics", eval_report)
    if m.get("error"):
        return {
            "failures": [{"category": "no_data", "severity": 1.0, "message": m["error"]}],
            "focus": "no_data",
        }

    failures = []
    gs = m.get("generalization_score", 0)
    ece = m.get("ece", 0)
    per_class = m.get("per_class", {})
    below_70 = [k for k, v in per_class.items() if v.get("accuracy", 1) < 0.7]
    below_70_low_support = [
        k for k in below_70 if per_class[k].get("support", 0) < 10
    ]

    train_acc = train_metrics.get("top1_accuracy", 0.99) if train_metrics else 0.99
    gap = train_acc - gs

    for cls in below_70_low_support:
        failures.append(
            {
                "category": "low_support",
                "severity": SEVERITY_WEIGHT["high"],
                "class": cls,
                "message": f"{cls}: only {per_class[cls]['support']} oracle samples and <70% accuracy — need more signers or augmentation.",
            }
        )

    for pair in m.get("top_confusions", [])[:10]:
        if pair["count"] >= 2:
            failures.append(
                {
                    "category": "high_confusion",
                    "severity": SEVERITY_WEIGHT["high"],
                    "true": pair["true"],
                    "predicted": pair["predicted"],
                    "count": pair["count"],
                    "message": f"Often confused {pair['true']} → {pair['predicted']} ({pair['count']}×).",
                }
            )

    if gap > 0.15:
        failures.append(
            {
                "category": "overfitting",
                "severity": SEVERITY_WEIGHT["critical"],
                "gap_pp": round(gap * 100, 1),
                "message": f"Train–oracle gap {gap*100:.1f}pp — model memorized, not generalizing.",
            }
        )

    if gs < 0.5 and gap < 0.12:
        failures.append(
            {
                "category": "signer_generalization",
                "severity": SEVERITY_WEIGHT["critical"],
                "message": "Low oracle score without huge overfit gap — add Emergency signers to training with oversampling.",
            }
        )

    if ece > 0.15:
        failures.append(
            {
                "category": "calibration",
                "severity": SEVERITY_WEIGHT["medium"],
                "ece": ece,
                "message": f"Calibration error {ece:.3f} — run temperature sweep.",
            }
        )

    if not failures and gs < 0.8:
        failures.append(
            {
                "category": "general_low_accuracy",
                "severity": SEVERITY_WEIGHT["medium"],
                "message": f"Generalization {gs*100:.1f}% below 80% target — mixed issues.",
            }
        )

    failures.sort(key=lambda x: -x.get("severity", 0))
    focus = failures[0]["category"] if failures else "none"
    return {"failures": failures, "focus": focus, "generalization_score": gs}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--eval", default=None)
    p.add_argument("--output", default=None)
    args = p.parse_args()
    cfg = load_config()
    eval_path = Path(args.eval or BASE / cfg["paths"]["eval_output"])
    out = Path(args.output or BASE / "ml/autoloop/autoloop_failures.json")

    with open(eval_path, encoding="utf-8") as f:
        ev = json.load(f)
    result = categorize(ev)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"Focus: {result['focus']} | {len(result['failures'])} failure cards")
    for card in result["failures"][:3]:
        print(" -", card["message"][:80])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
