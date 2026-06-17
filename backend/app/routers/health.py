from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.deps import DbDep
from app.services.llm_client import get_llm_client
from app.services.redis_client import get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: DbDep):
    components: dict = {}
    overall = "ok"

    # PostgreSQL — uses the injected session (testable via dep override)
    try:
        await db.execute(text("SELECT 1"))
        components["database"] = "ok"
    except Exception as exc:
        components["database"] = f"error: {exc}"
        overall = "degraded"

    # Redis
    try:
        redis = get_redis()
        await redis.ping()
        components["redis"] = "ok"
    except Exception as exc:
        components["redis"] = f"error: {exc}"
        overall = "degraded"

    # LLM provider
    try:
        llm = get_llm_client()
        components["llm"] = type(llm).__name__
    except Exception as exc:
        components["llm"] = f"error: {exc}"

    # ML model stubs — replaced when models are loaded on Day 6-9
    components["crop_sentinel_model"] = "not_loaded"
    components["xgboost_model"] = "not_loaded"
    components["lstm_model"] = "not_loaded"
    components["prophet_models_loaded"] = 0

    body = {
        "status": overall,
        "components": components,
        "version": "0.1.0",
    }

    if overall != "ok":
        return JSONResponse(content=body, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return body


@router.get("/")
async def root():
    return {"message": "Uzhavar AI API", "docs": "/docs"}
