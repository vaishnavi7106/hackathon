import pytest


@pytest.mark.asyncio
async def test_health_returns_valid_shape(client):
    r = await client.get("/v1/health")
    assert r.status_code in (200, 503)
    data = r.json()
    assert "status" in data
    assert data["status"] in ("ok", "degraded")
    assert "components" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_health_database_ok(client):
    """DB component must be 'ok' when connected to test DB."""
    r = await client.get("/v1/health")
    data = r.json()
    assert data["components"]["database"] == "ok"


@pytest.mark.asyncio
async def test_health_ml_stubs_reported(client):
    r = await client.get("/v1/health")
    data = r.json()
    assert data["components"]["crop_sentinel_model"] == "not_loaded"
    assert data["components"]["xgboost_model"] == "not_loaded"
    assert data["components"]["lstm_model"] == "not_loaded"
    assert data["components"]["prophet_models_loaded"] == 0


@pytest.mark.asyncio
async def test_root_endpoint(client):
    r = await client.get("/v1/")
    assert r.status_code == 200
    assert "Uzhavar AI API" in r.json()["message"]
