"""
Crop Sentinel — Disease Table Seeder
Uzhavar AI · Pillar 1

Loads treatment_db.json (your standalone deliverable) + disease_mapping.py
(label → slug/crop_id/Tamil name) and upserts all 25 diseases into the
real `diseases` Postgres table — the source the live app actually reads
from via app/crud/disease.py.

This does NOT touch any existing file. Run once after Alembic migrations:

    cd backend
    python -m app.db.seeds.seed_diseases

Safe to re-run: existing disease_id rows are updated, not duplicated.

Where treatment_db.json should live
------------------------------------
Drop your file at:  backend/data/diseases/treatment_db.json
(matches the path documented in IMPLEMENTATION_PLAN.md's repo structure)

If you haven't moved it yet, this script also checks app/ml/treatment_db.json
as a fallback so you can run it straight from your current folder layout.
"""

import asyncio
import json
from pathlib import Path

from app.crud.disease import create_disease, get_disease, update_disease
from app.db.session import AsyncSessionLocal
from app.ml.disease_mapping import DISEASE_MAP
from app.schemas.disease import DiseaseCreate, DiseaseUpdate

# backend/app/db/seeds/seed_diseases.py → parents[3] == backend/
BACKEND_ROOT = Path(__file__).resolve().parents[3]
PRIMARY_PATH = BACKEND_ROOT / "data" / "diseases" / "treatment_db.json"
FALLBACK_PATH = Path(__file__).resolve().parents[1] / "ml" / "treatment_db.json"


def _load_treatment_db() -> dict:
    path = PRIMARY_PATH if PRIMARY_PATH.exists() else FALLBACK_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"treatment_db.json not found at either:\n"
            f"  {PRIMARY_PATH}\n"
            f"  {FALLBACK_PATH}\n"
            f"Copy your file to one of these locations and re-run."
        )
    print(f"[Seed] Loading treatment data from: {path}")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_meta", None)
    return data


def _build_payload(label: str, meta: dict, treatment: dict) -> DiseaseCreate:
    """Combine mapping metadata + treatment text into one DB-ready record."""

    # indigenous_method (Text, no length cap) carries both the remedy
    # and the prevention tip — the Disease table has no separate
    # "prevention" column, so we fold it in here rather than truncating
    # or misusing an unrelated field.
    indigenous_full = treatment["indigenous"]
    if treatment.get("prevention"):
        indigenous_full += f"\n\nPrevention: {treatment['prevention']}"

    return DiseaseCreate(
        disease_id=meta["disease_id"],
        crop_id=meta["crop_id"],
        crop=meta["crop_id"],          # varchar fallback column — keep in sync with crop_id
        name_en=meta["name_en"],
        name_ta=meta["name_ta"],
        modern_chemical=treatment["modern"],     # fits under 200-char column (max seen: 169)
        indigenous_method=indigenous_full,
        icar_reference="TNAU field guide — Crop Sentinel treatment_db.json v1.0",
    )


async def seed_diseases() -> None:
    treatments = _load_treatment_db()
    inserted, updated, skipped = 0, 0, 0

    async with AsyncSessionLocal() as db:
        for label, meta in DISEASE_MAP.items():
            treatment = treatments.get(label)
            if treatment is None:
                print(f"  ⚠️  No treatment_db.json entry for '{label}' — skipping")
                skipped += 1
                continue

            payload = _build_payload(label, meta, treatment)
            existing = await get_disease(db, meta["disease_id"])

            if existing:
                update_payload = DiseaseUpdate(
                    **payload.model_dump(exclude={"disease_id", "crop"})
                )
                await update_disease(db, existing, update_payload)
                updated += 1
            else:
                await create_disease(db, payload)
                inserted += 1

        await db.commit()

    total = inserted + updated
    print(
        f"\n✅  Seed complete — {total} diseases in DB "
        f"(inserted: {inserted}, updated: {updated}, skipped: {skipped})"
    )
    if skipped:
        print("⚠️  Some labels had no matching treatment_db.json entry — check the warnings above.")


if __name__ == "__main__":
    asyncio.run(seed_diseases())