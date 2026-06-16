import json
from typing import Any

import redis.asyncio as aioredis

from app.config import get_settings

settings = get_settings()

_pool: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _pool


async def redis_get(key: str) -> Any | None:
    client = get_redis()
    raw = await client.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw


async def redis_set(key: str, value: Any, ttl_seconds: int | None = None) -> None:
    client = get_redis()
    serialized = json.dumps(value) if not isinstance(value, str) else value
    if ttl_seconds:
        await client.setex(key, ttl_seconds, serialized)
    else:
        await client.set(key, serialized)


async def redis_delete(key: str) -> None:
    client = get_redis()
    await client.delete(key)


async def redis_exists(key: str) -> bool:
    client = get_redis()
    return bool(await client.exists(key))
