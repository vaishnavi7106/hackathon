"""Pillar 5 — Outbreak Alert integration tests."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
async def seed_disease_reports(db: AsyncSession, registered_farmer):
    """Insert 5 high-confidence disease reports clustered within 10 km of each other."""
    import uuid
    from app.crud.outbreak import create_disease_report
    from app.schemas.outbreak import DiseaseReportCreate

    farmer_id, _ = registered_farmer

    # All within ~5 km of (10.85, 77.0) — Coimbatore area
    coords = [
        (10.850, 77.000),
        (10.855, 77.005),
        (10.845, 76.995),
        (10.860, 77.010),
        (10.840, 76.990),
    ]
    reports = []
    for lat, lng in coords:
        r = await create_disease_report(
            db,
            farmer_id=uuid.UUID(str(farmer_id)),
            data=DiseaseReportCreate(
                disease_class="rice_bacterial_leaf_blight",
                disease_name_ta="நெல் பாக்டீரியல் இலை கருக்கல்",
                crop_type="rice",
                confidence=0.91,
                latitude=lat,
                longitude=lng,
            ),
        )
        reports.append(r)
    return reports


@pytest.fixture
async def seed_scattered_reports(db: AsyncSession, registered_farmer):
    """Insert 3 reports > 10 km apart — should NOT form a cluster."""
    import uuid
    from app.crud.outbreak import create_disease_report
    from app.schemas.outbreak import DiseaseReportCreate

    farmer_id, _ = registered_farmer

    coords = [
        (10.0, 77.0),   # ~120 km from next
        (11.1, 78.2),   # ~120 km from first
        (9.0, 76.5),    # far from both
    ]
    reports = []
    for lat, lng in coords:
        r = await create_disease_report(
            db,
            farmer_id=uuid.UUID(str(farmer_id)),
            data=DiseaseReportCreate(
                disease_class="tomato_early_blight",
                disease_name_ta="தக்காளி ஆரம்ப கருக்கல்",
                crop_type="tomato",
                confidence=0.85,
                latitude=lat,
                longitude=lng,
            ),
        )
        reports.append(r)
    return reports


# ── CRUD tests ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_disease_report(db: AsyncSession, registered_farmer):
    import uuid
    from app.crud.outbreak import create_disease_report
    from app.schemas.outbreak import DiseaseReportCreate

    farmer_id, _ = registered_farmer
    report = await create_disease_report(
        db,
        farmer_id=uuid.UUID(str(farmer_id)),
        data=DiseaseReportCreate(
            disease_class="rice_blast",
            confidence=0.88,
            latitude=10.85,
            longitude=77.0,
        ),
    )
    assert report.report_id is not None
    assert report.disease_class == "rice_blast"
    assert report.confidence == 0.88
    assert report.latitude == 10.85
    assert report.is_confirmed is False


@pytest.mark.asyncio
async def test_list_active_outbreaks_empty(db: AsyncSession):
    from app.crud.outbreak import list_active_outbreaks

    alerts = await list_active_outbreaks(db)
    assert alerts == []


@pytest.mark.asyncio
async def test_create_outbreak_alert(db: AsyncSession):
    import uuid
    from app.crud.outbreak import create_outbreak_alert, get_outbreak

    alert = await create_outbreak_alert(
        db,
        disease_class="rice_bacterial_leaf_blight",
        disease_name_ta="நெல் பாக்டீரியல் இலை கருக்கல்",
        center_lat=10.85,
        center_lng=77.0,
        radius_km=10.0,
        report_count=5,
        severity="LOW",
        affected_report_ids=[uuid.uuid4() for _ in range(5)],
    )
    assert alert.alert_id is not None
    assert alert.severity == "LOW"
    assert alert.is_active is True
    assert alert.report_count == 5

    fetched = await get_outbreak(db, alert.alert_id)
    assert fetched is not None
    assert fetched.disease_class == "rice_bacterial_leaf_blight"


# ── Detection engine tests ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_clustering_creates_alert(db: AsyncSession, seed_disease_reports):
    from app.crud.outbreak import list_active_outbreaks
    from app.services.outbreak_engine import run_detection

    alerts = await run_detection(db)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.disease_class == "rice_bacterial_leaf_blight"
    assert alert.report_count == 5
    assert alert.severity == "LOW"  # 3–5 reports → LOW
    assert abs(alert.center_lat - 10.85) < 0.05
    assert abs(alert.center_lng - 77.0) < 0.05

    active = await list_active_outbreaks(db)
    assert any(a.alert_id == alert.alert_id for a in active)


@pytest.mark.asyncio
async def test_scattered_reports_no_alert(db: AsyncSession, seed_scattered_reports):
    from app.services.outbreak_engine import run_detection

    alerts = await run_detection(db)
    # 3 reports >10 km apart → no cluster of 3 within radius
    assert alerts == []


@pytest.mark.asyncio
async def test_dedup_prevents_duplicate_alert(db: AsyncSession, seed_disease_reports):
    from app.services.outbreak_engine import run_detection

    # First run → creates alert
    first = await run_detection(db)
    assert len(first) == 1

    # Second run within 24h → dedup skips same cluster
    second = await run_detection(db)
    assert len(second) == 0


@pytest.mark.asyncio
async def test_low_confidence_excluded_from_clustering(db: AsyncSession, registered_farmer):
    """Reports below 0.70 confidence must not enter the detection algorithm."""
    import uuid
    from app.crud.outbreak import create_disease_report
    from app.schemas.outbreak import DiseaseReportCreate
    from app.services.outbreak_engine import run_detection

    farmer_id, _ = registered_farmer
    for i in range(5):
        await create_disease_report(
            db,
            farmer_id=uuid.UUID(str(farmer_id)),
            data=DiseaseReportCreate(
                disease_class="wheat_rust",
                confidence=0.60,  # below threshold
                latitude=10.85 + i * 0.001,
                longitude=77.0 + i * 0.001,
            ),
        )

    alerts = await run_detection(db)
    wheat_alerts = [a for a in alerts if a.disease_class == "wheat_rust"]
    assert wheat_alerts == []


@pytest.mark.asyncio
async def test_reports_without_gps_excluded(db: AsyncSession, registered_farmer):
    """Reports without lat/lng must not be used for spatial clustering."""
    import uuid
    from app.crud.outbreak import create_disease_report
    from app.schemas.outbreak import DiseaseReportCreate
    from app.services.outbreak_engine import run_detection

    farmer_id, _ = registered_farmer
    for _ in range(5):
        await create_disease_report(
            db,
            farmer_id=uuid.UUID(str(farmer_id)),
            data=DiseaseReportCreate(
                disease_class="sugarcane_smut",
                confidence=0.91,
                latitude=None,
                longitude=None,
            ),
        )

    alerts = await run_detection(db)
    smut_alerts = [a for a in alerts if a.disease_class == "sugarcane_smut"]
    assert smut_alerts == []


# ── Severity tests ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_severity_thresholds():
    from app.services.outbreak_engine import compute_severity

    assert compute_severity(3) == "LOW"
    assert compute_severity(5) == "LOW"
    assert compute_severity(6) == "MEDIUM"
    assert compute_severity(9) == "MEDIUM"
    assert compute_severity(10) == "HIGH"
    assert compute_severity(19) == "HIGH"
    assert compute_severity(20) == "CRITICAL"
    assert compute_severity(50) == "CRITICAL"


# ── API endpoint tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_active_outbreaks_endpoint_empty(client):
    r = await client.get("/v1/outbreaks/active")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0
    assert data["outbreaks"] == []


@pytest.mark.asyncio
async def test_active_outbreaks_endpoint_with_data(client, seed_disease_reports):
    # Trigger detection via the manual endpoint
    r = await client.post("/v1/outbreaks/run-detection")
    assert r.status_code == 200
    result = r.json()
    assert result["alerts_created"] == 1

    r2 = await client.get("/v1/outbreaks/active")
    assert r2.status_code == 200
    data = r2.json()
    assert data["total"] == 1
    outbreak = data["outbreaks"][0]
    assert outbreak["disease_class"] == "rice_bacterial_leaf_blight"
    assert outbreak["severity"] == "LOW"
    assert outbreak["report_count"] == 5
    assert outbreak["is_active"] is True


@pytest.mark.asyncio
async def test_get_outbreak_by_id(client, seed_disease_reports):
    # Create via detection
    r = await client.post("/v1/outbreaks/run-detection")
    alert_id = r.json()["alerts"][0]["alert_id"]

    r2 = await client.get(f"/v1/outbreaks/{alert_id}")
    assert r2.status_code == 200
    assert r2.json()["alert_id"] == alert_id


@pytest.mark.asyncio
async def test_get_outbreak_not_found(client):
    import uuid
    r = await client.get(f"/v1/outbreaks/{uuid.uuid4()}")
    assert r.status_code == 404


@pytest.fixture
async def seed_stub_disease(db: AsyncSession):
    """Seed the disease the stub inference returns so diagnoses FK doesn't fail."""
    from app.db.models.diagnosis import Disease

    d = Disease(
        disease_id="rice_bacterial_leaf_blight",
        crop="rice",
        crop_id=None,
        name_en="Rice Bacterial Leaf Blight",
        name_ta="நெல் பாக்டீரியல் இலை கருக்கல்",
    )
    db.add(d)
    await db.flush()
    return d


@pytest.mark.asyncio
async def test_diagnose_creates_disease_report(client, db: AsyncSession, registered_farmer, seed_stub_disease):
    """Posting to /diagnose with GPS should auto-create a DiseaseReport."""
    import io
    from app.crud.outbreak import get_recent_reports

    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    # Minimal valid 1×1 JPEG (hard-coded, no PIL dependency)
    _TINY_JPEG = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
        b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e"
        b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
        b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
        b"\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04"
        b"\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa"
        b"\x07\"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br"
        b"\x82\t\n\x16\x17\x18\x19\x1a%&'()*456789:CDEFGHIJ"
        b"STUVWXYZ\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd4\xff\xd9"
    )
    buf = io.BytesIO(_TINY_JPEG)

    r = await client.post(
        "/v1/diagnose",
        headers=headers,
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"crop": "rice", "latitude": "10.85", "longitude": "77.0"},
    )
    assert r.status_code == 200
    assert r.json()["confidence"] == 0.91  # stub always returns 0.91

    # The high-confidence result should have written a disease_report row
    reports = await get_recent_reports(db, days=1, min_confidence=0.70)
    gps_reports = [rp for rp in reports if rp.latitude is not None]
    assert len(gps_reports) >= 1
    assert gps_reports[-1].latitude == pytest.approx(10.85)
    assert gps_reports[-1].longitude == pytest.approx(77.0)
