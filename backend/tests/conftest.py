"""
Shared fixtures for integration tests.

Requires a running PostgreSQL instance.  By default uses:
    postgresql+asyncpg://uzhavar:uzhavar@localhost:5432/uzhavar_test

Override with:
    TEST_DATABASE_URL=postgresql+asyncpg://... pytest

Quick setup (with docker-compose running):
    docker exec -it uzhavar_ai-postgres-1 psql -U uzhavar -c "CREATE DATABASE uzhavar_test;"
    cd backend && pytest
"""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://uzhavar:uzhavar@localhost:5432/uzhavar_test",
)


# ── Session-scoped engine — creates / drops all tables once per test run ──────

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, pool_pre_ping=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── Function-scoped session — each test rolls back completely ─────────────────

@pytest_asyncio.fixture
async def db(test_engine):
    """
    Wraps each test in a connection-level transaction that is rolled back
    after the test, keeping the DB clean without truncating.
    """
    async with test_engine.connect() as conn:
        trans = await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )
        async with session_factory() as session:
            yield session
        await trans.rollback()


# ── HTTP client with DB override ──────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db: AsyncSession):
    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def seed_crops(db: AsyncSession):
    """Insert a minimal crop set into the test DB."""
    from app.db.models.crop import Crop

    crops = [
        Crop(crop_id="rice", name_en="Rice", name_ta="நெல்", category="cereal", is_priority=True),
        Crop(
            crop_id="tomato",
            name_en="Tomato",
            name_ta="தக்காளி",
            category="vegetable",
            is_priority=True,
        ),
    ]
    db.add_all(crops)
    await db.flush()
    return crops


@pytest_asyncio.fixture
async def seed_diseases(db: AsyncSession, seed_crops):
    """Insert a minimal disease set (requires seed_crops)."""
    from app.db.models.diagnosis import Disease

    diseases = [
        Disease(
            disease_id="rice_blast",
            crop_id="rice",
            crop="rice",
            name_en="Rice Blast",
            name_ta="நெல் வெடிப்பு நோய்",
        ),
        Disease(
            disease_id="tomato_early_blight",
            crop_id="tomato",
            crop="tomato",
            name_en="Tomato Early Blight",
            name_ta="தக்காளி ஆரம்ப கருக்கல்",
        ),
    ]
    db.add_all(diseases)
    await db.flush()
    return diseases


@pytest_asyncio.fixture
async def seed_scheme(db: AsyncSession):
    """Insert one government scheme."""
    from datetime import date

    from app.db.models.scheme import GovernmentScheme

    scheme = GovernmentScheme(
        scheme_id="pm_kisan",
        name_en="PM-KISAN",
        name_ta="பிரதமர் கிசான் சம்மான் நிதி",
        level="central",
        benefit_amount="₹6,000/year",
        benefit_amount_num=6000,
        min_land_acres=0,
        requires_aadhaar=True,
        documents_required=["Aadhaar", "Bank passbook"],
        description_ta="நில உடைமையாளர் விவசாய குடும்பங்களுக்கு ஆண்டுக்கு ₹6000.",
        last_verified=date(2025, 1, 1),
        is_active=True,
    )
    db.add(scheme)
    await db.flush()
    return scheme


@pytest_asyncio.fixture
async def registered_farmer(client: AsyncClient):
    """Register a farmer and return (farmer_id, token)."""
    r = await client.post(
        "/v1/auth/register",
        json={"name": "Test Farmer", "district": "Coimbatore", "language": "ta"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    return data["farmer_id"], data["token"]
