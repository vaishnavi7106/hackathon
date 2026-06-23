import asyncio, sys
sys.path.insert(0, '.')
from app.config import get_settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check():
    s = get_settings()
    engine = create_async_engine(s.database_url)
    async with engine.connect() as conn:
        r = await conn.execute(text("SELECT COUNT(*) FROM mandis"))
        print("mandis count:", r.scalar())
        try:
            r2 = await conn.execute(text("SELECT COUNT(*) FROM mandi_prices"))
            print("mandi_prices count:", r2.scalar())
        except Exception as e:
            print("mandi_prices table error:", e)
        r3 = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' ORDER BY table_name"
        ))
        print("tables:", [row[0] for row in r3.fetchall()])

asyncio.run(check())
