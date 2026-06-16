# Import all models so Alembic autogenerate can discover every table.
# Import order: leaf tables first, then tables that FK-reference them.

from app.db.models.auth import FarmerSession
from app.db.models.crop import Crop
from app.db.models.farmer import Farmer, FarmerCrop
from app.db.models.soil import SoilTest
from app.db.models.diagnosis import Diagnosis, Disease
from app.db.models.fertilizer import FertilizerRecommendation
from app.db.models.irrigation import IrrigationPlan
from app.db.models.prescription import Prescription  # deprecated — kept for compat
from app.db.models.market import Mandi, MandiPrice, MarketForecast, PriceForecast
from app.db.models.scheme import (
    GovernmentScheme,
    EligibilityResult,
    Scheme,  # alias for GovernmentScheme
    SchemeDeadlineAlert,
    SchemeQuery,
)

__all__ = [
    # Auth
    "FarmerSession",
    # Core catalog
    "Crop",
    # Farmer
    "Farmer",
    "FarmerCrop",
    # Soil
    "SoilTest",
    # Pillar 1 — Crop Sentinel
    "Disease",
    "Diagnosis",
    # Pillar 2 — Soil & Water Optimizer
    "FertilizerRecommendation",
    "IrrigationPlan",
    "Prescription",  # deprecated
    # Pillar 3 — Market Navigator
    "Mandi",
    "MandiPrice",
    "MarketForecast",
    "PriceForecast",  # alias
    # Pillar 4 — Government Navigator
    "GovernmentScheme",
    "Scheme",  # alias
    "EligibilityResult",
    "SchemeQuery",
    "SchemeDeadlineAlert",
]
