"""Pillar 5 — Firebase Cloud Messaging push notification service.

When FCM_SERVER_KEY is set in config, sends real FCM v1 messages.
Otherwise, logs the notification payload (demo / test mode).
"""

import structlog

from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()

_SEVERITY_ICON = {
    "LOW": "⚠️",
    "MEDIUM": "🟠",
    "HIGH": "🔴",
    "CRITICAL": "🚨",
}


def _build_notification(
    disease_name_ta: str,
    disease_class: str,
    report_count: int,
    severity: str,
    alert_id: str,
) -> dict:
    icon = _SEVERITY_ICON.get(severity, "⚠️")
    title = f"{icon} நோய் எச்சரிக்கை — {disease_name_ta or disease_class}"
    body = (
        f"உங்கள் பகுதியில் {report_count} விவசாயிகள் இதே நோயை கண்டறிந்துள்ளனர். "
        "உடனடியாக உங்கள் பயிரை சரிபார்க்கவும்."
    )
    return {
        "title": title,
        "body": body,
        "data": {
            "outbreak_id": alert_id,
            "disease_class": disease_class,
            "severity": severity,
            "deep_link": "/diagnose",
        },
    }


async def send_outbreak_push(
    *,
    fcm_tokens: list[str],
    disease_name_ta: str | None,
    disease_class: str,
    report_count: int,
    severity: str,
    alert_id: str,
) -> int:
    """Send FCM push to a list of tokens. Returns count of messages sent."""
    if not fcm_tokens:
        return 0

    notification = _build_notification(
        disease_name_ta or disease_class,
        disease_class,
        report_count,
        severity,
        alert_id,
    )

    if not settings.fcm_server_key:
        log.info(
            "fcm_push_stub",
            recipient_count=len(fcm_tokens),
            title=notification["title"],
            body=notification["body"],
            alert_id=alert_id,
        )
        return len(fcm_tokens)

    # Real FCM Legacy HTTP API call
    import httpx

    payload = {
        "registration_ids": fcm_tokens,
        "notification": {
            "title": notification["title"],
            "body": notification["body"],
        },
        "data": notification["data"],
        "priority": "high",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://fcm.googleapis.com/fcm/send",
            json=payload,
            headers={
                "Authorization": f"key={settings.fcm_server_key}",
                "Content-Type": "application/json",
            },
        )
    if resp.status_code == 200:
        result = resp.json()
        success = result.get("success", 0)
        log.info("fcm_push_sent", success=success, failure=result.get("failure", 0))
        return success
    else:
        log.error("fcm_push_failed", status=resp.status_code, body=resp.text)
        return 0
