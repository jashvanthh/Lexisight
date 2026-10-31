# LexiSight Model Card

## Overview

| Field | Value |
|---|---|
| **Tag** | `paper-v1` |
| **Repository** | `github.com/jashvanthh/Lexisight` |
| **Model files** | `ml/models/best_temporal.keras` (Keras), `public/model/tfjs_model/` (TF.js browser export) |
| **DVC pointer** | `ml/models/best_temporal.keras.dvc`, `public/model/tfjs_model.dvc` |
| **Classes** | 263 ISL signs |
| **Input** | 30 frames × 126 features (21 landmarks × 3 coords × 2 hands) |

## Performance

| Metric | Value | Notes |
|---|---|---|
| **Val top-1 accuracy** | 81.34% | Measured on stratified random 80/20 split |
| **Val top-3 accuracy** | 92.25% | — |
| **Split strategy** | Stratified random 80/20 | Not signer-disjoint |
| **Measured on** | ASUS ROG G15, RTX 4060, Chrome, localhost | |

> ⚠️ **Note:** The validation split is stratified random (same signers may appear in train and val). This inflates the reported accuracy relative to a signer-disjoint split. The holistic_v3 config uses signer-disjoint splits for fairer evaluation.

## Training Settings

See [`ml/params.yaml`](ml/params.yaml) at tag `paper-v1` for the exact settings.

Key settings used for the paper model:

| Setting | Value |
|---|---|
| Architecture | Temporal Landmark Transformer v1 |
| Transformer layers | 2 |
| Attention heads | 4 |
| Projection dim | 128 |
| Dropout | 0.2 |
| Optimizer | AdamW |
| Learning rate | 0.001 (phase 1), 0.0001 (phase 2) |
| Batch size | 64 (phase 1), 32 (phase 2) |
| Epochs | 100 + 50 (two-phase) |
| Seed | 42 |

## Reproducing This Model

```bash
# 1. Clone the repo and checkout the paper tag
git clone https://github.com/jashvanthh/Lexisight.git
cd Lexisight
git checkout paper-v1

# 2. Pull the exact model files
dvc pull

# 3. Model is now available at:
#    ml/models/best_temporal.keras   ← Keras checkpoint
#    public/model/tfjs_model/        ← TF.js browser export
```

## Files Tracked by DVC

| DVC Pointer File | Actual File | Size |
|---|---|---|
| `ml/models/best_temporal.keras.dvc` | `ml/models/best_temporal.keras` | ~3.9 MB |
| `public/model/tfjs_model.dvc` | `public/model/tfjs_model/` | ~2 MB |
| `public/model/static_tfjs_model.dvc` | `public/model/static_tfjs_model/` | ~1 MB |
| `public/model/verz_plus_tfjs.dvc` | `public/model/verz_plus_tfjs/` | ~2 MB |
| `models/hight_quality_realistic_man_character.glb.dvc` | `models/hight_quality_realistic_man_character.glb` | ~31 MB |
| `public/models.dvc` | `public/models/` | ~48 MB |

## Export Pipeline

The Keras model is exported to TF.js float16 format for browser inference:

- **Format:** TF.js float16
- **Output:** `public/model/tfjs_model/`
- **Minimum accuracy to export:** 90% (configured in `ml/configs/train_temporal.yaml`)

## Known Limitations

- Model is trained on ISL (Indian Sign Language) only
- Performance may degrade under poor lighting or non-frontal camera angles
- Operating conditions: good light, plain background, frontal camera (as per paper)
- Latency numbers from CI/CPU runners should **not** be used as paper latency figures
