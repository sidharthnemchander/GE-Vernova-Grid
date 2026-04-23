import numpy as np
from fastapi import APIRouter
from api.schemas import SensorReading, FaultTypeResponse
from api.model_loader import store, SENSOR_COLS
from sklearn.ensemble import RandomForestClassifier
from pydantic import BaseModel
import joblib, os

router = APIRouter(prefix="/fault-type", tags=["Fault Classification"])

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")


class FaultTypeResponse(BaseModel):
    fault_type: str
    confidence: float
    sensor_readings: dict[str, float]


@router.post("/", response_model=FaultTypeResponse)
async def classify_fault_type(reading: SensorReading):
    """
    Stage 2: Given a flagged anomaly, classify WHAT kind of fault it is.
    Uses a RandomForest trained on classData.csv fault types.
    """
    clf_path = os.path.join(MODELS_DIR, "fault_classifier.pkl")

    if not os.path.exists(clf_path):
        return FaultTypeResponse(
            fault_type      = "Classifier not trained yet — run train_fault_classifier.py",
            confidence      = 0.0,
            sensor_readings = {col: getattr(reading, col) for col in SENSOR_COLS},
        )

    clf = joblib.load(clf_path)
    X = np.array([[getattr(reading, col) for col in SENSOR_COLS]], dtype=np.float32)
    X_scaled = store.scaler.transform(X)

    fault_type  = clf.predict(X_scaled)[0]
    confidence  = float(clf.predict_proba(X_scaled).max())

    return FaultTypeResponse(
        fault_type      = fault_type,
        confidence      = round(confidence, 4),
        sensor_readings = {col: getattr(reading, col) for col in SENSOR_COLS},
    )