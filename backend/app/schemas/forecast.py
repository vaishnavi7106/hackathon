import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    crop: str = Field(..., min_length=2, max_length=60)
    storage_facility: str | None = Field(None, pattern=r"^(home|warehouse|cold_storage)$")
    override_mandi_ids: list[str] = []


class MandiInfo(BaseModel):
    mandi_id: str
    name: str
    distance_km: float | None
    today_price: float | None
    transport_cost_per_quintal: float | None
    net_price: float | None


class ForecastPoint(BaseModel):
    date: date
    yhat: float
    yhat_lower: float | None
    yhat_upper: float | None


class PriceForecastOut(BaseModel):
    mandi_id: str
    series: list[ForecastPoint]
    peak_price: float | None
    peak_date: date | None
    peak_confidence_range: list[float] | None


class HoldSellOut(BaseModel):
    recommendation: str  # "HOLD" | "SELL"
    today_price: float | None
    forecast_peak_price: float | None
    weeks_to_hold: int | None
    storage_cost_per_quintal: float | None
    net_gain_per_quintal: float | None
    calculation_ta: str | None
    historical_note_ta: str | None


class ForecastResponse(BaseModel):
    forecast_id: uuid.UUID
    crop: str
    generated_at: datetime
    mandis: list[MandiInfo]
    best_mandi: MandiInfo | None
    price_forecast: PriceForecastOut | None
    hold_sell: HoldSellOut | None
    model_unavailable: bool = False
    model_unavailable_note: str | None = None


class LivePriceItem(BaseModel):
    mandi_id: str
    name: str
    modal_price: float | None
    price_date: str | None
    source: str


class LivePriceResponse(BaseModel):
    crop: str
    district: str
    prices: list[LivePriceItem]
    cache_age_seconds: int | None
