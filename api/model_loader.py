import sys
import os
sys.path.append(os.path.abspath(".."))
import pandas as pd
import joblib
import numpy as np
import torch
import json
from dataclasses import dataclass
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

from ml.lstm_model import LSTMAutoencoder, get_reconstruction_errors
from ml.isolation_forest import get_anomaly_scores
from ml.hybrid import hybrid_predict, classify_severity
from ml.explainability import explain_with_shap, get_top_contributing_sensors
from ml.preprocess import SENSOR_COLS, create_sequences


MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
N_FEATURES = 6    # Ia, Ib, Ic, Va, Vb, Vc
TIMESTEPS  = 10


@dataclass
class ModelStore:
    """Single object that holds every model. Loaded once at startup."""
    if_model:    IsolationForest |None  = None
    lstm_model:  LSTMAutoencoder |None  = None
    scaler:      MinMaxScaler    |None  = None
    shap_values: np.ndarray      |None  = None
    threshold:   float            = 0.0
    loaded:      bool             = False
    train_err_min : float = 0.0
    train_err_max : float = 0.0


store = ModelStore()


def load_all_models() -> None:
    """
    Called once at API startup via FastAPI lifespan.
    Loads IF, LSTM, scaler from disk.
    Pre-computes SHAP values on a sample so first request isn't slow.
    """
    global store
    print(" Loading models...")

    # Isolation Forest
    store.if_model = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.pkl"))
    print("  Isolation Forest loaded")

    # LSTM Autoencoder
    store.lstm_model = LSTMAutoencoder(n_features=N_FEATURES)
    store.lstm_model.load_state_dict(
        torch.load(
            os.path.join(MODELS_DIR, "lstm_best.pt"),
            map_location="cpu",
            weights_only=True,
        )
    )
    store.lstm_model.eval()
    print("   LSTM Autoencoder loaded")

    # Scaler
    store.scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
    print("   Scaler loaded")

    threshold_path = os.path.join(MODELS_DIR, "threshold.txt")
    if os.path.exists(threshold_path):
        with open(threshold_path) as f:
            store.threshold = float(f.read().strip())
    else:
        store.threshold = 0.00678  # fallback from your training output
    print(f"   Threshold loaded: {store.threshold:.5f}")

    metadata_path = os.path.join(MODELS_DIR, "lstm_metadata.json")

    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            
        store.train_err_min = metadata["train_err_min"]
        store.train_err_max = metadata["train_err_max"]
        
        print(" LSTM Metadata (Threshold, Min, Max) loaded successfully!")
    else:
        print(" WARNING: lstm_metadata.json not found. Run training script first.")

    store.loaded = True
    print(" All models ready\n")


def run_prediction(readings_array: np.ndarray) -> dict:
    """
    Core prediction function used by all routes.
    
    readings_array shape: (N, 6) where N >= 10
    Returns a dict with all prediction details.
    """
    if not store.loaded:
        raise RuntimeError("Models not loaded. Call load_all_models() first.")

    X_scaled = store.scaler.transform(
    pd.DataFrame(readings_array, columns=SENSOR_COLS)
).astype(np.float32)

    MIN_ROWS = 20
    if len(X_scaled) < MIN_ROWS:
        repeats = int(np.ceil(MIN_ROWS / len(X_scaled)))
        X_scaled = np.tile(X_scaled, (repeats, 1))[:MIN_ROWS]
    
    _, if_labels = get_anomaly_scores(store.if_model, X_scaled)
    X_seq, _ = create_sequences(
        X_scaled,
        np.zeros(len(X_scaled)),   # dummy labels, not used for inference
        timesteps=TIMESTEPS,
    )

    if len(X_seq) == 0:
        return {"error": "Not enough readings. Send at least 10."}

    lstm_errors = get_reconstruction_errors(store.lstm_model, X_seq)

    if_labels_seq = if_labels[TIMESTEPS:]

    # Hybrid
    combined_labels, confidence_scores = hybrid_predict(
        if_labels_seq, lstm_errors, store.threshold
    )

    # Take the last prediction (most recent reading)
    is_fault       = bool(combined_labels[-1])
    confidence     = float(confidence_scores[-1])
    lstm_error     = float(lstm_errors[-1])
    severity       = classify_severity(confidence) if is_fault else "NORMAL"

    # SHAP explanation for the last sample
    shap_values = explain_with_shap(store.if_model, X_scaled, SENSOR_COLS)
    top_sensors = get_top_contributing_sensors(
        shap_values, -1, SENSOR_COLS, top_n=3
    )

    return {
        "is_fault":    is_fault,
        "confidence":  round(confidence, 4),
        "severity":    severity,
        "top_sensors": top_sensors,
        "lstm_error":  round(lstm_error, 6),
        "threshold":   round(store.threshold, 6),
    }