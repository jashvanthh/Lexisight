#!/usr/bin/env python3
"""
LexiSight -- Export Keras models to TFJS format manually.
Workaround for tensorflowjs numpy compatibility issues.
Saves as SavedModel first, then converts via CLI.
"""

import os, sys, json, shutil
from pathlib import Path
import tensorflow as tf
import numpy as np

BASE_DIR = Path(__file__).parent.parent.parent

sys.path.insert(0, str(BASE_DIR))
from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock
from ml.scripts.train_holistic import FocalCategoricalCrossentropy

custom_objects = {
    "PositionalEncoding": PositionalEncoding,
    "TransformerEncoderBlock": TransformerEncoderBlock,
    "FocalCategoricalCrossentropy": FocalCategoricalCrossentropy,
}


def export_to_saved_model(keras_path, saved_model_dir, name):
    """Load .keras and re-save as TF SavedModel."""
    print(f"\n--- {name} ---")
    if not keras_path.exists():
        print(f"  SKIP: {keras_path} not found")
        return False
    
    model = tf.keras.models.load_model(str(keras_path), custom_objects=custom_objects)
    print(f"  Input: {model.inputs[0].shape}")
    print(f"  Output: {model.outputs[0].shape}")
    
    # Save as SavedModel
    if os.path.exists(saved_model_dir):
        shutil.rmtree(saved_model_dir)
    model.export(saved_model_dir)
    print(f"  SavedModel saved to {saved_model_dir}")
    return True


def convert_to_tfjs_manual(model, output_dir, name):
    """Manually create TFJS LayersModel format from a Keras model."""
    print(f"\n--- Converting {name} to TFJS ---")
    
    out = Path(output_dir)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    
    # Build topology (model.json)
    config = model.get_config()
    
    # Collect weights
    weight_specs = []
    weight_data = bytearray()
    
    for layer in model.layers:
        for w in layer.weights:
            w_np = w.numpy()
            # TFJS expects float32
            w_np = w_np.astype(np.float32)
            
            weight_specs.append({
                "name": w.name,
                "shape": list(w_np.shape),
                "dtype": "float32"
            })
            weight_data.extend(w_np.tobytes())
    
    # Write weights binary
    weights_bin_path = out / "group1-shard1of1.bin"
    with open(weights_bin_path, "wb") as f:
        f.write(bytes(weight_data))
    
    # Build model.json
    model_json = {
        "format": "layers-model",
        "generatedBy": "lexisight-export",
        "convertedBy": "manual",
        "modelTopology": {
            "class_name": model.__class__.__name__,
            "config": config,
            "keras_version": "3.0.0",
            "backend": "tensorflow"
        },
        "weightsManifest": [{
            "paths": ["group1-shard1of1.bin"],
            "weights": weight_specs
        }]
    }
    
    model_json_path = out / "model.json"
    with open(model_json_path, "w") as f:
        json.dump(model_json, f)
    
    total_size = weights_bin_path.stat().st_size + model_json_path.stat().st_size
    print(f"  Exported to {out} ({total_size/1024:.0f} KB)")
    print(f"  Weights: {len(weight_specs)} tensors, {weights_bin_path.stat().st_size/1024:.0f} KB")
    return True


def main():
    print("=" * 60)
    print("  LEXISIGHT MODEL EXPORT TO TFJS (Manual)")
    print("=" * 60)
    
    public_model = BASE_DIR / "public" / "model"
    
    # 1. verZ-Plus holistic temporal (live production model)
    verz_path = BASE_DIR / "training_logs" / "verz_plus_best.keras"
    if verz_path.exists():
        model = tf.keras.models.load_model(
            str(verz_path), custom_objects=custom_objects, compile=False
        )
        convert_to_tfjs_manual(model, public_model / "verz_plus_tfjs", "verZ-Plus Holistic")
        del model
        label_src = public_model / "label_map_verz_plus.json"
        if label_src.exists():
            print(f"  Label map: {label_src} ({len(json.load(open(label_src)))} classes)")
    else:
        print("verZ-Plus model not found at training_logs/verz_plus_best.keras")

    # 2. Legacy temporal model (words) — optional backup
    temporal_path = BASE_DIR / "training_logs" / "temporal_best.keras"
    if temporal_path.exists():
        model = tf.keras.models.load_model(
            str(temporal_path), custom_objects=custom_objects, compile=False
        )
        convert_to_tfjs_manual(model, public_model / "tfjs_model", "Temporal (Words)")
        del model
    else:
        print("Legacy temporal model not found")
    
    # 3. Static model (letters/digits)
    static_path = BASE_DIR / "training_logs" / "static_best.keras"
    if static_path.exists():
        model = tf.keras.models.load_model(str(static_path))
        convert_to_tfjs_manual(model, public_model / "static_tfjs_model", "Static (Letters/Digits)")
        del model
    else:
        print("Static model not found")
    
    print(f"\n{'='*60}")
    print("  EXPORT COMPLETE")
    print("  verZ-Plus: public/model/verz_plus_tfjs/model.json")
    print("  Legacy:   public/model/tfjs_model/model.json")
    print("  Static:   public/model/static_tfjs_model/model.json")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
