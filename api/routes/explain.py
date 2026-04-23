import numpy as np
from fastapi import APIRouter, HTTPException
from api.schemas import SensorReading, SensorContribution
from api.model_loader import store, SENSOR_COLS
from ml.explainability import explain_with_shap, get_top_contributing_sensors
from pydantic import BaseModel

router = APIRouter(prefix="/explain", tags=["Explainability"])


class ExplainResponse(BaseModel):
    sensor_readings: dict[str, float]
    top_contributors: list[SensorContribution]
    interpretation: str   # plain English summary


@router.post("/", response_model=ExplainResponse)
async def explain_reading(reading: SensorReading):
    """
    Send a single sensor reading.
    Returns which sensors are most responsible for the anomaly score.
    Perfect for the 'Why was this flagged?' panel in the dashboard.
    """
    X = np.array([[getattr(reading, col) for col in SENSOR_COLS]], dtype=np.float32)
    X_scaled = store.scaler.transform(X)

    shap_values = explain_with_shap(store.if_model, X_scaled, SENSOR_COLS)
    top = get_top_contributing_sensors(shap_values, 0, SENSOR_COLS, top_n=3)

    # Build plain English interpretation
    primary = top[0]
    interpretation = (
        f"{primary['sensor']} is the primary driver — "
        f"it is {primary['direction']} with an impact score of {abs(primary['impact']):.3f}. "
        f"This pattern is consistent with a grid fault signature."
    )

    return ExplainResponse(
        sensor_readings  = {col: getattr(reading, col) for col in SENSOR_COLS},
        top_contributors = [SensorContribution(**s) for s in top],
        interpretation   = interpretation,
    )