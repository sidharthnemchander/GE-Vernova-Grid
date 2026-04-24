from pydantic import BaseModel, Field
from typing import Literal


# ── Incoming 

class SensorReading(BaseModel):
    """A single row of sensor data from the grid."""
    Ia: float = Field(..., description="Phase A current (Amperes)")
    Ib: float = Field(..., description="Phase B current (Amperes)")
    Ic: float = Field(..., description="Phase C current (Amperes)")
    Va: float = Field(..., description="Phase A voltage (per unit)")
    Vb: float = Field(..., description="Phase B voltage (per unit)")
    Vc: float = Field(..., description="Phase C voltage (per unit)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "Ia": -151.29,
                "Ib": -9.68,
                "Ic": 85.80,
                "Va": 0.40,
                "Vb": -0.13,
                "Vc": -0.27,
            }
        }
    }


class BatchReadings(BaseModel):
    readings: list[SensorReading] = Field(
        ..., min_length=1, description="Send at least 1 reading — padded internally"
    )


# ── Outgoing 

class SensorContribution(BaseModel):
    sensor: str
    impact: float
    direction: str


class PredictionResponse(BaseModel):
    is_fault: bool
    confidence: float
    severity: Literal[" CRITICAL", " HIGH", " MEDIUM", " LOW", " NORMAL"]
    top_sensors: list[SensorContribution]
    lstm_error: float
    threshold: float


class AlertRecord(BaseModel):
    alert_id: int
    is_fault: bool
    severity: str
    confidence: float
    top_sensors: list[SensorContribution]
    timestamp: str


class FaultTypeResponse(BaseModel):
    fault_type: str
    is_fault: bool
    sensor_readings: dict[str, float]


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    threshold: float
    version: str