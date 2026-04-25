import numpy as np
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


class FaultTypeResponse(BaseModel):
    fault_type: str
    confidence: float
    sensor_readings: dict


def engineer_features(raw: dict) -> np.ndarray:
    """Must match exactly what was used during training."""
    Ia, Ib, Ic = raw["Ia"], raw["Ib"], raw["Ic"]
    Va, Vb, Vc = raw["Va"], raw["Vb"], raw["Vc"]

    I_zero_seq  = (Ia + Ib + Ic) / 3
    I_imbalance = np.std([Ia, Ib, Ic])
    V_imbalance = np.std([Va, Vb, Vc])
    S_a         = abs(Ia * Va)
    S_b         = abs(Ib * Vb)
    S_c         = abs(Ic * Vc)
    S_total     = S_a + S_b + S_c
    V_depression = min(Va, Vb, Vc)

    return np.array([[
        I_zero_seq, I_imbalance, V_imbalance,
        S_a, S_b, S_c, S_total, V_depression
    ]], dtype=np.float32)


@router.post("/", response_model=FaultTypeResponse)
async def classify_fault_type(reading: FaultTypeRequest):
    clf_path          = os.path.join(MODELS_DIR, "fault_classifier.pkl")
    feat_scaler_path  = os.path.join(MODELS_DIR, "feature_scaler.pkl")

    if not os.path.exists(clf_path):
        return FaultTypeResponse(
            fault_type      = "Classifier not trained yet — run train_fault_classifier.py",
            confidence      = 0.0,
            sensor_readings = reading.model_dump(),
        )

    clf          = joblib.load(clf_path)
    feat_scaler  = joblib.load(feat_scaler_path)

    raw = reading.model_dump()
    X_original = np.array([[raw[col] for col in SENSOR_COLS]], dtype=np.float32)
    X_scaled   = store.scaler.transform(X_original)

    new_feats        = engineer_features(raw)
    new_feats_scaled = feat_scaler.transform(new_feats)
    X_final          = np.hstack([X_scaled, new_feats_scaled])

    fault_type = clf.predict(X_final)[0]
    confidence = float(clf.predict_proba(X_final).max())

    return FaultTypeResponse(
        fault_type      = fault_type,
        confidence      = round(confidence, 4),
        sensor_readings = raw,
    )