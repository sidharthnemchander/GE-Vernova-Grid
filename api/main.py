from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.model_loader import load_all_models, store
from api.schemas import HealthResponse
from api.routes import predict, explain, alerts, fault_type


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