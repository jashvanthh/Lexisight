#!/usr/bin/env python3
"""
LexiSight AutoLoop — run until stopping criteria or human escalation.

  python ml/autoloop/autoloop.py
  python ml/autoloop/autoloop.py --max-iter 1   # single pass
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

from ml.autoloop.categorize_failures import categorize
from ml.autoloop.stopping import check
from ml.autoloop.strategy_selector import select
from ml.autoloop._utils import load_config, load_yaml

AUTOLOOP = Path(__file__).parent
PY = sys.executable


def run(cmd: list[str]) -> int:
    print(">", " ".join(cmd))
    return subprocess.call(cmd, cwd=str(BASE))


def load_history(path: Path) -> list:
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_history(path: Path, history: list):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max-iter", type=int, default=20)
    p.add_argument("--skip-train", action="store_true")
    p.add_argument("--skip-manifest", action="store_true")
    args = p.parse_args()

    cfg = load_config()
    hist_path = BASE / cfg["paths"]["history"]
    history = load_history(hist_path)

    if not args.skip_manifest and not (BASE / cfg["paths"]["manifest_verz"]).exists():
        run([PY, "ml/autoloop/build_manifest_verz.py"])

    for iteration in range(len(history), args.max_iter):
        print(f"\n{'='*60}\n  AutoLoop iteration {iteration + 1}\n{'='*60}")

        if not args.skip_train:
            # verZ training hook — uses strategy_state.json when train_verz exists
            train_script = BASE / "ml/autoloop/train_verz.py"
            if train_script.exists():
                run([PY, str(train_script)])
            else:
                print("(train_verz.py not yet — using existing checkpoint)")

        run([PY, "ml/autoloop/evaluate_oracle.py"])
        eval_path = BASE / cfg["paths"]["eval_output"]
        with open(eval_path, encoding="utf-8") as f:
            ev = json.load(f)

        failures = categorize(ev)
        fail_path = AUTOLOOP / "autoloop_failures.json"
        with open(fail_path, "w", encoding="utf-8") as f:
            json.dump(failures, f, indent=2)

        lib = load_yaml(AUTOLOOP / "strategy_library.yaml")
        strategy = select(failures, lib)
        with open(BASE / cfg["paths"]["strategies"], "w", encoding="utf-8") as f:
            json.dump(strategy, f, indent=2)

        decision = check(history, ev, failures)
        gs = failures.get("generalization_score", ev.get("metrics", {}).get("generalization_score", 0))
        entry = {
            "iteration": iteration + 1,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "generalization_score": gs,
            "focus": failures.get("focus"),
            "strategies": strategy.get("active_strategies"),
            "rationale": strategy.get("rationale", "")[:200],
            "decision": decision,
        }
        history.append(entry)
        save_history(hist_path, history)

        print(f"Generalization Score: {gs*100:.2f}%")
        print(f"Focus: {failures.get('focus')} → {strategy.get('active_strategies')}")
        print(decision.get("message"))

        if decision.get("stop"):
            print("AutoLoop complete.")
            break
        if decision.get("human_input_required"):
            print("HUMAN INPUT REQUIRED:", decision["message"])
            break

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
