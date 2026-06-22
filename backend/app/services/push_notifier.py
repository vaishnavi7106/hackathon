"""Web Push notification service using VAPID (pywebpush).

Sends 6am daily farm task notifications to all subscribed farmers.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
from pywebpush import webpush, WebPushException
from sqlalchemy import select

from app.config import get_settings
from app.db.models.push_subscription import PushSubscription
from app.db.session import AsyncSessionLocal  # async_sessionmaker instance

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tamil and English notification templates
# ---------------------------------------------------------------------------

_MESSAGES = {
    "ta": {
        "title": "உழவர் AI 🌾 — இன்றைய பண்ணை பணி",
        "body_irrigate": "💧 இன்று {minutes} நிமிடம் நீர் பாய்ச்சவும் — {stage}",
        "body_skip": "✅ இன்று நீர்பாசனம் தேவையில்லை — {stage}",
        "body_fert": "🌱 இன்று உரம் இடவும் — {stage}",
        "body_default": "இன்றைய நீர் மற்றும் உர பரிந்துரை காண திறக்கவும்.",
        "url": "/soil",
    },
    "en": {
        "title": "Uzhavar AI 🌾 — Today's Farm Tasks",
        "body_irrigate": "💧 Irrigate {minutes} min today — {stage}",
        "body_skip": "✅ Skip irrigation today — {stage}",
        "body_fert": "🌱 Apply fertilizer today — {stage}",
        "body_default": "Open to see today's water and fertilizer recommendations.",
        "url": "/soil",
    },
}


def _build_payload(lang: str, irrigation: str | None, minutes: int | None, stage: str, fertilizer_due: bool) -> dict:
    msgs = _MESSAGES.get(lang, _MESSAGES["ta"])
    if fertilizer_due:
        body = msgs["body_fert"].format(stage=stage)
    elif irrigation == "irrigate" and minutes:
        body = msgs["body_irrigate"].format(minutes=minutes, stage=stage)
    elif irrigation in ("skip", "skip_rain"):
        body = msgs["body_skip"].format(stage=stage)
    else:
        body = msgs["body_default"]

    return {
        "title": msgs["title"],
        "body": body,
        "url": msgs["url"],
        "icon": "/icon-192.png",
        "badge": "/badge-72.png",
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
    }


def _send_one(subscription: PushSubscription, payload: dict) -> bool:
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_public_key:
        return False

    sub_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }

    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None) if e.response else None
        if status in (404, 410):
            # Subscription expired — signal caller to remove it
            raise
        log.warning("push_send_failed: %s", repr(str(e)))
        return False
    except Exception as e:
        log.warning("push_send_error: %s", repr(str(e)))
        return False


# ---------------------------------------------------------------------------
# APScheduler 6am job
# ---------------------------------------------------------------------------

async def send_daily_notifications() -> None:
    """Send 6am daily farm task notifications to all subscribed farmers.

    Runs as an APScheduler cron job. Fetches each subscription, computes
    a daily recommendation for that farmer's profile, and sends a push.
    Expired subscriptions (HTTP 404/410) are removed from the DB.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        log.info("push_notifications_skipped: VAPID key not configured")
        return

    from app.db.models.farmer import Farmer
    from pillar2.daily import compute_daily_recommendation

    expired_endpoints: list[str] = []

    async with AsyncSessionLocal() as db:
        # Join push_subscriptions with farmers to get profile data
        result = await db.execute(
            select(PushSubscription, Farmer).join(
                Farmer, Farmer.farmer_id == PushSubscription.farmer_id
            )
        )
        rows = result.all()

    log.info("push_daily_job: sending to %d subscriptions", len(rows))

    for sub, farmer in rows:
        try:
            # Compute recommendation for this farmer
            district = farmer.district or "chennai"
            crop = farmer.primary_crop or "rice"
            land = float(farmer.land_size_acres or 1.0)
            irrigation = farmer.irrigation_type or "canal"
            lang = farmer.preferred_language or "ta"

            rec = await compute_daily_recommendation(
                district=district,
                crop=crop,
                stage_days=0,  # conservative — stage_days not stored on profile
                land_acres=land,
                irrigation_type=irrigation,
                yesterday_rain_mm=0.0,
                lang=lang,
            )

            # Build human-friendly stage name
            stage = rec.get("display_stage_ta" if lang == "ta" else "display_stage", "")

            payload = _build_payload(
                lang=lang,
                irrigation=rec.get("irrigation_recommended"),
                minutes=rec.get("irrigation_minutes"),
                stage=stage,
                fertilizer_due=bool(rec.get("fertilizer_due")),
            )

            _send_one(sub, payload)

        except WebPushException:
            # Expired subscription
            expired_endpoints.append(sub.endpoint)
        except Exception as e:
            log.warning("push_job_farmer_error: farmer=%s err=%s", str(farmer.farmer_id), repr(str(e)))

    # Remove expired subscriptions
    if expired_endpoints:
        async with AsyncSessionLocal() as db:
            for ep in expired_endpoints:
                await db.execute(
                    PushSubscription.__table__.delete().where(
                        PushSubscription.endpoint == ep
                    )
                )
            await db.commit()
        log.info("push_removed_expired: count=%d", len(expired_endpoints))
