# api/routes/predict.py
import numpy as np
from fastapi import APIRouter, HTTPException
from api.schemas import BatchReadings, PredictionResponse, SensorContribution
from api.model_loader import run_prediction, SENSOR_COLS

router = APIRouter(prefix="/predict", tags=["Prediction"])


@router.post("/", response_model=PredictionResponse)
async def predict_fault(payload: BatchReadings):
    """
    Send sensor readings (min 1 — we pad internally to ensure LSTM window is satisfied).
    Returns fault detection result with SHAP explanation.
    """
    # Convert pydantic models → numpy array
    readings_array = np.array(
        [[getattr(r, col) for col in SENSOR_COLS] for r in payload.readings],
        dtype=np.float32,
    )

    MIN_ROWS = 20
    if len(readings_array) < MIN_ROWS:
        repeats = int(np.ceil(MIN_ROWS / len(readings_array)))
        readings_array = np.tile(readings_array, (repeats, 1))[:MIN_ROWS]


    try:
        result = run_prediction(readings_array)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return PredictionResponse(
        is_fault    = result["is_fault"],
        confidence  = result["confidence"],
        severity    = result["severity"],
        top_sensors = [SensorContribution(**s) for s in result["top_sensors"]],
        lstm_error  = result["lstm_error"],
        threshold   = result["threshold"],
    )