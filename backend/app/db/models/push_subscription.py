"""Push subscription model — stores Web Push API subscriptions per farmer."""
from __future__ import annotations

from datetime import datetime, timezone

import uuid as _uuid
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PushSubscription(Base):
    """One row per browser/device that opted in to push notifications."""

    __tablename__ = "push_subscriptions"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    farmer_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(512), nullable=False)
    auth: Mapped[str] = mapped_column(String(128), nullable=False)
    lang: Mapped[str] = mapped_column(String(5), nullable=False, default="ta")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
