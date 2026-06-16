from fastapi import APIRouter, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.crud.farmer import create_farmer, get_farmer_by_phone
from app.db.models.auth import FarmerSession
from app.deps import DbDep
from app.exceptions import ConflictError, NotFoundError
from app.schemas.auth import LoginRequest, LogoutRequest, RegisterRequest, TokenResponse
from app.services.auth import create_access_token, revoke_token, store_session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbDep):
    """Register a new farmer. If phone already exists, returns the existing farmer's token."""
    if body.phone:
        existing = await get_farmer_by_phone(db, body.phone)
        if existing:
            # Idempotent: return a fresh token for the existing farmer
            token, expires_at = create_access_token(existing.farmer_id)
            await store_session(token, existing.farmer_id)
            db.add(
                FarmerSession(
                    farmer_id=existing.farmer_id,
                    token_hash=_hash(token),
                    expires_at=expires_at,
                )
            )
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
    db.add(
        FarmerSession(
            farmer_id=farmer.farmer_id,
            token_hash=_hash(token),
            expires_at=expires_at,
        )
    )
    return TokenResponse(farmer_id=farmer.farmer_id, token=token, expires_at=expires_at)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DbDep):
    """Return a fresh token for an existing farmer."""
    farmer = await get_farmer_by_phone(db, body.phone)
    if farmer is None:
        raise NotFoundError("Farmer", detail_ta="இந்த மொபைல் எண் பதிவு செய்யப்படவில்லை.")

    token, expires_at = create_access_token(farmer.farmer_id)
    await store_session(token, farmer.farmer_id)
    db.add(
        FarmerSession(
            farmer_id=farmer.farmer_id,
            token_hash=_hash(token),
            expires_at=expires_at,
        )
    )
    return TokenResponse(farmer_id=farmer.farmer_id, token=token, expires_at=expires_at)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutRequest):
    await revoke_token(body.token)


def _hash(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()
