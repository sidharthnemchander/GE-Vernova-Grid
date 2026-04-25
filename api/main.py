from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.model_loader import load_all_models, store
from api.schemas import HealthResponse
from api.routes import predict, explain, alerts, fault_type
import random
import pandas as pd


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models when API starts, clean up when it stops."""
    load_all_models()
    yield
    print(" Shutting down GridMind API")


app = FastAPI(
    title="GridMind API",
    description="""
    AI-powered electrical grid fault detection and explanation.
    Built on a hybrid Isolation Forest + LSTM Autoencoder pipeline.
    Developed as part of GE Vernova DTDP application showcase.
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# Allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routes
app.include_router(predict.router)
app.include_router(explain.router)
app.include_router(alerts.router)
app.include_router(fault_type.router)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Quick check that the API and models are alive."""
    return HealthResponse(
        status        = "operational",
        models_loaded = store.loaded,
        threshold     = store.threshold,
        version       = "1.0.0",
    )

@app.get("/sample-window/")
async def get_sample_window(fault: bool = False):
    """
    Returns 20 real sensor readings from the dataset.
    fault=false → normal readings, fault=true → fault readings
    Used by the dashboard to poll with real data.
    """
    try:
        df = pd.read_csv("data/raw/detect_dataset.csv")
        df.columns = [c.strip() for c in df.columns]
        df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
        df.dropna(inplace=True)

        label_col = "Output (S)"
        sensor_cols = ["Ia", "Ib", "Ic", "Va", "Vb", "Vc"]
        target_label = 1 if fault else 0

        subset = df[df[label_col] == target_label][sensor_cols]
        if len(subset) < 20:
            subset = df[sensor_cols]

        # Pick 20 consecutive rows starting at a random index
        start = random.randint(0, len(subset) - 20)
        window = subset.iloc[start:start+20].to_dict(orient="records")
        return {"readings": window, "is_fault_window": fault}

    except Exception as e:
        return {"error": str(e)}