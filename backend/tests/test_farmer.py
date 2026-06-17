import pytest


@pytest.mark.asyncio
async def test_update_farmer_name(client, registered_farmer):
    farmer_id, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.put("/v1/farmer/me", json={"name": "Karthik"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Karthik"


@pytest.mark.asyncio
async def test_update_farmer_invalid_pump_type(client, registered_farmer):
    _, token = registered_farmer
    r = await client.put(
        "/v1/farmer/me",
        json={"pump_type": "steam"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_crops(client, registered_farmer, seed_crops):
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.put(
        "/v1/farmer/me",
        json={
            "crops": [
                {"crop": "rice", "crop_id": "rice", "acres": 2.5, "season": "kharif"},
                {"crop": "tomato", "crop_id": "tomato", "acres": 0.5},
            ]
        },
        headers=headers,
    )
    assert r.status_code == 200
    crops = r.json()["crops"]
    assert len(crops) == 2
    crop_names = {c["crop"] for c in crops}
    assert "rice" in crop_names
    assert "tomato" in crop_names


@pytest.mark.asyncio
async def test_add_soil_test(client, registered_farmer):
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/v1/farmer/soil-test",
        json={
            "tested_at": "2025-06-01",
            "ph": 6.5,
            "nitrogen": 280,
            "phosphorus": 18,
            "potassium": 220,
            "zinc": 0.4,
        },
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["ph"] == 6.5
    assert "zinc" in data.get("deficiencies", [])


@pytest.mark.asyncio
async def test_soil_test_detects_deficiencies(client, registered_farmer):
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/v1/farmer/soil-test",
        json={
            "tested_at": "2025-06-01",
            "zinc": 0.3,    # below 0.6 threshold
            "iron": 3.0,    # below 4.5 threshold
            "copper": 0.5,  # above threshold — not deficient
            "boron": 0.3,   # below 0.5 threshold
        },
        headers=headers,
    )
    assert r.status_code == 201
    deficiencies = r.json()["deficiencies"]
    assert "zinc" in deficiencies
    assert "iron" in deficiencies
    assert "boron" in deficiencies
    assert "copper" not in deficiencies
