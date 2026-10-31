# LexiSight Model Card — `paper-v1`

> [!IMPORTANT]
> The checkpoint that produced the **81.34% reported in the paper** is
> `training_logs/phase2_best.keras` (the two-phase training final output).
> `holistic_v2_best.keras` is a later experiment (93.57%, 261 classes, 2 blocks)
> trained on a different split — it is **not** the paper model.

## Identity

| Field | Value |
|---|---|
| **Git tag** | `paper-v1` |
| **Repository** | `github.com/jashvanthh/Lexisight` |
| **Paper model file** | `training_logs/phase2_best.keras` |
| **DVC pointer** | `training_logs/phase2_best.keras.dvc` |
| **Browser inference file** | `public/model/static.onnx` (static gesture classifier) |
| **Classes** | 263 ISL signs |
| **Input** | 30 frames × 126 features (21 landmarks × 3 coords × 2 hands) |

## Performance (Paper Numbers)

| Metric | Value | Notes |
|---|---|---|
| **Val top-1 accuracy** | 81.34% | Stratified random 80/20 split |
| **Val top-3 accuracy** | 92.25% | Same split |
| **Split strategy** | Stratified random 80/20 | ⚠ Same signers may appear in train and val — this inflates accuracy vs a signer-disjoint split |
| **Measured on** | ASUS ROG G15, RTX 4060, Chrome, localhost | CI/CPU timings must NOT be used as paper latency numbers |

> [!WARNING]
> The validation split is **not** signer-disjoint. Accuracy numbers would
> likely be lower on a fully held-out signer set. The `holistic_v3` config
> in `params.yaml` uses signer-disjoint splits for fairer future evaluation.

## Training Settings (`paper-v1`)

See [`ml/params.yaml`](ml/params.yaml) → section `temporal` for the exact values.

| Setting | Value | Confirmed? |
|---|---|---|
| Architecture | Temporal Landmark Transformer v1 | ✅ |
| Transformer layers (blocks) | **2** | ✅ (holistic_v3 uses 3 — different model) |
| Attention heads | 4 | ✅ |
| Projection dim | 128 | ✅ |
| Dropout | 0.2 | ✅ |
| Optimizer | AdamW | ✅ |
| Learning rate (phase 1) | 0.001 | ✅ |
| Learning rate (phase 2) | 0.0001 | ✅ |
| Batch size (phase 1 / phase 2) | 64 / 32 | ✅ |
| Epochs (phase 1 + phase 2) | 100 + 50 | ✅ |
| Seed | 42 | ✅ |
| Classes | 263 | ✅ |

## Model Files Tracked by DVC

| DVC Pointer | Actual File | What it is |
|---|---|---|
| `training_logs/phase2_best.keras.dvc` | `training_logs/phase2_best.keras` | **Paper model** — two-phase training final output |
| `training_logs/phase1_best.keras.dvc` | `training_logs/phase1_best.keras` | Phase 1 checkpoint |
| `training_logs/holistic_v2_best.keras.dvc` | `training_logs/holistic_v2_best.keras` | Later experiment (93.57%, 261 classes) — NOT the paper model |
| `training_logs/temporal_best.keras.dvc` | `training_logs/temporal_best.keras` | Temporal model checkpoint |
| `training_logs/temporal_v2_best.keras.dvc` | `training_logs/temporal_v2_best.keras` | Temporal v2 checkpoint |
| `training_logs/static_best.keras.dvc` | `training_logs/static_best.keras` | Static gesture classifier |
| `training_logs/static_v2_best.keras.dvc` | `training_logs/static_v2_best.keras` | Static v2 |
| `training_logs/best_static_pt.pth.dvc` | `training_logs/best_static_pt.pth` | PyTorch static checkpoint |
| `training_logs/best_static_pt.onnx.dvc` | `training_logs/best_static_pt.onnx` | ONNX export from PyTorch |
| `public/model/static.onnx.dvc` | `public/model/static.onnx` | Browser ONNX model |
| `public/model/emergency_gru.dvc` | `public/model/emergency_gru/` | GRU emergency signs |
| `public/model/alphabet_gru.dvc` | `public/model/alphabet_gru/` | GRU fingerspelling |
| `public/model/X_train.npy.dvc` | `public/model/X_train.npy` | Training dataset |
| `public/model/X_val.npy.dvc` | `public/model/X_val.npy` | Validation dataset |
| `public/model/X_test.npy.dvc` | `public/model/X_test.npy` | Test dataset |

## Reproducing This Model

```bash
# 1. Clone the repo and checkout the paper tag
git clone https://github.com/jashvanthh/Lexisight.git
cd Lexisight
git checkout paper-v1

# 2. Pull the exact model files (requires DVC + Google Drive access)
dvc pull

# 3. Retrain (optional)
python ml/train_holistic_v2.py
# Settings are read from ml/params.yaml (temporal section)
```

## What We Cannot Yet Say

- "CI checks model accuracy" — the CI model check is currently a **smoke test only**
  (it checks the model loads and outputs valid values, not that accuracy ≥ 81.34%).
  A labelled sample fixture is needed for a real regression test.
- "Results are signer-independent" — the split is stratified random, not signer-disjoint.

## Known Limitations

- Trained on ISL (Indian Sign Language) only
- Performance degrades under poor lighting or non-frontal camera angles
- Latency numbers were measured on ASUS ROG G15, RTX 4060 — CI/CPU numbers must NOT be cited
