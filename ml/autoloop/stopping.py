"""AutoLoop Stage 6 — stopping criteria."""
from __future__ import annotations

from ml.autoloop._utils import load_config


def check(history: list[dict], eval_metrics: dict, failures: dict) -> dict:
    cfg = load_config()["stopping"]
    m = eval_metrics.get("metrics", eval_metrics)
    gs = m.get("generalization_score", 0)
    ece = m.get("ece", 1)
    per_class = m.get("per_class", {})
    below_70 = sum(1 for v in per_class.values() if v.get("accuracy", 1) < 0.7)

    last_gs = [h.get("generalization_score") for h in history[-5:] if "generalization_score" in h]
    no_improve = (
        len(last_gs) >= cfg["no_improvement_iters"]
        and max(last_gs[-cfg["no_improvement_iters"] :]) <= max(last_gs[: -cfg["no_improvement_iters"]] or [0]) + 0.005
    )
    stuck = len(history) >= cfg["stuck_iters"] and no_improve

    criteria = {
        "gs_ok": gs >= cfg["generalization_score_min"],
        "ece_ok": ece <= cfg["ece_max"],
        "classes_ok": below_70 <= cfg["classes_below_70_pct_max"],
    }
    all_ok = all(criteria.values())

    human_needed = stuck and gs < cfg["generalization_score_min"]
    weak_classes = [k for k, v in per_class.items() if v.get("accuracy", 1) < 0.5][:15]

    return {
        "stop": all_ok,
        "continue": not all_ok and not human_needed,
        "human_input_required": human_needed,
        "message": (
            f"Need new signer data for: {', '.join(weak_classes)}"
            if human_needed
            else ("All criteria met." if all_ok else f"Continue — focus {failures.get('focus')}")
        ),
        "criteria": criteria,
        "generalization_score": gs,
    }
