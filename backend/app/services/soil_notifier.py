"""
Daily 6am job: create in-app soil/fertilizer notifications
for farmers whose daily record shows fertilizer_due = True today.
"""
from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select

from app.db.models.daily_record import FarmDailyRecord
from app.db.models.farmer import Farmer
from app.db.session import AsyncSessionLocal

log = logging.getLogger(__name__)


async def create_soil_notifications() -> None:
    today = date.today()
    try:
        async with AsyncSessionLocal() as db:
            # Find all daily records for today where fertilizer is due
            stmt = (
                select(FarmDailyRecord)
                .where(
                    FarmDailyRecord.record_date == today,
                    FarmDailyRecord.fertilizer_due.is_(True),
                )
            )
            result = await db.execute(stmt)
            records = result.scalars().all()

            if not records:
                return

            # Batch-fetch farmers to get language preference
            farmer_ids = list({r.farmer_id for r in records})
            farmers_result = await db.execute(
                select(Farmer).where(Farmer.farmer_id.in_(farmer_ids))
            )
            farmers_by_id = {f.farmer_id: f for f in farmers_result.scalars().all()}

            from app.crud.notification import create_notification

            for record in records:
                farmer = farmers_by_id.get(record.farmer_id)
                if not farmer:
                    continue
                crop_label = getattr(record, "crop_id", None) or "பயிர்"
                cost_str = ""
                if getattr(record, "fertilizer_cost", None):
                    cost_str = f" ₹{record.fertilizer_cost:.0f}"
                try:
                    await create_notification(
                        db=db,
                        farmer_id=record.farmer_id,
                        type="soil",
                        title_en=f"Fertilizer due today — {crop_label}",
                        title_ta=f"{crop_label} — இன்று உரம் இட வேண்டும்",
                        body_en=f"Apply fertilizer to {crop_label} today.{cost_str}",
                        body_ta=f"{crop_label} க்கு இன்று உரம் இட வேண்டும்.{cost_str}",
                        action_route="/soil-optimizer",
                        action_params={"crop_id": str(record.crop_id) if record.crop_id else None},
                    )
                except Exception as e:
                    log.warning("soil_notif_create_failed farmer=%s err=%s", record.farmer_id, e)

            await db.commit()
            log.info("soil_notifications_created count=%d", len(records))

    except Exception as exc:
        log.error("create_soil_notifications_failed: %s", exc)
