import uuid
from datetime import date, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scheme import GovernmentScheme, Scheme, SchemeDeadlineAlert, SchemeQuery
from app.schemas.schemes import GovernmentSchemeCreate, GovernmentSchemeUpdate


# ── Admin CRUD ─────────────────────────────────────────────────────────────────

async def get_scheme(db: AsyncSession, scheme_id: str) -> GovernmentScheme | None:
    result = await db.execute(
        select(GovernmentScheme).where(GovernmentScheme.scheme_id == scheme_id)
    )
    return result.scalar_one_or_none()


# Backward-compat alias
get_scheme_by_id = get_scheme


async def list_schemes(
    db: AsyncSession,
    *,
    active_only: bool = True,
    level: str | None = None,
) -> list[GovernmentScheme]:
    conditions = []
    if active_only:
        conditions.append(GovernmentScheme.is_active == True)
    if level:
        conditions.append(GovernmentScheme.level == level)
    q = select(GovernmentScheme).order_by(
        GovernmentScheme.benefit_amount_num.desc().nullslast()
    )
    if conditions:
        q = q.where(and_(*conditions))
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_scheme(db: AsyncSession, data: GovernmentSchemeCreate) -> GovernmentScheme:
    scheme = GovernmentScheme(**data.model_dump())
    db.add(scheme)
    await db.flush()
    await db.refresh(scheme)
    return scheme


async def update_scheme(
    db: AsyncSession, scheme: GovernmentScheme, data: GovernmentSchemeUpdate
) -> GovernmentScheme:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(scheme, field, value)
    await db.flush()
    await db.refresh(scheme)
    return scheme


async def deactivate_scheme(db: AsyncSession, scheme: GovernmentScheme) -> GovernmentScheme:
    scheme.is_active = False
    await db.flush()
    return scheme


# ── Farmer-facing eligibility ──────────────────────────────────────────────────

async def get_eligible_schemes(
    db: AsyncSession,
    *,
    land_acres: float | None,
    aadhaar_linked: bool,
    crops: list[str],
    district: str,
) -> list[GovernmentScheme]:
    conditions = [GovernmentScheme.is_active == True]

    if land_acres is not None:
        conditions.append(
            or_(GovernmentScheme.max_land_acres == None, GovernmentScheme.max_land_acres >= land_acres)
        )
        conditions.append(
            or_(GovernmentScheme.min_land_acres == None, GovernmentScheme.min_land_acres <= land_acres)
        )

    if not aadhaar_linked:
        conditions.append(GovernmentScheme.requires_aadhaar == False)

    result = await db.execute(
        select(GovernmentScheme)
        .where(and_(*conditions))
        .order_by(GovernmentScheme.benefit_amount_num.desc().nullslast())
    )
    all_schemes = list(result.scalars().all())

    # Python-side array overlap (ARRAY overlap is complex in SA without raw SQL)
    filtered = []
    for scheme in all_schemes:
        if scheme.eligible_crops and not any(c in scheme.eligible_crops for c in crops):
            continue
        if scheme.eligible_districts and district not in scheme.eligible_districts:
            continue
        filtered.append(scheme)

    return filtered


def get_deadline_alerts(schemes: list[GovernmentScheme]) -> list[dict]:
    today = date.today()
    alerts = []
    for scheme in schemes:
        # Prefer the machine-readable date column
        deadline: date | None = scheme.application_deadline_date
        if deadline is None:
            # Try parsing the legacy string field
            deadline_str = scheme.application_deadline
            if not deadline_str or deadline_str.lower() in ("rolling", "ongoing", ""):
                continue
            try:
                deadline = date.fromisoformat(deadline_str[:10])
            except (ValueError, TypeError):
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


# ── Audit log ──────────────────────────────────────────────────────────────────

async def create_scheme_query(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID | None,
    query_text: str,
    language: str,
    schemes_ctx: list,
    llm_response: str | None,
    latency_ms: int | None,
    scheme_id: str | None = None,
) -> SchemeQuery:
    query = SchemeQuery(
        farmer_id=farmer_id,
        query_text=query_text,
        language=language,
        schemes_ctx=schemes_ctx,
        llm_response=llm_response,
        latency_ms=latency_ms,
        scheme_id=scheme_id,
    )
    db.add(query)
    await db.flush()
    await db.refresh(query)
    return query
