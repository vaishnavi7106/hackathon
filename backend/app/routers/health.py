from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import AsyncSessionLocal
from app.services.redis_client import get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    status = {
        "status": "ok",
        "components": {},
        "version": "0.1.0",
    }

    # Check PostgreSQL
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        status["components"]["database"] = "ok"
    except Exception as exc:
        status["components"]["database"] = f"error: {exc}"
        status["status"] = "degraded"

    # Check Redis
    try:
        redis = get_redis()
        await redis.ping()
        status["components"]["redis"] = "ok"
    except Exception as exc:
        status["components"]["redis"] = f"error: {exc}"
        status["status"] = "degraded"

    # ML model stubs — will be updated when models are loaded
    status["components"]["crop_sentinel_model"] = "not_loaded"
    status["components"]["xgboost_model"] = "not_loaded"
    status["components"]["lstm_model"] = "not_loaded"
    status["components"]["prophet_models_loaded"] = 0

    return status


@router.get("/")
async def root():
    return {"message": "Uzhavar AI API", "docs": "/docs"}
