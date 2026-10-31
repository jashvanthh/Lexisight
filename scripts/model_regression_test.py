"""
LexiSight static-model regression test (run in CI on every push).

Checks the REAL static.onnx against a small labelled fixture set.
If the model or the fixture is missing, the test FAILS on purpose:
a test that silently passes without the model protects nothing.

Files required in the repo:
  public/model/static.onnx         (committed to Git, about 1.1 MB)
  scripts/fixtures/static_X.npy    (N x 126 float32)
  scripts/fixtures/static_y.npy    (N int, 0-indexed class ids)
  scripts/fixtures/static_meta.json (threshold and provenance)

This is a safeguard, not an accuracy result. Never cite its number.
"""
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(ROOT, 'public', 'model', 'static.onnx')
FIX_DIR = os.path.join(ROOT, 'scripts', 'fixtures')
FIX_X = os.path.join(FIX_DIR, 'static_X.npy')
FIX_Y = os.path.join(FIX_DIR, 'static_y.npy')
FIX_META = os.path.join(FIX_DIR, 'static_meta.json')
INPUT_DIM = 126


def require(path, hint):
    if not os.path.exists(path):
        raise AssertionError('Missing %s -- %s' % (os.path.relpath(path, ROOT), hint))


def load_session():
    import onnxruntime as ort
    require(MODEL_PATH, 'commit public/model/static.onnx to Git (see README)')
    return ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])


def load_fixture():
    for p in (FIX_X, FIX_Y, FIX_META):
        require(p, 'run ml/make_static_fixture.py and commit scripts/fixtures/')
    X = np.load(FIX_X).astype(np.float32)
    y = np.load(FIX_Y).astype(np.int64)
    with open(FIX_META) as f:
        meta = json.load(f)
    return X, y, meta


def test_files_present():
    require(MODEL_PATH, 'commit public/model/static.onnx to Git')
    for p in (FIX_X, FIX_Y, FIX_META):
        require(p, 'run ml/make_static_fixture.py and commit scripts/fixtures/')


def test_model_loads_with_expected_shape():
    sess = load_session()
    shape = sess.get_inputs()[0].shape
    assert shape[-1] == INPUT_DIM, 'Model input is %s, expected last dim %d' % (shape, INPUT_DIM)


def test_output_matches_fixture_classes():
    sess = load_session()
    X, y, meta = load_fixture()
    out = sess.run(None, {sess.get_inputs()[0].name: X[:4]})[0]
    assert np.all(np.isfinite(out)), 'Model output contains NaN or Inf'
    assert out.shape[1] == meta['n_classes'], \
        'Model has %d outputs, fixture expects %d classes' % (out.shape[1], meta['n_classes'])


def test_accuracy_above_threshold():
    sess = load_session()
    X, y, meta = load_fixture()
    assert X.shape[1] == INPUT_DIM, 'Fixture X is %s, expected N x %d' % (X.shape, INPUT_DIM)
    preds = sess.run(None, {sess.get_inputs()[0].name: X})[0].argmax(axis=1)
    acc = float((preds == y).mean())
    thr = float(meta['threshold'])
    print('  samples=%d  accuracy=%.2f%%  threshold=%.1f%%' % (len(y), acc * 100, thr * 100))
    assert acc >= thr, 'REGRESSION: %.2f%% < %.1f%% -- model or preprocessing changed' % (acc * 100, thr * 100)


if __name__ == '__main__':
    tests = [test_files_present, test_model_loads_with_expected_shape,
             test_output_matches_fixture_classes, test_accuracy_above_threshold]
    failed = 0
    print('LexiSight static model regression test')
    for t in tests:
        try:
            t()
            print('PASS  %s' % t.__name__)
        except Exception as e:  # noqa: BLE001
            print('FAIL  %s: %s' % (t.__name__, e))
            failed += 1
    print('%d/%d passed' % (len(tests) - failed, len(tests)))
    sys.exit(1 if failed else 0)
