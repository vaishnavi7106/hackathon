"""Pillar 5 — Outbreak Alert API endpoints."""

import uuid

from fastapi import APIRouter, status

from app.crud.outbreak import get_outbreak, list_active_outbreaks
from app.deps import DbDep
from app.exceptions import NotFoundError
from app.schemas.outbreak import ActiveOutbreaksResponse, OutbreakAlertOut, OutbreakDetectionResult

router = APIRouter(prefix="/outbreaks", tags=["outbreaks"])


@router.get("/active", response_model=ActiveOutbreaksResponse)
async def get_active_outbreaks(db: DbDep):
    """Return all active outbreak clusters for the live map."""
    alerts = await list_active_outbreaks(db)
    return ActiveOutbreaksResponse(
        outbreaks=[OutbreakAlertOut.model_validate(a) for a in alerts],
        total=len(alerts),
    )


@router.get("/{alert_id}", response_model=OutbreakAlertOut)
async def get_outbreak_by_id(alert_id: uuid.UUID, db: DbDep):
    alert = await get_outbreak(db, alert_id)
    if alert is None:
        raise NotFoundError("OutbreakAlert")
    return OutbreakAlertOut.model_validate(alert)


@router.post(
    "/run-detection",
    response_model=OutbreakDetectionResult,
    status_code=status.HTTP_200_OK,
    summary="Manually trigger outbreak detection (admin / demo)",
)
async def trigger_detection(db: DbDep):
    """Run the outbreak detection engine immediately. Useful for demos and testing."""
    from app.services.outbreak_engine import run_detection, send_alert_notifications

    alerts = await run_detection(db)
    for alert in alerts:
        await send_alert_notifications(alert, db)
    await db.commit()
    return OutbreakDetectionResult(
        alerts_created=len(alerts),
        alerts=[OutbreakAlertOut.model_validate(a) for a in alerts],
    )
