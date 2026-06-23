import hashlib
import secrets

from fastapi import APIRouter, Header, HTTPException, status

from app.crud.farmer import create_farmer, get_farmer_by_phone
from app.db.models.auth import FarmerSession
from app.deps import DbDep
from app.exceptions import NotFoundError
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RegisterRequest,
    SendOtpRequest,
    SendOtpResponse,
    TokenResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services.auth import create_access_token, revoke_token, store_session
from app.services.redis_client import redis_delete, redis_get, redis_set
from app.services.sms import check_otp_sms, send_otp_sms

router = APIRouter(prefix="/auth", tags=["auth"])

_REG_TOKEN_TTL = 900  # 15 minutes


@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp(body: SendOtpRequest):
    """Trigger OTP delivery to the phone number."""
    await send_otp_sms(body.phone)
    return SendOtpResponse(success=True, expires_in=300)


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(body: VerifyOtpRequest, db: DbDep):
    """Verify OTP. Returns JWT for existing farmer, or registration_token for new farmer."""
    ok = await check_otp_sms(body.phone, body.otp)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    farmer = await get_farmer_by_phone(db, body.phone)
    if farmer:
        token, expires_at = create_access_token(farmer.farmer_id)
        await store_session(token, farmer.farmer_id)
        db.add(FarmerSession(
            farmer_id=farmer.farmer_id,
            token_hash=_hash(token),
            expires_at=expires_at,
        ))
        return VerifyOtpResponse(
            is_new_user=False,
            token=token,
            farmer_id=farmer.farmer_id,
            expires_at=expires_at,
        )

    reg_token = secrets.token_urlsafe(32)
    await redis_set(f"reg:{body.phone}", {"token": reg_token}, ttl_seconds=_REG_TOKEN_TTL)
    return VerifyOtpResponse(
        is_new_user=True,
        registration_token=reg_token,
        phone=body.phone,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: DbDep,
    authorization: str | None = Header(default=None),
):
    """Register a new farmer. Requires Authorization: Bearer <registration_token> when phone is provided."""
    if body.phone:
        reg_token = _extract_bearer(authorization)
        stored = await redis_get(f"reg:{body.phone}")
        if not stored or stored.get("token") != reg_token:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired registration token. Please verify your phone again.",
            )
        await redis_delete(f"reg:{body.phone}")

        existing = await get_farmer_by_phone(db, body.phone)
        if existing:
            token, expires_at = create_access_token(existing.farmer_id)
            await store_session(token, existing.farmer_id)
            db.add(FarmerSession(
                farmer_id=existing.farmer_id,
                token_hash=_hash(token),
                expires_at=expires_at,
            ))
            return TokenResponse(farmer_id=existing.farmer_id, token=token, expires_at=expires_at)

    farmer = await create_farmer(
        db,
        phone=body.phone,
        name=body.name,
        district=body.district,
        village=body.village,
        language=body.language,
    )
    token, expires_at = create_access_token(farmer.farmer_id)
    await store_session(token, farmer.farmer_id)
    db.add(FarmerSession(
        farmer_id=farmer.farmer_id,
        token_hash=_hash(token),
        expires_at=expires_at,
    ))
    return TokenResponse(farmer_id=farmer.farmer_id, token=token, expires_at=expires_at)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DbDep):
    """Legacy phone-only login for backward compat."""
    farmer = await get_farmer_by_phone(db, body.phone)
    if farmer is None:
        raise NotFoundError("Farmer", detail_ta="இந்த மொபைல் எண் பதிவு செய்யப்படவில்லை.")
    token, expires_at = create_access_token(farmer.farmer_id)
    await store_session(token, farmer.farmer_id)
    db.add(FarmerSession(
        farmer_id=farmer.farmer_id,
        token_hash=_hash(token),
        expires_at=expires_at,
    ))
    return TokenResponse(farmer_id=farmer.farmer_id, token=token, expires_at=expires_at)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutRequest):
    await revoke_token(body.token)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        return ""
    return authorization[7:]
