"""
SMS service using Twilio Verify.

With Twilio Verify, Twilio generates and delivers the OTP — no "from" number
required. The auth router calls send_otp_sms() to trigger delivery and
check_otp_sms() to validate what the user entered.

Dev mode (no credentials): OTP is printed to console and accepted as "123456".
"""

import random
import string

from app.config import get_settings

settings = get_settings()

_DEV_OTP_STORE: dict[str, str] = {}


def _is_configured() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_verify_service_sid)


async def send_otp_sms(phone: str) -> bool:
    """Trigger OTP delivery. Returns True on success."""
    if not _is_configured():
        otp = "".join(random.choices(string.digits, k=6))
        _DEV_OTP_STORE[phone] = otp
        print(f"[DEV OTP] Phone: {phone}  OTP: {otp}")
        return True

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        verification = client.verify.v2.services(
            settings.twilio_verify_service_sid
        ).verifications.create(to=f"+91{phone}", channel="sms")
        return verification.status in ("pending", "approved")
    except Exception as e:
        print(f"[SMS ERROR] {e}")
        return False


async def check_otp_sms(phone: str, otp: str) -> bool:
    """Validate OTP entered by user. Returns True if correct."""
    if not _is_configured():
        stored = _DEV_OTP_STORE.pop(phone, None)
        return stored == otp

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        check = client.verify.v2.services(
            settings.twilio_verify_service_sid
        ).verification_checks.create(to=f"+91{phone}", code=otp)
        return check.status == "approved"
    except Exception as e:
        print(f"[SMS ERROR] {e}")
        return False
