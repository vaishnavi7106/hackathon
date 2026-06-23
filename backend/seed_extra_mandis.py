"""Seed 3 mandis missing from the initial seed."""
import asyncio, sys
sys.path.insert(0, '.')
from app.config import get_settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

EXTRA = [
    ("KMB_MAIN", "Kumbakonam Market",     "Thanjavur"),
    ("MLT_MAIN", "Mayiladuthurai Market", "Mayiladuthurai"),
    ("HSR_MAIN", "Hosur Market",          "Krishnagiri"),
]

async def seed():
    engine = create_async_engine(get_settings().database_url)
    async with engine.begin() as conn:
        for mid, name, district in EXTRA:
            await conn.execute(text(
                "INSERT INTO mandis (mandi_id, name, district, state, enam_linked) "
                "VALUES (:mid, :name, :district, 'Tamil Nadu', true) "
                "ON CONFLICT (mandi_id) DO UPDATE "
                "SET name = EXCLUDED.name, district = EXCLUDED.district"
            ), {"mid": mid, "name": name, "district": district})
        r = await conn.execute(text("SELECT COUNT(*) FROM mandis"))
        print("Mandis in DB:", r.scalar())

asyncio.run(seed())
