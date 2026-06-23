import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    notification_id: uuid.UUID
    farmer_id: uuid.UUID
    type: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    icon_type: str
    is_read: bool
    action_route: str | None
    action_params: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
