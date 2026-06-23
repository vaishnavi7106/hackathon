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

# Approximate centroid coordinates for each district (lat, lon)
_DISTRICT_CENTROIDS: dict[str, tuple[float, float]] = {
    "Ariyalur":         (11.14, 79.08),
    "Chengalpattu":     (12.69, 79.98),
    "Chennai":          (13.08, 80.27),
    "Coimbatore":       (11.02, 76.97),
    "Cuddalore":        (11.75, 79.77),
    "Dharmapuri":       (12.13, 78.16),
    "Dindigul":         (10.36, 77.97),
    "Erode":            (11.34, 77.73),
    "Kallakurichi":     (11.74, 78.96),
    "Kancheepuram":     (12.84, 79.70),
    "Kanyakumari":      ( 8.09, 77.54),
    "Karur":            (10.96, 78.08),
    "Krishnagiri":      (12.52, 78.21),
    "Madurai":          ( 9.92, 78.12),
    "Mayiladuthurai":   (11.10, 79.65),
    "Nagapattinam":     (10.76, 79.84),
    "Namakkal":         (11.22, 78.17),
    "Nilgiris":         (11.41, 76.69),
    "Perambalur":       (11.23, 78.88),
    "Pudukkottai":      (10.38, 78.82),
    "Ramanathapuram":   ( 9.37, 78.83),
    "Ranipet":          (12.93, 79.33),
    "Salem":            (11.67, 78.15),
    "Sivaganga":        ( 9.84, 78.48),
    "Tenkasi":          ( 8.96, 77.32),
    "Thanjavur":        (10.79, 79.14),
    "Theni":            (10.01, 77.48),
    "Thiruchirappalli": (10.80, 78.69),
    "Thirunelveli":     ( 8.73, 77.70),
    "Thirupathur":      (12.50, 78.56),
    "Thirupur":         (11.11, 77.34),
    "Thiruvannamalai":  (12.23, 79.07),
    "Thiruvarur":       (10.77, 79.64),
    "Thiruvellore":     (13.14, 79.91),
    "Tuticorin":        ( 8.79, 78.14),
    "Vellore":          (12.92, 79.13),
    "Villupuram":       (11.94, 79.49),
    "Virudhunagar":     ( 9.58, 77.96),
}

# Fallback mandi coordinates (used when DB lat/lon is NULL)
_MANDI_COORDS: dict[str, tuple[float, float]] = {
    "ARY_MAIN": (11.14, 79.08),
    "CGP_MAIN": (12.69, 79.98),
    "CBE_MAIN": (11.02, 76.97),
    "CDL_MAIN": (11.75, 79.77),
    "CHN_MAIN": (13.07, 80.21),
    "DHP_MAIN": (12.13, 78.16),
    "DGL_MAIN": (10.36, 77.97),
    "ERD_MAIN": (11.34, 77.73),
    "HSR_MAIN": (12.74, 77.83),
    "KLK_MAIN": (11.74, 78.96),
    "KCP_MAIN": (12.84, 79.70),
    "KNY_MAIN": ( 8.09, 77.54),
    "KMB_MAIN": (10.96, 79.39),
    "KRR_MAIN": (10.96, 78.08),
    "KRG_MAIN": (12.52, 78.21),
    "MDU_MAIN": ( 9.92, 78.12),
    "MLT_MAIN": (11.10, 79.65),
    "NGP_MAIN": (10.76, 79.84),
    "NMK_MAIN": (11.22, 78.17),
    "NLG_MAIN": (11.41, 76.69),
    "PDK_MAIN": (10.38, 78.82),
    "PRM_MAIN": (11.23, 78.88),
    "RMN_MAIN": ( 9.37, 78.83),
    "RNP_MAIN": (12.93, 79.33),
    "SLM_MAIN": (11.67, 78.15),
    "SVG_MAIN": ( 9.84, 78.48),
    "TJ_MAIN":  (10.79, 79.14),
    "THN_MAIN": (10.01, 77.48),
    "TCH_MAIN": (10.80, 78.69),
    "TNK_MAIN": ( 8.96, 77.32),
    "TNV_MAIN": ( 8.73, 77.70),
    "TPT_MAIN": (12.50, 78.56),
    "TPR_MAIN": (11.11, 77.34),
    "TUT_MAIN": ( 8.79, 78.14),
    "TVL_MAIN": (13.14, 79.91),
    "TVN_MAIN": (12.23, 79.07),
    "TVR_MAIN": (10.77, 79.64),
    "VLR_MAIN": (12.92, 79.13),
    "VLP_MAIN": (11.94, 79.49),
    "VRN_MAIN": ( 9.58, 77.96),
}


def _canonical(district: str) -> str:
    return _DISTRICT_ALIASES.get(district.lower(), district)


def get_district_centroid(district: str) -> tuple[float, float]:
    canonical = _canonical(district)
    return _DISTRICT_CENTROIDS.get(canonical, (13.08, 80.27))  # fallback: Chennai


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
    if mandi.latitude is not None and mandi.longitude is not None:
        mandi_lat, mandi_lon = float(mandi.latitude), float(mandi.longitude)
    elif mandi.mandi_id in _MANDI_COORDS:
        mandi_lat, mandi_lon = _MANDI_COORDS[mandi.mandi_id]
    else:
        return 50.0
    return round(haversine((district_lat, district_lon), (mandi_lat, mandi_lon), unit=Unit.KILOMETERS), 1)
