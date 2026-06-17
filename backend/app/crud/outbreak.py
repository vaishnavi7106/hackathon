"""Pillar 5 — Outbreak Alert CRUD operations."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.outbreak import DiseaseReport, OutbreakAlert
from app.schemas.outbreak import DiseaseReportCreate


async def create_disease_report(
    db: AsyncSession,
    farmer_id: uuid.UUID,
    data: DiseaseReportCreate,
) -> DiseaseReport:
    report = DiseaseReport(
        farmer_id=farmer_id,
        diagnosis_id=data.diagnosis_id,
        disease_class=data.disease_class,
        disease_name_ta=data.disease_name_ta,
        crop_type=data.crop_type,
        confidence=data.confidence,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


async def get_recent_reports(
    db: AsyncSession,
    *,
    days: int = 7,
    min_confidence: float = 0.70,
) -> list[DiseaseReport]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(DiseaseReport)
        .where(
            DiseaseReport.reported_at >= cutoff,
            DiseaseReport.confidence >= min_confidence,
            DiseaseReport.latitude.is_not(None),
            DiseaseReport.longitude.is_not(None),
        )
        .order_by(DiseaseReport.reported_at)
    )
    return list(result.scalars().all())


async def list_active_outbreaks(db: AsyncSession) -> list[OutbreakAlert]:
    result = await db.execute(
        select(OutbreakAlert)
        .where(OutbreakAlert.is_active == True)  # noqa: E712
        .order_by(OutbreakAlert.detected_at.desc())
    )
    return list(result.scalars().all())


async def get_outbreak(db: AsyncSession, alert_id: uuid.UUID) -> OutbreakAlert | None:
    result = await db.execute(
        select(OutbreakAlert).where(OutbreakAlert.alert_id == alert_id)
    )
    return result.scalar_one_or_none()


async def create_outbreak_alert(
    db: AsyncSession,
    *,
    disease_class: str,
    disease_name_ta: str | None,
    center_lat: float,
    center_lng: float,
    radius_km: float,
    report_count: int,
    severity: str,
    affected_report_ids: list[uuid.UUID],
) -> OutbreakAlert:
    alert = OutbreakAlert(
        disease_class=disease_class,
        disease_name_ta=disease_name_ta,
        center_lat=center_lat,
        center_lng=center_lng,
        radius_km=radius_km,
        report_count=report_count,
        severity=severity,
        affected_report_ids=affected_report_ids,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return alert


async def mark_alert_sent(db: AsyncSession, alert: OutbreakAlert) -> OutbreakAlert:
    alert.alert_sent = True
    await db.flush()
    return alert


async def mark_webhook_sent(db: AsyncSession, alert: OutbreakAlert) -> OutbreakAlert:
    alert.webhook_sent = True
    await db.flush()
    return alert


async def deactivate_outbreak(db: AsyncSession, alert: OutbreakAlert) -> OutbreakAlert:
    alert.is_active = False
    await db.flush()
    return alert


async def find_nearby_active_outbreak(
    db: AsyncSession,
    disease_class: str,
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    hours: int = 24,
) -> OutbreakAlert | None:
    """Return an existing active alert for same disease within radius in the last N hours."""
    from haversine import haversine

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(OutbreakAlert)
        .where(
            OutbreakAlert.disease_class == disease_class,
            OutbreakAlert.is_active == True,  # noqa: E712
            OutbreakAlert.detected_at >= cutoff,
        )
    )
    for alert in result.scalars().all():
        dist = haversine((alert.center_lat, alert.center_lng), (lat, lng))
        if dist <= radius_km:
            return alert
    return None


async def get_farmers_near_outbreak(
    db: AsyncSession,
    alert: OutbreakAlert,
    crop_type: str | None = None,
) -> list:
    """Return farmers within radius_km of the outbreak centroid who grow the affected crop."""
    from haversine import haversine
    from sqlalchemy.orm import selectinload

    from app.db.models.farmer import Farmer

    result = await db.execute(
        select(Farmer).options(selectinload(Farmer.crops))
    )
    farmers = result.scalars().all()

    # Filter by crop type if specified (precision alerting — no alert fatigue)
    nearby = []
    for farmer in farmers:
        # We don't store lat/lng on farmers directly; alert by district is the fallback
        # For now return all farmers who grow the affected crop type
        if crop_type:
            grows_crop = any(
                fc.crop.lower() == crop_type.lower() or (fc.crop_id or "").lower() == crop_type.lower()
                for fc in farmer.crops
            )
            if not grows_crop:
                continue
        nearby.append(farmer)

    return nearby
