import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.farmer import Farmer
from app.db.session import get_db
from app.exceptions import AuthError, NotFoundError
from app.services.auth import verify_token
from app.services.llm_client import LLMClient, get_llm_client

http_bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_farmer_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
) -> uuid.UUID:
    if credentials is None:
        raise AuthError(message="Missing Authorization header")
    return await verify_token(credentials.credentials)


CurrentFarmerIdDep = Annotated[uuid.UUID, Depends(get_current_farmer_id)]


async def get_current_farmer(
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
) -> Farmer:
    from app.crud.farmer import get_farmer_by_id

    farmer = await get_farmer_by_id(db, farmer_id)
    if farmer is None:
        raise NotFoundError("Farmer", detail_ta="விவசாயி கணக்கு கண்டுபிடிக்கவில்லை.")
    return farmer


CurrentFarmerDep = Annotated[Farmer, Depends(get_current_farmer)]

LLMClientDep = Annotated[LLMClient, Depends(get_llm_client)]
