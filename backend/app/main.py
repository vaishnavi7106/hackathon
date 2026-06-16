import logging
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.session import engine

settings = get_settings()

logging.basicConfig(level=settings.log_level.upper())
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(settings.log_level.upper())
    )
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure media directory exists
    Path(settings.local_media_path).mkdir(parents=True, exist_ok=True)
    yield
    # Dispose DB connection pool on shutdown
    await engine.dispose()


app = FastAPI(
    title="Uzhavar AI API",
    description="AI-Powered Agricultural Decision Support for Tamil Nadu Farmers",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handlers
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import structlog
    log = structlog.get_logger()
    log.error("unhandled_exception", path=request.url.path, error=str(exc), exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
    )


# Register routers
from app.routers import auth, diagnose, farmer, forecast, health, prescribe, schemes  # noqa: E402

app.include_router(health.router, prefix="/v1")
app.include_router(auth.router, prefix="/v1")
app.include_router(farmer.router, prefix="/v1")
app.include_router(diagnose.router, prefix="/v1")
app.include_router(prescribe.router, prefix="/v1")
app.include_router(forecast.router, prefix="/v1")
app.include_router(schemes.router, prefix="/v1/schemes", tags=["schemes"])

# Serve uploaded media files
app.mount(
    "/media",
    StaticFiles(directory=settings.local_media_path),
    name="media",
)
