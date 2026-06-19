import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class FarmerCropIn(BaseModel):
    """Crop entry submitted by the farmer (update / registration)."""

    crop_id: str | None = Field(None, max_length=40)
    crop: str = Field(..., min_length=2, max_length=60)
    acres: float = Field(..., gt=0, le=1000)
    season: str | None = Field(None, pattern=r"^(kharif|rabi|summer|annual)$")
    sowing_date: date | None = None
    expected_harvest_date: date | None = None


# Kept as backward-compat alias (older code imports CropIn)
CropIn = FarmerCropIn


class FarmerCropOut(FarmerCropIn):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# Backward-compat alias
CropOut = FarmerCropOut


class SoilTestIn(BaseModel):
    tested_at: date
    ph: float | None = Field(None, ge=0, le=14)
    nitrogen: float | None = Field(None, ge=0)
    phosphorus: float | None = Field(None, ge=0)
    potassium: float | None = Field(None, ge=0)
    organic_matter: float | None = Field(None, ge=0, le=100)
    zinc: float | None = Field(None, ge=0)
    iron: float | None = Field(None, ge=0)
    copper: float | None = Field(None, ge=0)
    boron: float | None = Field(None, ge=0)


class SoilTestOut(SoilTestIn):
    model_config = ConfigDict(from_attributes=True)

    test_id: uuid.UUID
    source: str
    deficiencies: list[str] = []


class FarmerUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    district: str | None = Field(None, min_length=2, max_length=60)
    village: str | None = Field(None, max_length=100)
    land_size_acres: float | None = Field(None, gt=0, le=10000)
    pump_type: str | None = Field(None, pattern=r"^(diesel|electric|none)$")
    storage_facility: str | None = Field(None, pattern=r"^(home|warehouse|cold_storage)$")
    language: str | None = Field(None, pattern=r"^(ta|hi|en)$")
    aadhaar_linked: bool | None = None
    income_band: str | None = Field(None, pattern=r"^(below_1L|1L_2L|above_2L)$")
    age: int | None = Field(None, ge=1, le=120)
    bank_account_linked: bool | None = None
    land_ownership: str | None = Field(None, pattern=r"^(own|lease|tenant)$")
    crops: list[FarmerCropIn] | None = None
    # Pillar 5 — FCM push token (set from PWA on first app open)
    fcm_token: str | None = Field(None, max_length=500)


class FarmerProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    farmer_id: uuid.UUID
    phone: str | None = None
    name: str | None = None
    district: str
    village: str | None = None
    land_size_acres: float | None = None
    pump_type: str | None = None
    storage_facility: str | None = None
    language: str
    aadhaar_linked: bool
    income_band: str | None = None
    age: int | None = None
    bank_account_linked: bool | None = None
    land_ownership: str | None = None
    crops: list[FarmerCropOut] = []
    latest_soil_test: SoilTestOut | None = None
    created_at: datetime
    updated_at: datetime
