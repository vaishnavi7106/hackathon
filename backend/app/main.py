import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.session import engine

# Ensure stdout/stderr use UTF-8 so structlog can print Tamil characters without
# crashing on Windows systems that default to cp1252 or similar narrow encodings.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

settings = get_settings()

logging.basicConfig(level=settings.log_level.upper())
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(settings.log_level.upper())
    )
)

_scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure media directory exists
    Path(settings.local_media_path).mkdir(parents=True, exist_ok=True)

    # Pillar 5 — start outbreak detection cron
    from app.services.outbreak_engine import outbreak_detection_job
    _scheduler.add_job(
        outbreak_detection_job,
        "interval",
        hours=settings.outbreak_detection_interval_hours,
        id="outbreak_detection",
        replace_existing=True,
    )
    _scheduler.start()

    yield

    # Shutdown
    _scheduler.shutdown(wait=False)
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
    try:
        # Use repr() so Unicode characters never reach a narrow-encoding console.
        log.error("unhandled_exception", path=request.url.path, error=repr(str(exc)))
    except Exception:
        pass  # never let logging crash request handling
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
    )


# Register routers
from app.routers import auth, diagnose, farmer, forecast, health, outbreak, prescribe, schemes  # noqa: E402

app.include_router(health.router, prefix="/v1")
app.include_router(auth.router, prefix="/v1")
app.include_router(farmer.router, prefix="/v1")
app.include_router(diagnose.router, prefix="/v1")
app.include_router(prescribe.router, prefix="/v1")
app.include_router(forecast.router, prefix="/v1")
app.include_router(schemes.router, prefix="/v1")
app.include_router(outbreak.router, prefix="/v1")

# Serve uploaded media files (directory is created here so StaticFiles doesn't raise on import)
Path(settings.local_media_path).mkdir(parents=True, exist_ok=True)
app.mount(
    "/media",
    StaticFiles(directory=settings.local_media_path),
    name="media",
)
