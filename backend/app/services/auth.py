import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import get_settings
from app.services.redis_client import redis_delete, redis_exists, redis_set

settings = get_settings()

SESSION_TTL = settings.jwt_expire_days * 24 * 3600


def _session_key(token_hash: str) -> str:
    return f"session:{token_hash}"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(farmer_id: uuid.UUID) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload = {
        "sub": str(farmer_id),
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


async def store_session(token: str, farmer_id: uuid.UUID) -> None:
    token_hash = _hash_token(token)
    await redis_set(_session_key(token_hash), str(farmer_id), ttl_seconds=SESSION_TTL)


async def verify_token(token: str) -> uuid.UUID:
    """Verify JWT signature + Redis session. Returns farmer_id."""
    from app.exceptions import AuthError

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        farmer_id_str: str = payload.get("sub", "")
        if not farmer_id_str:
            raise AuthError()
    except JWTError:
        raise AuthError()

    token_hash = _hash_token(token)
    if not await redis_exists(_session_key(token_hash)):
        raise AuthError(
            message="Session expired or revoked",
            message_ta="அமர்வு காலாவதியானது. மீண்டும் உள்நுழையவும்.",
        )

    try:
        return uuid.UUID(farmer_id_str)
    except ValueError:
        raise AuthError()


async def revoke_token(token: str) -> None:
    token_hash = _hash_token(token)
    await redis_delete(_session_key(token_hash))
