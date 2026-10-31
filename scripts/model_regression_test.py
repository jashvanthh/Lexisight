"""
LexiSight Model Regression Test
================================
Validates that the static gesture classifier (ONNX) meets accuracy requirements.

In CI, static.onnx is NOT present (it is tracked by DVC, not committed to Git).
When the model is absent, the structural tests (load, shape, finite) use a
generated stub ONNX model so they still exercise real code paths.
The accuracy test is skipped only when the real model is absent; all other tests
must pass regardless.

Accuracy threshold: 85% on the 280-sample fixture set (training data).
"""

import sys
import os
import numpy as np

REPO_ROOT    = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MODEL_PATH   = os.path.join(REPO_ROOT, 'public', 'model', 'static.onnx')
FIXTURE_X    = os.path.join(REPO_ROOT, 'scripts', 'fixtures', 'static_X.npy')
FIXTURE_Y    = os.path.join(REPO_ROOT, 'scripts', 'fixtures', 'static_y.npy')
FIXTURE_META = os.path.join(REPO_ROOT, 'scripts', 'fixtures', 'static_meta.json')
INPUT_DIM    = 126
NUM_CLASSES  = 35


# -- Helpers ------------------------------------------------------------------

def _has_real_model():
    return os.path.exists(MODEL_PATH) and os.path.exists(FIXTURE_X)


def _make_stub_onnx(path):
    """Generate a minimal valid ONNX model (Gemm) for structural smoke tests.
    Returns the path on success, or None if the onnx package is not installed."""
    try:
        import onnx
        from onnx import helper, TensorProto
    except ImportError:
        return None
    X  = helper.make_tensor_value_info('hand_landmarks', TensorProto.FLOAT, [1, INPUT_DIM])
    Y  = helper.make_tensor_value_info('gesture_output', TensorProto.FLOAT, [1, NUM_CLASSES])
    W  = np.zeros((NUM_CLASSES, INPUT_DIM), dtype=np.float32)
    b  = np.zeros(NUM_CLASSES, dtype=np.float32)
    wt = helper.make_tensor('W', TensorProto.FLOAT, W.shape, W.flatten().tolist())
    bt = helper.make_tensor('B', TensorProto.FLOAT, b.shape, b.flatten().tolist())
    node = helper.make_node('Gemm', inputs=['hand_landmarks', 'W', 'B'],
                            outputs=['gesture_output'], transB=1)
    graph = helper.make_graph([node], 'stub', [X], [Y], initializer=[wt, bt])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    onnx.save(model, path)
    return path


def _get_model_path():
    """Return (path, is_stub) to real model, or generate a stub if absent.
    Returns (None, True) if neither real model nor onnx package is available."""
    if os.path.exists(MODEL_PATH):
        return MODEL_PATH, False
    stub_path = os.path.join(REPO_ROOT, 'scripts', 'fixtures', '_stub.onnx')
    print('  Real model not found -- generating stub ONNX for structural tests')
    result = _make_stub_onnx(stub_path)
    if result is None:
        print('  onnx package not installed -- cannot generate stub')
        return None, True
    return stub_path, True


# -- Tests --------------------------------------------------------------------

def test_model_loads():
    """Model file (or stub) must load and expose the expected input shape."""
    import onnxruntime as ort
    path, is_stub = _get_model_path()
    if path is None:
        print('  SKIPPED -- no model and onnx package unavailable (install: pip install onnx)')
        return
    label = 'stub' if is_stub else 'real model'
    print('  Using %s: %s' % (label, os.path.relpath(path)))
    sess = ort.InferenceSession(path)
    inputs = sess.get_inputs()
    assert len(inputs) == 1, 'Expected 1 input, got %d' % len(inputs)
    assert inputs[0].shape[1] == INPUT_DIM, \
        'Expected input dim %d, got %d' % (INPUT_DIM, inputs[0].shape[1])
    print('  Input: %s %s  OK' % (inputs[0].name, inputs[0].shape))
    print('  PASS')


def test_input_shape_accepted():
    """Model must accept exactly (1, 126) float32 without error."""
    import onnxruntime as ort
    path, _ = _get_model_path()
    if path is None:
        print('  SKIPPED -- no model and onnx package unavailable')
        return
    sess  = ort.InferenceSession(path)
    inp   = sess.get_inputs()[0].name
    dummy = np.zeros((1, INPUT_DIM), dtype=np.float32)
    sess.run(None, {inp: dummy})
    print('  (1, %d) accepted  OK' % INPUT_DIM)
    print('  PASS')


def test_output_is_finite():
    """Output must contain no NaN or Inf."""
    import onnxruntime as ort
    path, is_stub = _get_model_path()
    if path is None:
        print('  SKIPPED -- no model and onnx package unavailable')
        return
    if _has_real_model():
        X = np.load(FIXTURE_X).astype(np.float32)[:10]
    else:
        X = np.zeros((3, INPUT_DIM), dtype=np.float32)
    sess = ort.InferenceSession(path)
    inp  = sess.get_inputs()[0].name
    out  = sess.run(None, {inp: X})[0]
    assert np.all(np.isfinite(out)), 'Output contains NaN or Inf'
    assert out.shape[1] == NUM_CLASSES, \
        'Expected %d output classes, got %d' % (NUM_CLASSES, out.shape[1])
    print('  Output shape: %s  All finite: OK' % str(out.shape))
    print('  PASS')


def test_accuracy_on_fixture():
    """
    Accuracy on the labelled fixture must be >= threshold.
    SKIPPED when real model is absent (e.g. CI without DVC pull).
    All other tests still run using the stub model.
    """
    if not _has_real_model():
        print('  SKIPPED -- real model not present (CI without DVC pull)')
        print('  To enable: add dvc pull step with GDRIVE_CREDENTIALS_DATA secret')
        return

    import onnxruntime as ort
    import json

    with open(FIXTURE_META) as f:
        meta = json.load(f)

    threshold = meta['threshold']
    X = np.load(FIXTURE_X).astype(np.float32)
    y = np.load(FIXTURE_Y)

    sess  = ort.InferenceSession(MODEL_PATH)
    inp   = sess.get_inputs()[0].name
    preds = sess.run(None, {inp: X})[0].argmax(axis=1)
    acc   = float((preds == y).mean())

    print('  Samples: %d  Classes: %d' % (len(y), meta['n_classes']))
    print('  Accuracy: %.4f (%.2f%%)' % (acc, acc * 100))
    print('  Threshold: %.4f (%.1f%%)' % (threshold, threshold * 100))

    assert acc >= threshold, (
        'REGRESSION: accuracy %.2f%% < threshold %.1f%%. '
        'Check if the model file has changed.' % (acc * 100, threshold * 100)
    )
    print('  PASS')


# -- Main ---------------------------------------------------------------------

if __name__ == '__main__':
    tests  = [test_model_loads, test_input_shape_accepted,
              test_output_is_finite, test_accuracy_on_fixture]
    failed = 0

    mode = 'REAL MODEL' if _has_real_model() else 'SMOKE (stub model)'
    print('\n[TEST] LexiSight Static Model Regression Tests [%s]' % mode)
    print('=' * 55)

    for test in tests:
        print('\n>> %s' % test.__name__)
        try:
            test()
        except AssertionError as e:
            print('  FAIL: %s' % e)
            failed += 1
        except Exception as e:
            print('  ERROR: %s' % e)
            failed += 1

    print('\n' + '=' * 55)
    if failed == 0:
        print('All regression tests passed.')
        sys.exit(0)
    else:
        print('%d test(s) failed' % failed)
        sys.exit(1)
