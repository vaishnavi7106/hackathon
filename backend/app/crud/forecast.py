import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import Mandi, MandiPrice, PriceForecast
from haversine import haversine, Unit

# Alternate spellings → AGMARKNET canonical district name.
_DISTRICT_ALIASES: dict[str, str] = {
    "tiruvarur":        "Thiruvarur",
    "tirupur":          "Thirupur",
    "tiruchirappalli":  "Thiruchirappalli",
    "trichy":           "Thiruchirappalli",
    "tirunelveli":      "Thirunelveli",
    "tiruvannamalai":   "Thiruvannamalai",
    "tirupathur":       "Thirupathur",
    "tiruvallur":       "Thiruvellore",
    "thiruvallur":      "Thiruvellore",
    "thoothukudi":      "Tuticorin",
}

# 3 nearest mandi IDs per canonical district (home district first, then adjacent).
_DISTRICT_MANDIS: dict[str, list[str]] = {
    "Thiruvarur":       ["TVR_MAIN", "TJ_MAIN",  "NGP_MAIN"],
    "Thanjavur":        ["TJ_MAIN",  "KMB_MAIN", "TVR_MAIN"],
    "Coimbatore":       ["CBE_MAIN", "TPR_MAIN", "ERD_MAIN"],
    "Chennai":          ["CHN_MAIN", "CGP_MAIN", "KCP_MAIN"],
    "Madurai":          ["MDU_MAIN", "DGL_MAIN", "VRN_MAIN"],
    "Salem":            ["SLM_MAIN", "NMK_MAIN", "ERD_MAIN"],
    "Thiruchirappalli": ["TCH_MAIN", "TJ_MAIN",  "PDK_MAIN"],
    "Erode":            ["ERD_MAIN", "CBE_MAIN", "SLM_MAIN"],
    "Dindigul":         ["DGL_MAIN", "MDU_MAIN", "THN_MAIN"],
    "Namakkal":         ["NMK_MAIN", "SLM_MAIN", "ERD_MAIN"],
    "Thirupur":         ["TPR_MAIN", "CBE_MAIN", "ERD_MAIN"],
    "Nagapattinam":     ["NGP_MAIN", "TVR_MAIN", "MLT_MAIN"],
    "Vellore":          ["VLR_MAIN", "TVN_MAIN", "RNP_MAIN"],
    "Villupuram":       ["VLP_MAIN", "CDL_MAIN", "KLK_MAIN"],
    "Cuddalore":        ["CDL_MAIN", "VLP_MAIN", "NGP_MAIN"],
    "Pudukkottai":      ["PDK_MAIN", "TCH_MAIN", "SVG_MAIN"],
    "Sivaganga":        ["SVG_MAIN", "MDU_MAIN", "RMN_MAIN"],
    "Virudhunagar":     ["VRN_MAIN", "MDU_MAIN", "TNK_MAIN"],
    "Tenkasi":          ["TNK_MAIN", "TNV_MAIN", "VRN_MAIN"],
    "Thirunelveli":     ["TNV_MAIN", "TNK_MAIN", "TUT_MAIN"],
    "Tuticorin":        ["TUT_MAIN", "TNV_MAIN", "RMN_MAIN"],
    "Ramanathapuram":   ["RMN_MAIN", "SVG_MAIN", "TUT_MAIN"],
    "Theni":            ["THN_MAIN", "DGL_MAIN", "MDU_MAIN"],
    "Karur":            ["KRR_MAIN", "TCH_MAIN", "NMK_MAIN"],
    "Perambalur":       ["PRM_MAIN", "TCH_MAIN", "ARY_MAIN"],
    "Ariyalur":         ["ARY_MAIN", "PRM_MAIN", "TCH_MAIN"],
    "Mayiladuthurai":   ["MLT_MAIN", "NGP_MAIN", "TVR_MAIN"],
    "Kallakurichi":     ["KLK_MAIN", "VLP_MAIN", "SLM_MAIN"],
    "Ranipet":          ["RNP_MAIN", "VLR_MAIN", "TVN_MAIN"],
    "Thiruvannamalai":  ["TVN_MAIN", "VLR_MAIN", "VLP_MAIN"],
    "Krishnagiri":      ["KRG_MAIN", "DHP_MAIN", "HSR_MAIN"],
    "Dharmapuri":       ["DHP_MAIN", "KRG_MAIN", "SLM_MAIN"],
    "Kancheepuram":     ["KCP_MAIN", "CHN_MAIN", "CGP_MAIN"],
    "Chengalpattu":     ["CGP_MAIN", "KCP_MAIN", "CHN_MAIN"],
    "Nilgiris":         ["NLG_MAIN", "CBE_MAIN", "ERD_MAIN"],
    "Thirupathur":      ["TPT_MAIN", "VLR_MAIN", "KRG_MAIN"],
    "Thiruvellore":     ["TVL_MAIN", "CHN_MAIN", "CGP_MAIN"],
    "Kanyakumari":      ["KNY_MAIN", "TNV_MAIN", "TNK_MAIN"],
}

_FALLBACK_MANDI_IDS = ["CHN_MAIN", "CBE_MAIN", "MDU_MAIN"]


def _canonical(district: str) -> str:
    return _DISTRICT_ALIASES.get(district.lower(), district)


async def get_nearest_mandis(
    db: AsyncSession, district: str, limit: int = 3
) -> list[Mandi]:
    """Return the nearest mandis for a district using the static lookup table."""
    canonical = _canonical(district)
    mandi_ids = _DISTRICT_MANDIS.get(canonical, _FALLBACK_MANDI_IDS)[:limit]

    result = await db.execute(
        select(Mandi).where(Mandi.mandi_id.in_(mandi_ids))
    )
    by_id = {m.mandi_id: m for m in result.scalars().all()}
    # Preserve mapping order so home district mandi is always first
    return [by_id[mid] for mid in mandi_ids if mid in by_id]


async def get_latest_price(
    db: AsyncSession, crop: str, mandi_id: str
) -> MandiPrice | None:
    result = await db.execute(
        select(MandiPrice)
        .where(MandiPrice.crop == crop, MandiPrice.mandi_id == mandi_id)
        .order_by(MandiPrice.price_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_price_forecast(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID | None,
    crop: str,
    mandi_id: str | None,
    forecast_data: list,
    today_price: float | None,
    peak_price: float | None,
    peak_date: date | None,
    storage_type: str | None,
    storage_cost: float | None,
    net_gain: float | None,
    recommendation: str | None,
    model_version: str | None = None,
) -> PriceForecast:
    forecast = PriceForecast(
        farmer_id=farmer_id,
        crop=crop,
        mandi_id=mandi_id,
        forecast_data=forecast_data,
        today_price=today_price,
        peak_price=peak_price,
        peak_date=peak_date,
        storage_type=storage_type,
        storage_cost=storage_cost,
        net_gain=net_gain,
        recommendation=recommendation,
        model_version=model_version,
    )
    db.add(forecast)
    await db.flush()
    await db.refresh(forecast)
    return forecast


def calc_transport_cost(distance_km: float) -> float:
    """₹2.5 per km per quintal."""
    return round(distance_km * 2.5, 2)


def calc_storage_cost(storage_type: str, weeks: int) -> float:
    """Storage cost in ₹ per quintal for given weeks."""
    weekly_rates = {"home": 30.0, "warehouse": 55.0, "cold_storage": 120.0}
    rate = weekly_rates.get(storage_type, 30.0)
    return round(rate * weeks, 2)


def calc_mandi_distance(mandi: Mandi, district_lat: float, district_lon: float) -> float:
    if mandi.latitude is None or mandi.longitude is None:
        return 50.0  # default estimate
    return round(haversine((district_lat, district_lon), (float(mandi.latitude), float(mandi.longitude)), unit=Unit.KILOMETERS), 1)
