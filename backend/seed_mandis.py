"""Seed one mandi per Tamil Nadu district (all 36 districts in live_features.csv)."""
import asyncio, sys
sys.path.insert(0, '.')
from app.config import get_settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

MANDIS = [
    ("ARY_MAIN", "Ariyalur Agri Market",          "Ariyalur"),
    ("CGP_MAIN", "Chengalpattu Market",            "Chengalpattu"),
    ("CBE_MAIN", "Coimbatore Main Market",         "Coimbatore"),
    ("CDL_MAIN", "Cuddalore Market",               "Cuddalore"),
    ("DHP_MAIN", "Dharmapuri Market",              "Dharmapuri"),
    ("DGL_MAIN", "Dindigul Market",                "Dindigul"),
    ("ERD_MAIN", "Erode Market",                   "Erode"),
    ("KLK_MAIN", "Kallakuruchi Market",            "Kallakuruchi"),
    ("KCP_MAIN", "Kancheepuram Market",            "Kancheepuram"),
    ("KNY_MAIN", "Kanyakumari Market",             "Kanyakumari"),
    ("KRR_MAIN", "Karur Market",                   "Karur"),
    ("KRG_MAIN", "Krishnagiri Market",             "Krishnagiri"),
    ("MDU_MAIN", "Madurai Central Market",         "Madurai"),
    ("NGP_MAIN", "Nagapattinam Market",            "Nagapattinam"),
    ("NMK_MAIN", "Namakkal Market",                "Namakkal"),
    ("NLG_MAIN", "Nilgiris Market",                "Nilgiris"),
    ("PRM_MAIN", "Perambalur Market",              "Perambalur"),
    ("PDK_MAIN", "Pudukkottai Market",             "Pudukkottai"),
    ("RMN_MAIN", "Ramanathapuram Market",          "Ramanathapuram"),
    ("RNP_MAIN", "Ranipet Market",                 "Ranipet"),
    ("SLM_MAIN", "Salem Market",                   "Salem"),
    ("SVG_MAIN", "Sivaganga Market",               "Sivaganga"),
    ("TNK_MAIN", "Tenkasi Market",                 "Tenkasi"),
    ("TJ_MAIN",  "Thanjavur Paddy Market",         "Thanjavur"),
    ("THN_MAIN", "Theni Market",                   "Theni"),
    ("TCH_MAIN", "Tiruchirappalli Market",         "Thiruchirappalli"),
    ("TNV_MAIN", "Tirunelveli Market",             "Thirunelveli"),
    ("TPT_MAIN", "Tirupathur Market",              "Thirupathur"),
    ("TPR_MAIN", "Tirupur Agricultural Market",    "Thirupur"),
    ("TVN_MAIN", "Tiruvannamalai Market",          "Thiruvannamalai"),
    ("TVR_MAIN", "Thiruvarur Market",              "Thiruvarur"),
    ("TVL_MAIN", "Tiruvallur Market",              "Thiruvellore"),
    ("TUT_MAIN", "Tuticorin Market",               "Tuticorin"),
    ("VLR_MAIN", "Vellore Market",                 "Vellore"),
    ("VLP_MAIN", "Villupuram Market",              "Villupuram"),
    ("VRN_MAIN", "Virudhunagar Market",            "Virudhunagar"),
    # Chennai
    ("CHN_MAIN", "Chennai Koyambedu Market",       "Chennai"),
]

async def seed():
    engine = create_async_engine(get_settings().database_url)
    async with engine.begin() as conn:
        for mandi_id, name, district in MANDIS:
            await conn.execute(text("""
                INSERT INTO mandis (mandi_id, name, district, state, enam_linked)
                VALUES (:mid, :name, :district, 'Tamil Nadu', true)
                ON CONFLICT (mandi_id) DO UPDATE
                  SET name = EXCLUDED.name,
                      district = EXCLUDED.district
            """), {"mid": mandi_id, "name": name, "district": district})
        r = await conn.execute(text("SELECT COUNT(*) FROM mandis"))
        print(f"Mandis in DB: {r.scalar()}")

asyncio.run(seed())
