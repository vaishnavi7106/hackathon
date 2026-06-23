import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    farmer_id: uuid.UUID,
    type: str,
    title_en: str,
    title_ta: str,
    body_en: str,
    body_ta: str,
    action_route: str | None = None,
    action_params: dict | None = None,
) -> Notification:
    notif = Notification(
        farmer_id=farmer_id,
        type=type,
        title_en=title_en,
        title_ta=title_ta,
        body_en=body_en,
        body_ta=body_ta,
        icon_type=type,
        action_route=action_route,
        action_params=action_params,
    )
    db.add(notif)
    await db.flush()
    await db.refresh(notif)
    return notif


async def get_notifications(
    db: AsyncSession,
    farmer_id: uuid.UUID,
    unread_only: bool = False,
    limit: int = 50,
) -> list[Notification]:
    stmt = select(Notification).where(Notification.farmer_id == farmer_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_unread_count(db: AsyncSession, farmer_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(
        Notification.farmer_id == farmer_id,
        Notification.is_read.is_(False),
    )
    result = await db.execute(stmt)
    return result.scalar() or 0


async def mark_read(
    db: AsyncSession, notification_id: uuid.UUID, farmer_id: uuid.UUID
) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.notification_id == notification_id,
            Notification.farmer_id == farmer_id,
        )
        .values(is_read=True)
    )


async def mark_all_read(db: AsyncSession, farmer_id: uuid.UUID) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.farmer_id == farmer_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )


async def delete_notification(
    db: AsyncSession, notification_id: uuid.UUID, farmer_id: uuid.UUID
) -> None:
    await db.execute(
        delete(Notification).where(
            Notification.notification_id == notification_id,
            Notification.farmer_id == farmer_id,
        )
    )
