# LexiSight AutoLoop

Autonomous training loop for **verZ**. Optimizes **Generalization Score** on 8 locked Emergency oracle signers.

## Quick start

```bash
python ml/autoloop/build_manifest_verz.py
python ml/autoloop/evaluate_oracle.py
python ml/autoloop/categorize_failures.py
python ml/autoloop/autoloop.py --max-iter 1
```

## Stages

| Stage | Script |
|-------|--------|
| 0 Oracle | `oracle_signers.json` (s001–s008) |
| 1 Train | `train_verz.py` (TODO) |
| 2 Eval | `evaluate_oracle.py` → `autoloop_eval.json` |
| 3 Diagnose | `categorize_failures.py` |
| 4 Strategy | `strategy_selector.py` |
| 5 Apply | `train_verz.py` reads `strategy_state.json` |
| 6 Stop | `stopping.py` inside `autoloop.py` |

## Oracle rule

Emergency signers **s001–s008** never appear in training. All other corpora + other Emergency signers are train-only.
