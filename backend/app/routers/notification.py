import uuid

from fastapi import APIRouter, Query, status

from app.crud.notification import (
    delete_notification,
    get_notifications,
    get_unread_count,
    mark_all_read,
    mark_read,
)
from app.deps import CurrentFarmerIdDep, DbDep
from app.schemas.notification import NotificationListResponse, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
    unread_only: bool = Query(False),
    limit: int = Query(50, le=100),
):
    notifications = await get_notifications(db, farmer_id, unread_only=unread_only, limit=limit)
    unread_count = await get_unread_count(db, farmer_id)
    return NotificationListResponse(
        notifications=[NotificationOut.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_notification(
    notification_id: uuid.UUID,
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
):
    await mark_read(db, notification_id, farmer_id)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def read_all_notifications(farmer_id: CurrentFarmerIdDep, db: DbDep):
    await mark_all_read(db, farmer_id)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_notification(
    notification_id: uuid.UUID,
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
):
    await delete_notification(db, notification_id, farmer_id)
