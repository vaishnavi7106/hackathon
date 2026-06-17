"""Pillar 5 — TN Agriculture Department webhook + Twilio SMS escalation.

Both are non-blocking: failures are logged silently without affecting farmers.
When TN_AGRI_WEBHOOK_URL is not set, logs a mock dispatch for demo mode.
"""

from datetime import datetime, timezone

import structlog

from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()


async def send_tn_agri_webhook(
    *,
    alert_id: str,
    disease_class: str,
    disease_name_ta: str | None,
    center_lat: float,
    center_lng: float,
    report_count: int,
    severity: str,
    detected_at: datetime,
) -> bool:
    """POST outbreak data to TN Agriculture Department.

    HIGH and CRITICAL outbreaks only. Non-blocking — returns False on failure.
    """
    payload = {
        "source": "Uzhavar AI",
        "alert_id": alert_id,
        "disease_class": disease_class,
        "disease_name_ta": disease_name_ta,
        "center_latitude": center_lat,
        "center_longitude": center_lng,
        "report_count": report_count,
        "severity": severity,
        "detected_at": detected_at.isoformat(),
        "dashboard_url": f"https://uzhavar.ai/outbreaks/{alert_id}",
    }

    if not settings.tn_agri_webhook_url:
        # Mock log for demo
        district = _lat_lng_to_district(center_lat, center_lng)
        now = datetime.now(timezone.utc).strftime("%B %d, %Y, %I:%M %p")
        log.info(
            "tn_agri_webhook_mock",
            message=f"✅ Outbreak report dispatched to TN Agriculture Department, {district} — {now}",
            payload=payload,
        )
        return True

    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(settings.tn_agri_webhook_url, json=payload)
        if resp.status_code < 300:
            log.info("tn_agri_webhook_sent", alert_id=alert_id, status=resp.status_code)
            return True
        log.error("tn_agri_webhook_failed", alert_id=alert_id, status=resp.status_code)
        return False
    except Exception as exc:
        log.error("tn_agri_webhook_error", alert_id=alert_id, error=str(exc))
        return False


async def send_twilio_sms(
    *,
    alert_id: str,
    disease_class: str,
    disease_name_ta: str | None,
    report_count: int,
    center_lat: float,
    center_lng: float,
) -> bool:
    """Twilio SMS to district Agricultural Officer — CRITICAL outbreaks only."""
    if not all([
        settings.twilio_account_sid,
        settings.twilio_auth_token,
        settings.twilio_from_number,
        settings.tn_agri_officer_phone,
    ]):
        district = _lat_lng_to_district(center_lat, center_lng)
        log.info(
            "twilio_sms_stub",
            message=(
                f"CRITICAL outbreak: {disease_name_ta or disease_class} — "
                f"{report_count} farmers in {district} cluster. "
                "Immediate field inspection required. — Uzhavar AI"
            ),
            to=settings.tn_agri_officer_phone or "<not configured>",
        )
        return True

    try:
        from twilio.rest import Client  # type: ignore[import]

        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        district = _lat_lng_to_district(center_lat, center_lng)
        body = (
            f"CRITICAL நோய் வெடிப்பு: {disease_name_ta or disease_class} — "
            f"{report_count} விவசாயிகள், {district}. "
            "உடனடி கள ஆய்வு தேவை. — Uzhavar AI"
        )
        client.messages.create(
            body=body,
            from_=settings.twilio_from_number,
            to=settings.tn_agri_officer_phone,
        )
        log.info("twilio_sms_sent", alert_id=alert_id)
        return True
    except Exception as exc:
        log.error("twilio_sms_error", alert_id=alert_id, error=str(exc))
        return False


def _lat_lng_to_district(lat: float, lng: float) -> str:
    """Rough bounding-box lookup for Tamil Nadu districts.

    Returns 'Unknown District' when no match found — accurate lookup
    requires a proper geocoding service or PostGIS reverse-geocode.
    """
    _TN_DISTRICTS = [
        ("Chennai", (12.9, 13.2, 80.1, 80.3)),
        ("Coimbatore", (10.8, 11.2, 76.9, 77.1)),
        ("Madurai", (9.8, 10.1, 78.0, 78.3)),
        ("Thanjavur", (10.6, 10.9, 79.0, 79.3)),
        ("Salem", (11.5, 11.8, 78.1, 78.3)),
        ("Tirunelveli", (8.6, 8.9, 77.6, 77.9)),
        ("Trichy", (10.7, 10.9, 78.6, 78.8)),
        ("Vellore", (12.8, 13.0, 79.1, 79.3)),
        ("Erode", (11.3, 11.5, 77.6, 77.8)),
        ("Tiruppur", (11.0, 11.2, 77.3, 77.5)),
    ]
    for name, (lat_min, lat_max, lng_min, lng_max) in _TN_DISTRICTS:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return name
    return "Tamil Nadu"
