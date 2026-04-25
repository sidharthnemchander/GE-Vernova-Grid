import numpy as np
import pandas as pd
import joblib
import os
from fastapi import APIRouter
from api.model_loader import store, SENSOR_COLS
from pydantic import BaseModel

router = APIRouter(prefix="/fault-type", tags=["Fault Classification"])
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")


class FaultTypeRequest(BaseModel):
    Ia: float
    Ib: float
    Ic: float
    Va: float
    Vb: float
    Vc: float

    model_config = {
        "json_schema_extra": {
            "example": {
                "Ia": -170.47, "Ib": 9.22, "Ic": 161.25,
                "Va": 0.0545,  "Vb": -0.6599, "Vc": 0.6054
            }
        }
    }


class FaultTypeResponse(BaseModel):
    fault_type: str
    confidence: float
    sensor_readings: dict


def engineer_features(raw: dict) -> pd.DataFrame:
    """
    Computes engineered features from a single sensor reading dict.

    CRITICAL: uses ddof=1 for std (pandas default) to match training.
    Uses pd.Series.std() not np.std() — they differ by default ddof.
    Column order matches feature_col_order.pkl exactly.
    """
    Ia = raw["Ia"];  Ib = raw["Ib"];  Ic = raw["Ic"]
    Va = raw["Va"];  Vb = raw["Vb"];  Vc = raw["Vc"]

    I_vals = pd.Series([Ia, Ib, Ic])
    V_vals = pd.Series([Va, Vb, Vc])

    features = {
        "I_zero_seq":  (Ia + Ib + Ic) / 3,
        "I_imbalance": I_vals.std(ddof=1),        # ← ddof=1, matches training
        "V_imbalance": V_vals.std(ddof=1),        # ← ddof=1, matches training
        "S_a":         abs(Ia * Va),
        "S_b":         abs(Ib * Vb),
        "S_c":         abs(Ic * Vc),
        "S_total":     abs(Ia*Va) + abs(Ib*Vb) + abs(Ic*Vc),
        "V_depression": min(Va, Vb, Vc),
    }

    # Load saved column order to guarantee same sequence as training
    col_order_path = os.path.join(MODELS_DIR, "feature_col_order.pkl")
    if os.path.exists(col_order_path):
        col_order = joblib.load(col_order_path)
    else:
        # Fallback to hardcoded order if file missing
        col_order = [
            "I_zero_seq", "I_imbalance", "V_imbalance",
            "S_a", "S_b", "S_c", "S_total", "V_depression"
        ]

    return pd.DataFrame([[features[c] for c in col_order]], columns=col_order)


@router.post("/", response_model=FaultTypeResponse)
async def classify_fault_type(reading: FaultTypeRequest):
    clf_path         = os.path.join(MODELS_DIR, "fault_classifier.pkl")
    feat_scaler_path = os.path.join(MODELS_DIR, "feature_scaler.pkl")

    if not os.path.exists(clf_path) or not os.path.exists(feat_scaler_path):
        return FaultTypeResponse(
            fault_type      = "Classifier not trained — run train_fault_classifier.py",
            confidence      = 0.0,
            sensor_readings = reading.model_dump(),
        )

    clf         = joblib.load(clf_path)
    feat_scaler = joblib.load(feat_scaler_path)
    raw         = reading.model_dump()

    # Scale original 6 sensor columns
    X_orig   = pd.DataFrame([[raw[c] for c in SENSOR_COLS]], columns=SENSOR_COLS)
    X_scaled = store.scaler.transform(X_orig)

    # Engineer and scale new features
    new_feats_df     = engineer_features(raw)
    new_feats_scaled = feat_scaler.transform(new_feats_df)

    # Combine
    X_final    = np.hstack([X_scaled, new_feats_scaled])
    fault_type = clf.predict(X_final)[0]
    confidence = float(clf.predict_proba(X_final).max())

    return FaultTypeResponse(
        fault_type      = fault_type,
        confidence      = round(confidence, 4),
        sensor_readings = raw,
    )