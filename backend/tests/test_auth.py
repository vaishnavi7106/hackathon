import pytest


@pytest.mark.asyncio
async def test_register_no_phone(client):
    r = await client.post(
        "/v1/auth/register",
        json={"name": "Arjun", "district": "Madurai", "language": "ta"},
    )
    assert r.status_code == 201
    data = r.json()
    assert "token" in data
    assert "farmer_id" in data
    assert "expires_at" in data


@pytest.mark.asyncio
async def test_register_with_phone(client):
    r = await client.post(
        "/v1/auth/register",
        json={"phone": "9876543210", "name": "Ravi", "district": "Trichy", "language": "ta"},
    )
    assert r.status_code == 201
    assert "token" in r.json()


@pytest.mark.asyncio
async def test_register_invalid_phone_rejected(client):
    r = await client.post(
        "/v1/auth/register",
        json={"phone": "123", "district": "Chennai"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_missing_district_rejected(client):
    r = await client.post("/v1/auth/register", json={"name": "Test"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_with_registered_phone(client):
    # Register first
    await client.post(
        "/v1/auth/register",
        json={"phone": "9000000001", "district": "Salem", "language": "ta"},
    )
    # Then login
    r = await client.post("/v1/auth/login", json={"phone": "9000000001"})
    assert r.status_code == 200
    assert "token" in r.json()


@pytest.mark.asyncio
async def test_login_unknown_phone_returns_404(client):
    r = await client.post("/v1/auth/login", json={"phone": "9999999999"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_profile_requires_auth(client):
    r = await client.get("/v1/farmer/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_profile_with_valid_token(client, registered_farmer):
    farmer_id, token = registered_farmer
    r = await client.get("/v1/farmer/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["farmer_id"] == farmer_id
    assert data["district"] == "Coimbatore"
