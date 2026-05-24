# verZ — Multi-Dataset LexiSight Training Track

**verZ** is the codename for the next-generation LexiSight model trained on **all** curated ISL corpora (not Ver1’s INCLUDE-only subset).

## Datasets (verZ corpus)

| ID | Folder | Role |
|----|--------|------|
| `include` | `Datasets/INCLUDE_FULL DATASET` | Backbone vocabulary (~263 words) |
| `cislr` | `Datasets/CISLR DATASET copy` | Vocabulary expansion (filtered, 3+ clips/class) |
| `daily` | `New Datasets/ISL_Daily_Words` | High depth per class (~60 clips) |
| `emergency` | `New Datasets/ISL_Emergency_Situations` | Multi-signer critical words |
| `alphabet_1` | `New Datasets/ISL_Alphabet_Numbers_1` | Static letters/digits (static head) |
| `alphabet_voxera` | `New Datasets/ISL_Alphabet_Numbers_Voxera` | Static letters/digits (static head) |

## Naming

| Name | Meaning |
|------|---------|
| **Ver1** | Deployed temporal word model (INCLUDE-only, `temporal_best.keras`) |
| **v1** | Ideology static fingerspelling (A–Z, 0–9) |
| **verZ** | Planned unified multi-dataset pipeline → `verz_best.keras` |

## Pipeline (to run)

1. `python ml/verz/build_manifest.py` — merge all video sources into `ml/data_processed/manifest_verz.csv`
2. `python ml/scripts/extract_*.py` — per-source landmark extraction
3. `python ml/scripts/train_temporal.py --config ml/verz/train_verz.yaml`
4. `python ml/scripts/export_tfjs.py` — browser bundle

## Status

- [x] verZ spec + config
- [ ] Unified manifest with Daily + Emergency + CISLR + INCLUDE
- [ ] Signer-disjoint splits per ideology
- [ ] Train & eval `verz_best.keras`

See `datasets.yaml` for paths and merge rules.
