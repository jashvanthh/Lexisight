#!/usr/bin/env python3
"""
LexiSight -- DVC Experiment Training Runner
Trains an ISL landmark classification model using hyperparameters tracked by DVC.
Reads parameters from ml/params.yaml and exports metrics to ml/eval/experiment_metrics.json.
"""

import os
import sys
import json
from pathlib import Path
import yaml
import numpy as np
from sklearn.model_selection import train_test_split

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import tensorflow as tf
from tensorflow.keras import layers, Model

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_DIR = BASE_DIR / "ml"
PARAMS_FILE = ML_DIR / "params.yaml"
OUTPUT_DIR = ML_DIR / "models"
EVAL_DIR = ML_DIR / "eval"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
EVAL_DIR.mkdir(parents=True, exist_ok=True)

def main():
    print("=" * 60)
    print("LexiSight -- Running High-Performance DVC Experiment")
    print("=" * 60)

    # 1. Load parameters from ml/params.yaml
    with open(PARAMS_FILE, "r", encoding="utf-8") as f:
        params_all = yaml.safe_load(f)
    params = params_all.get("experiment", {})

    input_dim = int(params.get("input_dim", 126))
    num_classes = int(params.get("num_classes", 35))
    hidden_units = int(params.get("hidden_units", 256))
    dropout = float(params.get("dropout", 0.2))
    lr = float(params.get("lr", 0.002))
    batch_size = int(params.get("batch_size", 16))
    epochs = int(params.get("epochs", 35))

    print(f"Hyperparameters: epochs={epochs}, batch_size={batch_size}, lr={lr}, hidden={hidden_units}, dropout={dropout}")

    # 2. Load dataset
    x_path = BASE_DIR / "scripts" / "fixtures" / "static_X.npy"
    y_path = BASE_DIR / "scripts" / "fixtures" / "static_y.npy"
    if not (x_path.exists() and y_path.exists()):
        raise FileNotFoundError(f"Missing fixture dataset: {x_path} or {y_path}")

    X = np.load(x_path)
    y = np.load(y_path)
    print(f"Loaded dataset: {X.shape[0]} samples, {X.shape[1]} features, {len(np.unique(y))} classes")

    # 3. Stratified Train/Val split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # 4. Build Model Architecture with BatchNormalization for high accuracy
    inputs = layers.Input(shape=(input_dim,))
    x = layers.Dense(hidden_units, activation="relu")(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Dense(hidden_units // 2, activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = Model(inputs=inputs, outputs=outputs, name="dvc_high_acc_model")
    optimizer = tf.keras.optimizers.Adam(learning_rate=lr)
    model.compile(
        optimizer=optimizer,
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )

    # 5. Train
    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        verbose=1
    )

    # 6. Evaluate metrics
    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    train_loss, train_acc = model.evaluate(X_train, y_train, verbose=0)

    print("-" * 60)
    print(f"Results: Train Acc={train_acc*100:.2f}%, Val Acc={val_acc*100:.2f}%, Val Loss={val_loss:.4f}")
    print("-" * 60)

    # 7. Save outputs for DVC tracking
    model_save_path = OUTPUT_DIR / "experiment_model.keras"
    model.save(str(model_save_path))
    print(f"Saved model to: {model_save_path}")

    metrics_save_path = EVAL_DIR / "experiment_metrics.json"
    metrics_data = {
        "val_accuracy": round(float(val_acc), 4),
        "val_loss": round(float(val_loss), 4),
        "train_accuracy": round(float(train_acc), 4),
        "train_loss": round(float(train_loss), 4)
    }
    with open(metrics_save_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved metrics to: {metrics_save_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()
