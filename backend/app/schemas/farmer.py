import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CropIn(BaseModel):
    crop: str = Field(..., min_length=2, max_length=60)
    acres: float = Field(..., gt=0, le=1000)
    season: str | None = Field(None, pattern=r"^(kharif|rabi|summer)$")


class CropOut(CropIn):
    id: uuid.UUID

    class Config:
        from_attributes = True


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
    test_id: uuid.UUID
    source: str
    deficiencies: list[str] = []

    class Config:
        from_attributes = True


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
    crops: list[CropIn] | None = None


class FarmerProfile(BaseModel):
    farmer_id: uuid.UUID
    phone: str | None
    name: str | None
    district: str
    village: str | None
    land_size_acres: float | None
    pump_type: str | None
    storage_facility: str | None
    language: str
    aadhaar_linked: bool
    income_band: str | None
    crops: list[CropOut] = []
    latest_soil_test: SoilTestOut | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
