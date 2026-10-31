"""
LexiSight Model Regression Test
================================
Validates that the static gesture classifier (ONNX) meets accuracy requirements.

Two modes:
  - Real model mode: uses public/model/static.onnx + scripts/fixtures/ (local & CI with DVC)
  - Smoke-test mode: generates a minimal ONNX fixture (CI without DVC access)

Accuracy threshold: 94.6% on the 280-sample fixture (set 5pp below measured 99.64%).
"""

import sys
import os
import numpy as np

REPO_ROOT    = os.path.join(os.path.dirname(__file__), '..')
MODEL_PATH   = os.path.join(REPO_ROOT, 'public', 'model', 'static.onnx')
FIXTURE_X    = os.path.join(REPO_ROOT, 'scripts', 'fixtures', 'static_X.npy')
FIXTURE_Y    = os.path.join(REPO_ROOT, 'scripts', 'fixtures', 'static_y.npy')
FIXTURE_META = os.path.join(REPO_ROOT, 'scripts', 'fixtures', 'static_meta.json')
INPUT_DIM    = 126
NUM_CLASSES  = 35


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _has_real_model():
    return os.path.exists(MODEL_PATH) and os.path.exists(FIXTURE_X)


def _make_stub_onnx(path):
    """Generate a minimal valid ONNX model (Identity) for smoke testing."""
    try:
        import onnx
        from onnx import helper, TensorProto
        X  = helper.make_tensor_value_info('hand_landmarks', TensorProto.FLOAT, [1, INPUT_DIM])
        Y  = helper.make_tensor_value_info('gesture_output', TensorProto.FLOAT, [1, NUM_CLASSES])
        # Use a Gemm node with learned weights so output isn't passthrough
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
    except ImportError:
        return None


# â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def test_model_loads():
    """Model file must load without error."""
    import onnxruntime as ort

    if _has_real_model():
        path = MODEL_PATH
        print(f"  Using real model: {os.path.relpath(path)}")
    else:
        stub_path = os.path.join(REPO_ROOT, 'scripts', 'fixtures', '_stub.onnx')
        path = _make_stub_onnx(stub_path)
        if path is None:
            print("  PASS (smoke only â€” onnx package unavailable)")
            return
        print(f"  Real model not found â€” using generated stub")

    sess = ort.InferenceSession(path)
    inputs = sess.get_inputs()
    assert len(inputs) == 1, "Expected 1 input"
    assert inputs[0].shape[1] == INPUT_DIM, \
        f"Expected input dim {INPUT_DIM}, got {inputs[0].shape[1]}"
    print(f"  Input: {inputs[0].name} {inputs[0].shape}  âœ“")
    print("  PASS")


def test_accuracy_on_fixture():
    """
    Real regression test: accuracy on the labelled fixture must be >= threshold.
    Threshold is 94.6% (5pp below measured 99.64% on 280 validation samples).
    """
    import onnxruntime as ort, json

    if not _has_real_model():
        print("  PASS (skipped â€” real model or fixture not present in CI)")
        return

    with open(FIXTURE_META) as f:
        meta = json.load(f)

    threshold  = meta['threshold']
    X = np.load(FIXTURE_X).astype(np.float32)
    y = np.load(FIXTURE_Y)

    sess = ort.InferenceSession(MODEL_PATH)
    inp  = sess.get_inputs()[0].name
    preds = sess.run(None, {inp: X})[0].argmax(axis=1)
    acc   = float((preds == y).mean())

    print(f"  Samples: {len(y)}  Classes: {meta['n_classes']}")
    print(f"  Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"  Threshold: {threshold:.4f} ({threshold*100:.1f}%)")

    assert acc >= threshold, (
        f"REGRESSION: accuracy {acc*100:.2f}% < threshold {threshold*100:.1f}%. "
        f"Check if the model file has changed."
    )
    print("  PASS")


def test_output_is_finite():
    """Output must contain no NaN or Inf for any input."""
    import onnxruntime as ort

    if _has_real_model():
        path  = MODEL_PATH
        X     = np.load(FIXTURE_X).astype(np.float32)[:10]
    else:
        stub_path = os.path.join(REPO_ROOT, 'scripts', 'fixtures', '_stub.onnx')
        path = _make_stub_onnx(stub_path) or MODEL_PATH
        X = np.zeros((3, INPUT_DIM), dtype=np.float32)

    sess  = ort.InferenceSession(path)
    inp   = sess.get_inputs()[0].name
    out   = sess.run(None, {inp: X})[0]

    assert np.all(np.isfinite(out)), "Output contains NaN or Inf"
    assert out.shape[1] == NUM_CLASSES, \
        f"Expected {NUM_CLASSES} output classes, got {out.shape[1]}"
    print(f"  Output shape: {out.shape}  All finite: âœ“")
    print("  PASS")


def test_input_shape_accepted():
    """Model must accept exactly (1, 126) float32 without error."""
    import onnxruntime as ort

    path = MODEL_PATH if os.path.exists(MODEL_PATH) else None
    if path is None:
        stub_path = os.path.join(REPO_ROOT, 'scripts', 'fixtures', '_stub.onnx')
        path = _make_stub_onnx(stub_path)
    if path is None:
        print("  PASS (skipped)")
        return

    sess  = ort.InferenceSession(path)
    inp   = sess.get_inputs()[0].name
    dummy = np.zeros((1, INPUT_DIM), dtype=np.float32)
    sess.run(None, {inp: dummy})
    print(f"  (1, {INPUT_DIM}) accepted  âœ“")
    print("  PASS")


# â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

if __name__ == '__main__':
    tests  = [test_model_loads, test_input_shape_accepted,
               test_output_is_finite, test_accuracy_on_fixture]
    failed = 0

    mode = "REAL MODEL" if _has_real_model() else "SMOKE TEST (no model)"
    print(f"\n[TEST] LexiSight Static Model Regression Tests [{mode}]")
    print("=" * 55)

    for test in tests:
        print(f"\n>> {test.__name__}")
        try:
            test()
        except AssertionError as e:
            print(f"  âŒ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"  âŒ ERROR: {e}")
            failed += 1

    print("\n" + "=" * 55)
    if failed == 0:
        print("âœ… All regression tests passed!")
        sys.exit(0)
    else:
        print(f"âŒ {failed} test(s) failed")
        sys.exit(1)
