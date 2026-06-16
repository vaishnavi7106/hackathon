import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class PrescribeRequest(BaseModel):
    crop: str = Field(..., min_length=2, max_length=60)
    acres: float = Field(..., gt=0, le=1000)
    season: str | None = Field(None, pattern=r"^(kharif|rabi|summer)$")
    soil_test_id: uuid.UUID | None = None
    start_date: date = Field(default_factory=date.today)


class MicronutrientFlags(BaseModel):
    zinc_deficiency: bool = False
    zinc_supplement: str | None = None
    iron_deficiency: bool = False
    iron_supplement: str | None = None
    copper_deficiency: bool = False
    boron_deficiency: bool = False


class FertilizerOut(BaseModel):
    nitrogen_kg_per_acre: float | None
    phosphorus_kg_per_acre: float | None
    potassium_kg_per_acre: float | None
    micronutrients: MicronutrientFlags
    total_cost_estimate: float | None
    savings_vs_standard: float | None
    savings_note_ta: str | None


class IrrigationSession(BaseModel):
    day: int
    date: date
    duration_min: int
    volume_litres: int
    cost_estimate: float | None


class IrrigationOut(BaseModel):
    total_sessions: int
    schedule: list[IrrigationSession]
    rain_skips: list[str] = []
    rain_skip_note_ta: str | None = None


class CalendarEntry(BaseModel):
    day: int
    date: date
    action: str  # "irrigate" | "fertilize"
    detail: str


class WeatherForecastSnap(BaseModel):
    source: str
    fetched_at: datetime
    days: list[dict]


class PrescribeResponse(BaseModel):
    prescription_id: uuid.UUID
    fertilizer: FertilizerOut
    irrigation: IrrigationOut
    joint_calendar: list[CalendarEntry]
    weather_forecast_used: WeatherForecastSnap | None = None
    model_unavailable: bool = False
    model_unavailable_note: str | None = None
