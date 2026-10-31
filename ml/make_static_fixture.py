"""
Build the CI fixture for the static model from the VALIDATION split.

Run once on your laptop:
    python ml/make_static_fixture.py

Reads ml/data_processed/static/ (per-class .npy files, shape 2x21x3 = 126 features)
Reproduces the train_test_split(test_size=0.2, stratify=y, random_state=42) used
during training, so the fixture contains only validation samples.
Writes scripts/fixtures/static_X.npy, static_y.npy, static_meta.json
Threshold = measured fixture accuracy minus 5 percentage points.
"""
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from sklearn.model_selection import train_test_split

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'ml', 'data_processed', 'static')
MODEL = os.path.join(ROOT, 'public', 'model', 'static.onnx')
OUT = os.path.join(ROOT, 'scripts', 'fixtures')
PER_CLASS = 8

# -- Load all samples from per-class subdirs ----------------------------------
print('Loading data from', DATA_DIR)
classes = sorted(os.listdir(DATA_DIR))
X_all, y_all = [], []
for idx, cls in enumerate(classes):
    cls_dir = os.path.join(DATA_DIR, cls)
    if not os.path.isdir(cls_dir):
        continue
    for fname in sorted(os.listdir(cls_dir)):
        if not fname.endswith('.npy'):
            continue
        arr = np.load(os.path.join(cls_dir, fname))
        X_all.append(arr.flatten().astype(np.float32))
        y_all.append(idx)

X_all = np.stack(X_all)
y_all = np.array(y_all, dtype=np.int64)
print('Total: X=%s y=%s classes=%d range=%d-%d' % (
    X_all.shape, y_all.shape, len(classes), y_all.min(), y_all.max()))

if X_all.shape[1] != 126:
    sys.exit('ERROR: expected 126 features, got %d' % X_all.shape[1])

# -- Reproduce the exact train/val split from training ------------------------
_, X_val, _, y_val = train_test_split(
    X_all, y_all, test_size=0.2, stratify=y_all, random_state=42)
print('Val split: X=%s y=%s' % (X_val.shape, y_val.shape))

# -- Sample PER_CLASS samples per class from val set --------------------------
sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
n_classes = sess.get_outputs()[0].shape[-1]

rng = np.random.default_rng(42)
idx = np.concatenate([
    rng.permutation(np.where(y_val == c)[0])[:PER_CLASS]
    for c in np.unique(y_val)
])
Xf, yf = X_val[idx], y_val[idx]

# -- Measure accuracy ---------------------------------------------------------
preds = sess.run(None, {sess.get_inputs()[0].name: Xf})[0].argmax(1)
acc = float((preds == yf).mean())
print('Fixture: %d samples, %d classes, val accuracy %.2f%%' % (
    len(yf), len(np.unique(yf)), acc * 100))

if acc < 0.5:
    sys.exit('Accuracy below 50%% -- labels may be offset or wrong dataset. Not writing.')

threshold = max(0.0, np.floor((acc - 0.05) * 100) / 100)
os.makedirs(OUT, exist_ok=True)
np.save(os.path.join(OUT, 'static_X.npy'), Xf)
np.save(os.path.join(OUT, 'static_y.npy'), yf)
json.dump({
    'source': 'ml/data_processed/static/, val split (train_test_split test_size=0.2 random_state=42), %d per class' % PER_CLASS,
    'n_samples': int(len(yf)),
    'n_classes': int(n_classes),
    'classes': classes,
    'measured_accuracy': round(acc, 4),
    'threshold': threshold,
    'note': 'CI safeguard only. Not an accuracy result; do not cite.',
}, open(os.path.join(OUT, 'static_meta.json'), 'w'), indent=2)
print('Wrote fixture to scripts/fixtures/. Threshold set to %.0f%%' % (threshold * 100))
