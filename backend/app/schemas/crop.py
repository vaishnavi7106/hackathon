from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CropOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    crop_id: str
    name_en: str
    name_ta: str
    category: str
    typical_seasons: list[str] | None = None
    avg_yield_kg_per_acre: float | None = None
    water_requirement: str | None = None
    growing_days: int | None = None
    icar_code: str | None = None
    is_priority: bool


class CropSummary(BaseModel):
    """Lightweight crop reference for nested use."""

    model_config = ConfigDict(from_attributes=True)

    crop_id: str
    name_en: str
    name_ta: str
    category: str
    is_priority: bool
