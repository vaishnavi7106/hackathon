"""Web Push subscription management endpoints."""
from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import get_settings
from app.db.models.push_subscription import PushSubscription
from app.db.session import AsyncSession, get_db
from app.deps import get_current_farmer
from app.db.models.farmer import Farmer

router = APIRouter(tags=["push"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentFarmerDep = Annotated[Farmer, Depends(get_current_farmer)]


class PushSubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    lang: str = "ta"


# GET /v1/push/vapid-public-key — public key for browser subscription
@router.get("/push/vapid-public-key")
async def get_vapid_public_key() -> Any:
    settings = get_settings()
    return {"vapid_public_key": settings.vapid_public_key}


# POST /v1/push/subscribe — save (upsert) a push subscription
@router.post("/push/subscribe")
async def subscribe(
    body: PushSubscribeBody,
    farmer: CurrentFarmerDep,
    db: DbDep,
) -> Any:
    values = {
        "id": uuid.uuid4(),
        "farmer_id": farmer.farmer_id,
        "endpoint": body.endpoint,
        "p256dh": body.p256dh,
        "auth": body.auth,
        "lang": body.lang,
    }
    stmt = (
        pg_insert(PushSubscription)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["endpoint"],
            set_={"p256dh": body.p256dh, "auth": body.auth, "lang": body.lang, "farmer_id": farmer.farmer_id},
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"subscribed": True}


# DELETE /v1/push/subscribe — remove a push subscription
@router.delete("/push/subscribe")
async def unsubscribe(
    endpoint: str,
    farmer: CurrentFarmerDep,
    db: DbDep,
) -> Any:
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == endpoint,
            PushSubscription.farmer_id == farmer.farmer_id,
        )
    )
    await db.commit()
    return {"unsubscribed": True}
