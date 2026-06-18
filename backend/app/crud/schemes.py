import uuid
from datetime import date, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scheme import EligibilityResult, GovernmentScheme, Scheme, SchemeDeadlineAlert, SchemeQuery
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


# get_eligible_schemes() removed in migration 007 refactor.
# The router now calls list_schemes() and applies _check_scheme_criteria() per scheme
# to produce ELIGIBLE / NOT_ELIGIBLE / NEEDS_MORE_INFO results.


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


# ── EligibilityResult persistence ─────────────────────────────────────────────

async def save_eligibility_result(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID,
    scheme_id: str,
    is_eligible: bool,
    eligibility_state: str = "ELIGIBLE",
    criteria_results: dict,
    query_text: str | None = None,
    llm_response: str | None = None,
    language: str = "ta",
    latency_ms: int | None = None,
    deadline_date: date | None = None,
    days_to_deadline: int | None = None,
) -> EligibilityResult:
    result = EligibilityResult(
        farmer_id=farmer_id,
        scheme_id=scheme_id,
        is_eligible=is_eligible,
        eligibility_state=eligibility_state,
        criteria_results=criteria_results,
        query_text=query_text,
        llm_response=llm_response,
        language=language,
        latency_ms=latency_ms,
        deadline_date=deadline_date,
        days_to_deadline=days_to_deadline,
    )
    db.add(result)
    await db.flush()
    await db.refresh(result)
    return result


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
