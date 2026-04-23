import numpy as np
from fastapi import APIRouter
from api.schemas import AlertRecord, SensorContribution
from api.model_loader import run_prediction, SENSOR_COLS
from datetime import datetime, timezone

router = APIRouter(prefix="/alerts", tags=["Alerts"])

# In-memory alert store
_alert_store: list[AlertRecord] = []
_alert_counter = 0


@router.get("/", response_model=list[AlertRecord])
async def get_recent_alerts(limit: int = 20):
    """Returns the most recent fault alerts. Used by the dashboard feed."""
    return _alert_store[-limit:][::-1]   # newest first


@router.post("/ingest", response_model=AlertRecord | dict)
async def ingest_reading(readings: list[dict]):
    """
    Internal endpoint — called when new sensor data arrives.
    Runs prediction and stores result if it's a fault.
    """
    global _alert_counter

    readings_array = np.array(
        [[r.get(col, 0.0) for col in SENSOR_COLS] for r in readings],
        dtype=np.float32,
    )

    result = run_prediction(readings_array)

    if not result.get("is_fault"):
        return {"status": "normal", "message": "No fault detected"}

    _alert_counter += 1
    alert = AlertRecord(
        alert_id    = _alert_counter,
        is_fault    = result["is_fault"],
        severity    = result["severity"],
        confidence  = result["confidence"],
        top_sensors = [SensorContribution(**s) for s in result["top_sensors"]],
        timestamp   = datetime.now(timezone.utc).isoformat(),
    )
    _alert_store.append(alert)

    return alert