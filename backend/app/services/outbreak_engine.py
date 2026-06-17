"""Pillar 5 — Outbreak Detection Engine.

Runs every 6 hours (configurable) via APScheduler.
Uses union-find spatial clustering over in-memory haversine distances —
equivalent to PostGIS ST_DWithin but requires no PostGIS extension.

Algorithm:
  1. Fetch all high-confidence disease reports from the last 7 days that have GPS.
  2. Group by disease_class.
  3. For each group, build connected components: two reports are connected
     when their haversine distance ≤ CLUSTER_RADIUS_KM.
  4. Components with ≥ MIN_REPORTS members are declared outbreaks.
  5. Dedup: skip if a non-expired alert for the same disease already exists
     within CLUSTER_RADIUS_KM of the new centroid.
  6. Compute severity from report count, create OutbreakAlert row.
  7. Send FCM push and TN Agri webhook (async, non-blocking).
"""

from __future__ import annotations

import structlog
from haversine import haversine

from app.config import get_settings
from app.db.models.outbreak import DiseaseReport, OutbreakAlert

log = structlog.get_logger()
settings = get_settings()

SEVERITY_THRESHOLDS = [
    (20, "CRITICAL"),
    (10, "HIGH"),
    (6, "MEDIUM"),
    (3, "LOW"),
]


def compute_severity(report_count: int) -> str:
    for threshold, level in SEVERITY_THRESHOLDS:
        if report_count >= threshold:
            return level
    return "LOW"


# ── Clustering ─────────────────────────────────────────────────────────────────

def _union_find_clusters(
    reports: list[DiseaseReport],
    radius_km: float,
) -> list[list[DiseaseReport]]:
    """Union-find spatial clustering: two reports are in the same cluster
    if their haversine distance ≤ radius_km.
    """
    n = len(reports)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int) -> None:
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    for i in range(n):
        for j in range(i + 1, n):
            dist = haversine(
                (reports[i].latitude, reports[i].longitude),
                (reports[j].latitude, reports[j].longitude),
            )
            if dist <= radius_km:
                union(i, j)

    groups: dict[int, list[DiseaseReport]] = {}
    for i in range(n):
        root = find(i)
        groups.setdefault(root, []).append(reports[i])

    return list(groups.values())


# ── Detection ──────────────────────────────────────────────────────────────────

async def run_detection(db) -> list[OutbreakAlert]:
    """Run a full detection pass. Returns newly created OutbreakAlert objects."""
    from app.crud.outbreak import (
        create_outbreak_alert,
        find_nearby_active_outbreak,
        get_recent_reports,
    )

    radius_km = settings.outbreak_cluster_radius_km
    min_reports = settings.outbreak_min_reports

    recent = await get_recent_reports(
        db,
        days=settings.outbreak_lookback_days,
        min_confidence=settings.outbreak_confidence_threshold,
    )

    if not recent:
        log.info("outbreak_detection_no_reports")
        return []

    # Group by disease class
    by_disease: dict[str, list[DiseaseReport]] = {}
    for r in recent:
        by_disease.setdefault(r.disease_class, []).append(r)

    created: list[OutbreakAlert] = []
    for disease_class, reports in by_disease.items():
        clusters = _union_find_clusters(reports, radius_km)

        for cluster in clusters:
            if len(cluster) < min_reports:
                continue

            center_lat = sum(r.latitude for r in cluster) / len(cluster)  # type: ignore[arg-type]
            center_lng = sum(r.longitude for r in cluster) / len(cluster)  # type: ignore[arg-type]

            # Dedup: skip if alert already exists for same disease + location
            existing = await find_nearby_active_outbreak(
                db, disease_class, center_lat, center_lng,
                radius_km=radius_km, hours=24,
            )
            if existing:
                log.debug(
                    "outbreak_dedup_skipped",
                    disease_class=disease_class,
                    existing_alert_id=str(existing.alert_id),
                )
                continue

            severity = compute_severity(len(cluster))
            disease_name_ta = next(
                (r.disease_name_ta for r in cluster if r.disease_name_ta), None
            )
            alert = await create_outbreak_alert(
                db,
                disease_class=disease_class,
                disease_name_ta=disease_name_ta,
                center_lat=center_lat,
                center_lng=center_lng,
                radius_km=radius_km,
                report_count=len(cluster),
                severity=severity,
                affected_report_ids=[r.report_id for r in cluster],
            )
            created.append(alert)
            log.info(
                "outbreak_detected",
                disease_class=disease_class,
                severity=severity,
                report_count=len(cluster),
                center=(center_lat, center_lng),
                alert_id=str(alert.alert_id),
            )

    return created


async def send_alert_notifications(alert: OutbreakAlert, db) -> None:
    """Send FCM push + TN Agri webhook (HIGH/CRITICAL) + Twilio SMS (CRITICAL)."""
    from app.crud.outbreak import (
        get_farmers_near_outbreak,
        mark_alert_sent,
        mark_webhook_sent,
    )
    from app.services.fcm import send_outbreak_push
    from app.services.webhook import send_tn_agri_webhook, send_twilio_sms

    # FCM push to farmers who grow the affected crop
    farmers = await get_farmers_near_outbreak(db, alert, crop_type=alert.disease_class.split("_")[0])
    tokens = [f.fcm_token for f in farmers if f.fcm_token]

    sent = await send_outbreak_push(
        fcm_tokens=tokens,
        disease_name_ta=alert.disease_name_ta,
        disease_class=alert.disease_class,
        report_count=alert.report_count,
        severity=alert.severity,
        alert_id=str(alert.alert_id),
    )
    if sent or not tokens:
        await mark_alert_sent(db, alert)

    # TN Agri webhook — HIGH and CRITICAL only
    if alert.severity in ("HIGH", "CRITICAL"):
        ok = await send_tn_agri_webhook(
            alert_id=str(alert.alert_id),
            disease_class=alert.disease_class,
            disease_name_ta=alert.disease_name_ta,
            center_lat=alert.center_lat,
            center_lng=alert.center_lng,
            report_count=alert.report_count,
            severity=alert.severity,
            detected_at=alert.detected_at,
        )
        if ok:
            await mark_webhook_sent(db, alert)

    # Twilio SMS — CRITICAL only
    if alert.severity == "CRITICAL":
        await send_twilio_sms(
            alert_id=str(alert.alert_id),
            disease_class=alert.disease_class,
            disease_name_ta=alert.disease_name_ta,
            report_count=alert.report_count,
            center_lat=alert.center_lat,
            center_lng=alert.center_lng,
        )


# ── APScheduler job ────────────────────────────────────────────────────────────

async def outbreak_detection_job() -> None:
    """Scheduled cron job — runs inside its own DB session."""
    from app.db.session import AsyncSessionLocal

    log.info("outbreak_detection_job_start")
    async with AsyncSessionLocal() as db:
        try:
            alerts = await run_detection(db)
            for alert in alerts:
                await send_alert_notifications(alert, db)
            await db.commit()
            log.info("outbreak_detection_job_done", new_alerts=len(alerts))
        except Exception as exc:
            await db.rollback()
            log.error("outbreak_detection_job_error", error=str(exc), exc_info=exc)
