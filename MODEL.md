# LexiSight Model Card

> [!IMPORTANT]
> LexiSight uses **two separate models** for different tasks.
> The 81.34% figure in the paper is for the **temporal word model** (263 classes).
> The 93.9% figure is for the **static fingerspelling model** (35 classes: digits 1-9 + letters A-Z).
> These are different models evaluated on different tasks. Do not mix them.
> NOTE: The static model has 35 output classes. Digit 0 is not in the training set and cannot be predicted.

---

## Model 1 — Temporal Transformer (Word-Level ISL Signs)

| Field | Value |
|---|---|
| **Task** | Recognise ISL words from 30-frame landmark sequences |
| **Paper result** | **81.34% top-1 val accuracy** (263 classes, 80/20 stratified split) |
| **Checkpoint file** | Not identified — see warning below |
| **DVC pointer** | Not identified |
| **Deployed as** | `public/model/tfjs_model/` (TF.js float16, 1.24 MB) |
| **Classes** | 261 active out of 263 in label map |
| **Architecture** | 2-block Multi-Head Attention Transformer |
| **Epochs trained** | 60 (early stop at epoch 51) |
| **Best val accuracy** | 93.57% (this is on the DEPLOYED model, see note below) |

> [!WARNING]
> **Discrepancy not yet resolved:** `DEPLOYED_CHECKPOINTS.md` records 93.57% for
> `holistic_v2_best.keras`, but the paper reports 81.34%. These numbers are from
> different models or different splits. The **checkpoint that produced 81.34% has
> not been identified**. The deployed file (`holistic_v2_best.keras`) is the best
> available temporal model but its val accuracy (93.57%) does not match the paper.
> Until the correct checkpoint is found, write "checkpoint not identified" in the paper
> and do not link any file to the 81.34% result.

### Confirmed Training Settings (Temporal)

| Setting | Value | Confirmed? |
|---|---|---|
| Sequence length | 30 frames | CONFIRMED |
| Input features | 126 (2 hands x 21 landmarks x 3 coords) | CONFIRMED |
| Embedding dim (d_model) | 128 | CONFIRMED |
| Attention heads | 4 | CONFIRMED |
| Transformer layers | 2 (paper says 3 -- not yet reconciled) | UNCONFIRMED |
| Dropout | 0.20 | CONFIRMED |
| Optimizer | AdamW (weight_decay=0.01) | CONFIRMED |
| Learning rate | 0.001 (1e-3) | CONFIRMED |
| Batch size | 64 | CONFIRMED |
| Max epochs | 100 (early stop patience=20) | CONFIRMED |
| Fine-tune lr | 0.0001 (phase 2) | CONFIRMED |
| Fine-tune epochs | 50 (phase 2) | CONFIRMED |
| Val split | 80/20 stratified random (seed=42) | CONFIRMED |
| Num classes | 263 | CONFIRMED |

---

## Model 2 — Dense ResNet v3.1 (Static Fingerspelling)

| Field | Value |
|---|---|
| **Task** | Recognise static ISL letters (A-Y) and digits (0-9) from a single frame |
| **Paper result** | **93.9% top-1 val accuracy** (35 classes) |
| **Checkpoint file** | `phase2_best.keras` |
| **DVC pointer** | `training_logs/phase2_best.keras.dvc` |
| **Deployed as** | `public/model/static.onnx` (ONNX, 1.1 MB) + `public/model/static_tfjs_model/` |
| **Classes** | 35 (digits 1-9 + letters A-Z; digit 0 not in training set) |
| **Architecture** | 3 residual blocks, 256 hidden units, ReLU |

### Confirmed Training Settings (Static)

| Setting | Value | Confirmed? |
|---|---|---|
| Input dimension | 126 (2 hands x 21 landmarks x 3 coords) | CONFIRMED |
| Residual blocks | 3 | CONFIRMED |
| Hidden width | 256 | CONFIRMED |
| Activation | ReLU | CONFIRMED |
| Dropout | 0.20 | CONFIRMED |
| Optimizer | Adam (b1=0.9, b2=0.999) | CONFIRMED |
| Learning rate | 1e-3 | CONFIRMED |
| Batch size | 64 | CONFIRMED |
| Epochs | 50 + fine-tune phase | CONFIRMED |
| Val accuracy | 93.9% | CONFIRMED |

---

## Git Tag

`paper-v1` marks the code commit used for submission. The **temporal checkpoint** producing
81.34% is not yet confirmed. The **static checkpoint** (`phase2_best.keras`, 93.9%) is confirmed.

---

## CI Regression Test

The CI model regression test covers **Model 2 (static.onnx)** only:

- **280 samples** (8 per class x 35 classes) from the **validation split** (not training data)
- Fixture built with `train_test_split(test_size=0.2, stratify=y, random_state=42)` then 8 samples per class sampled with `rng(42)`
- **Measured accuracy on fixture: 93.57%**
- **Threshold: 88%** (5 percentage points below measured, to allow for sampling variance)
- **Purpose: safety check only** -- detects a broken, corrupted, or accidentally replaced `static.onnx`

> [!NOTE]
> This is a CI safeguard, not a paper result. Do not cite 93.57% as the model's validation
> accuracy -- the paper figure is 93.9% measured on the full held-out validation set.
> The fixture is a small sample (280 of ~8,400 val samples) and exists only to catch regressions.

---

## Known Limitations

- Trained on ISL (Indian Sign Language) only
- Temporal model val split is stratified random (same signers in train and val) — inflates accuracy vs signer-disjoint
- Performance degrades under poor lighting or non-frontal camera
- Latency measured on ASUS ROG G15, RTX 4060 — do not cite CI/CPU timings
