import uuid
from datetime import date, timedelta

from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scheme import Scheme, SchemeDeadlineAlert, SchemeQuery


async def get_eligible_schemes(
    db: AsyncSession,
    *,
    land_acres: float | None,
    aadhaar_linked: bool,
    crops: list[str],
    district: str,
) -> list[Scheme]:
    conditions = [Scheme.is_active == True]

    if land_acres is not None:
        conditions.append(
            or_(Scheme.max_land_acres == None, Scheme.max_land_acres >= land_acres)
        )
        conditions.append(
            or_(Scheme.min_land_acres == None, Scheme.min_land_acres <= land_acres)
        )

    if not aadhaar_linked:
        conditions.append(Scheme.requires_aadhaar == False)

    result = await db.execute(
        select(Scheme).where(and_(*conditions)).order_by(Scheme.benefit_amount_num.desc().nullslast())
    )
    all_schemes = list(result.scalars().all())

    # Filter for crops and districts in Python (ARRAY overlap is more complex in SQLAlchemy)
    filtered = []
    for scheme in all_schemes:
        if scheme.eligible_crops and not any(c in scheme.eligible_crops for c in crops):
            continue
        if scheme.eligible_districts and district not in scheme.eligible_districts:
            continue
        filtered.append(scheme)

    return filtered


def get_deadline_alerts(schemes: list[Scheme]) -> list[dict]:
    today = date.today()
    alerts = []
    for scheme in schemes:
        deadline_str = scheme.application_deadline
        if not deadline_str or deadline_str.lower() == "rolling":
            continue
        try:
            deadline = date.fromisoformat(deadline_str)
        except ValueError:
            continue
        days_remaining = (deadline - today).days
        if 0 <= days_remaining <= 30:
            alerts.append(
                {
                    "scheme_id": scheme.scheme_id,
                    "name_ta": scheme.name_ta,
                    "deadline": deadline,
                    "days_remaining": days_remaining,
                    "urgent": days_remaining <= 7,
                }
            )
    return sorted(alerts, key=lambda x: x["days_remaining"])


async def create_scheme_query(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID | None,
    query_text: str,
    language: str,
    schemes_ctx: list,
    llm_response: str | None,
    latency_ms: int | None,
) -> SchemeQuery:
    query = SchemeQuery(
        farmer_id=farmer_id,
        query_text=query_text,
        language=language,
        schemes_ctx=schemes_ctx,
        llm_response=llm_response,
        latency_ms=latency_ms,
    )
    db.add(query)
    await db.flush()
    await db.refresh(query)
    return query


async def get_scheme_by_id(db: AsyncSession, scheme_id: str) -> Scheme | None:
    result = await db.execute(select(Scheme).where(Scheme.scheme_id == scheme_id))
    return result.scalar_one_or_none()
