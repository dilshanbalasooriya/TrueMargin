from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from sqlmodel import SQLModel
from app.core.database import engine
from app.models import *

from app.core.config import settings
from app.api.v1.routers import (
    auth,
    calculation,
    cost_sheet as cost_sheets,
    library as libraries,
    exports,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    Executes startup checks and cleanup routines.
    """
    print("🚀 Initializing database tables...")
    SQLModel.metadata.create_all(engine)
    print("🚀 Starting Unit Cost Calculation SaaS Engine...")
    yield
    print("🛑 Shutting down API service...")


app = FastAPI(
    title="Unit Cost SaaS API",
    description=(
        "Accounting-grade product & service unit costing backend engine with "
        "reconciliation rules, versioning, workspace libraries, and CSV/PDF export generation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Setup
allowed_origins = (
    [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
    if settings.ALLOWED_ORIGINS
    else ["http://localhost:3000", "http://localhost:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Check Endpoint
@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
    tags=["System Health"],
    summary="Service health check",
)
def health_check():
    return {
        "status": "healthy",
        "service": "unit-cost-engine",
        "environment": settings.ENVIRONMENT,
    }


# Router Registrations
API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(calculation.router, prefix=API_V1_PREFIX)
app.include_router(cost_sheets.router, prefix=API_V1_PREFIX)
app.include_router(libraries.router, prefix=API_V1_PREFIX)
app.include_router(exports.router, prefix=API_V1_PREFIX)