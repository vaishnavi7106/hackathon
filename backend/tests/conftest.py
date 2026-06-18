"""
Shared fixtures for integration tests.

Requires a running PostgreSQL instance.  By default uses:
    postgresql+asyncpg://uzhavar:uzhavar@localhost:5432/uzhavar_test

Override with:
    TEST_DATABASE_URL=postgresql+asyncpg://... pytest

Quick setup (with docker-compose running):
    docker exec -it uzhavar_ai-postgres-1 psql -U uzhavar -c "CREATE DATABASE uzhavar_test;"
    cd backend && pytest
"""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://uzhavar:uzhavar@localhost:5432/uzhavar_test",
)


# ── Session-scoped engine — creates / drops all tables once per test run ──────

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, pool_pre_ping=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── Function-scoped session — each test rolls back completely ─────────────────

@pytest_asyncio.fixture
async def db(test_engine):
    """
    Wraps each test in a connection-level transaction that is rolled back
    after the test, keeping the DB clean without truncating.
    """
    async with test_engine.connect() as conn:
        trans = await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )
        async with session_factory() as session:
            yield session
        await trans.rollback()


# ── HTTP client with DB override ──────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db: AsyncSession):
    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def seed_crops(db: AsyncSession):
    """Insert a minimal crop set into the test DB."""
    from app.db.models.crop import Crop

    crops = [
        Crop(crop_id="rice", name_en="Rice", name_ta="நெல்", category="cereal", is_priority=True),
        Crop(
            crop_id="tomato",
            name_en="Tomato",
            name_ta="தக்காளி",
            category="vegetable",
            is_priority=True,
        ),
    ]
    db.add_all(crops)
    await db.flush()
    return crops


@pytest_asyncio.fixture
async def seed_diseases(db: AsyncSession, seed_crops):
    """Insert a minimal disease set (requires seed_crops)."""
    from app.db.models.diagnosis import Disease

    diseases = [
        Disease(
            disease_id="rice_blast",
            crop_id="rice",
            crop="rice",
            name_en="Rice Blast",
            name_ta="நெல் வெடிப்பு நோய்",
        ),
        Disease(
            disease_id="tomato_early_blight",
            crop_id="tomato",
            crop="tomato",
            name_en="Tomato Early Blight",
            name_ta="தக்காளி ஆரம்ப கருக்கல்",
        ),
    ]
    db.add_all(diseases)
    await db.flush()
    return diseases


@pytest_asyncio.fixture
async def seed_scheme(db: AsyncSession):
    """Insert one government scheme."""
    from datetime import date

    from app.db.models.scheme import GovernmentScheme

    scheme = GovernmentScheme(
        scheme_id="pm_kisan",
        name_en="PM-KISAN",
        name_ta="பிரதமர் கிசான் சம்மான் நிதி",
        level="central",
        benefit_amount="₹6,000/year",
        benefit_amount_num=6000,
        min_land_acres=0,
        requires_aadhaar=True,
        documents_required=["Aadhaar", "Bank passbook"],
        description_ta="நில உடைமையாளர் விவசாய குடும்பங்களுக்கு ஆண்டுக்கு ₹6000.",
        last_verified=date(2025, 1, 1),
        is_active=True,
    )
    db.add(scheme)
    await db.flush()
    return scheme


@pytest_asyncio.fixture
async def seed_all_schemes(db: AsyncSession):
    """Insert all 24 authoritative schemes into the test DB.

    Central (8, level='central'): CEN-PMKISAN, CEN-PMFBY, CEN-PMKSY,
      CEN-SHC, CEN-KCC, CEN-ENAM, CEN-PKVY, CEN-PMKMY
    State (16, level='state'): CEN-TNFR + 15 TN-AGRI-* schemes
    """
    from datetime import date

    from app.db.models.scheme import GovernmentScheme

    D = date(2026, 6, 17)

    def s(scheme_id, name_en, name_ta, level, desc_ta, *, state="Tamil Nadu",
          benefit=None, benefit_num=None, requires_aadhaar=False,
          min_land=0.0, max_land=None, docs=None, url=None,
          dept_en=None, dept_ta=None, code=None, year=None,
          desc_en=None, elig_en=None, elig_ta=None, source_url=None,
          source_id=None, docs_ta=None,
          app_mode=None, portal_name=None, process_summary=None,
          verification_status=None,
          # Eligibility engine v2 fields (migration 007)
          min_age=None, max_age=None, requires_bank_account=False,
          eligible_land_ownership=None, eligible_income_bands=None,
          eligible_crops=None, eligible_districts=None):
        return dict(
            scheme_id=scheme_id, name_en=name_en, name_ta=name_ta,
            level=level, state=state,
            benefit_amount=benefit, benefit_amount_num=benefit_num,
            min_land_acres=min_land, max_land_acres=max_land,
            requires_aadhaar=requires_aadhaar,
            eligible_crops=eligible_crops,
            eligible_districts=eligible_districts,
            eligible_income_bands=eligible_income_bands,
            min_age=min_age, max_age=max_age,
            requires_bank_account=requires_bank_account,
            eligible_land_ownership=eligible_land_ownership,
            documents_required=docs or [],
            documents_ta=docs_ta,
            application_url=url,
            application_mode=app_mode,
            application_portal_name=portal_name,
            application_process_summary=process_summary,
            verification_status=verification_status,
            department_en=dept_en, department_ta=dept_ta,
            scheme_code=code, year=year,
            description_en=desc_en, description_ta=desc_ta,
            eligibility_en=elig_en, eligibility_ta=elig_ta,
            source_url=source_url, source_scheme_id=source_id,
            last_verified=D, is_active=True,
        )

    schemes_data = [
        # ── Central schemes (level='central') ─────────────────────────────────
        s("CEN-PMKISAN",
          "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
          "பிரதம மந்திரி கிசான் சம்மான் நிதி",
          "central",
          "விவசாயக் குடும்பங்களுக்கு நேரடி வருமான உதவி. மூன்று தவணைகளில் ரூ.6,000 வழங்கப்படும்.",
          benefit="₹6,000 per year in three installments of ₹2,000 each via Direct Benefit Transfer",
          benefit_num=6000.0, requires_aadhaar=True, requires_bank_account=True,
          eligible_land_ownership=["own"],
          docs=["Aadhaar card", "Land ownership records (Patta/Chitta)", "Bank account (Aadhaar-seeded, NEFT enabled)"],
          docs_ta=["ஆதார் அட்டை", "நில உரிமை ஆவணங்கள் (பட்டா/சிட்டா)", "வங்கி கணக்கு (ஆதார் இணைப்புடன்)"],
          url="https://pmkisan.gov.in/NewFarmerRegistration.aspx", source_url="https://pmkisan.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="PM-KISAN", year="Ongoing",
          desc_en="Provides direct income support to landholding farmer families.",
          elig_en="Landholding farmer families as per State/UT land records. Requires Aadhaar, e-KYC.",
          elig_ta="நில உரிமையுள்ள விவசாய குடும்பங்கள். ஆதார் இணைப்பு மற்றும் e-KYC கட்டாயம்.",
          app_mode="HYBRID",
          portal_name="PM-KISAN Official Portal — Farmers Corner",
          process_summary="Online: Visit pmkisan.gov.in → Farmers Corner → New Farmer Registration → enter Aadhaar, mobile, state → fill personal and land details → complete e-KYC → submit. Offline: Visit nearest Common Service Centre (CSC).",
          verification_status="VERIFIED — official portal confirmed live"),
        s("CEN-PMFBY",
          "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
          "பிரதம மந்திரி பயிர் காப்பீட்டுத் திட்டம்",
          "central",
          "இயற்கை சீற்றங்கள், பூச்சிகள் மற்றும் நோய்களால் பயிர் இழப்பு ஏற்படும் விவசாயிகளுக்கு நிதி உதவி. இழப்பு 72 மணி நேரத்தில் தெரிவிக்க வேண்டும்.",
          benefit="Crop insurance coverage. Farmer premium: 2% Kharif, 1.5% Rabi, 5% horticulture.",
          docs=["Aadhaar card", "Land records or tenancy documents", "Bank account details", "Sowing certificate"],
          url="https://pmfby.gov.in", source_url="https://pmfby.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="PMFBY", year="Ongoing",
          elig_en="All farmers growing notified crops in notified areas. Voluntary.",
          elig_ta="அறிவிக்கப்பட்ட பகுதிகளில் அறிவிக்கப்பட்ட பயிர்கள் பயிரிடும் அனைத்து விவசாயிகளும்."),
        s("CEN-PMKSY",
          "Pradhan Mantri Krishi Sinchayee Yojana - Per Drop More Crop (PMKSY-PDMC)",
          "பிரதம மந்திரி கிரிஷி சின்சாயி யோஜனா - நுண்ணீர் பாசனம்",
          "central",
          "சொட்டு நீர் மற்றும் தெளிப்பு நீர்ப்பாசனம் மூலம் நீர் பயன்பாட்டு திறனை மேம்படுத்துதல். வழக்கமான பாசனத்தை விட 40-80% நீர் சேமிப்பு சாத்தியம்.",
          benefit="Subsidy on drip and sprinkler micro-irrigation systems (55%+).",
          max_land=12.0, requires_aadhaar=True, requires_bank_account=True,
          docs=["Aadhaar card", "Land records", "Bank account details", "Quotation for BIS-certified micro-irrigation equipment"],
          url="https://pmksy.gov.in", source_url="https://pmksy.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="PMKSY-PDMC", year="Ongoing",
          elig_en="All farmers. Subsidy limited to 5 hectares per beneficiary. BIS-certified components only.",
          elig_ta="அனைத்து மாநிலங்களிலும் உள்ள விவசாயிகள். ஒரு பயனாளிக்கு அதிகபட்சம் 5 எக்டர்."),
        s("CEN-SHC",
          "Soil Health Card Scheme",
          "மண் வள அட்டை திட்டம்",
          "central",
          "விவசாயிகளுக்கு மண்ணின் ஊட்டச்சத்து நிலை மற்றும் பரிந்துரைக்கப்பட்ட உர அளவுகளை உள்ளடக்கிய மண் வள அட்டை இலவசமாக வழங்கப்படுகிறது.",
          benefit="Free soil testing and Soil Health Card with crop-wise nutrient and fertilizer recommendations",
          docs=["Land records", "Farmer identification details"],
          url="https://soilhealth.dac.gov.in", source_url="https://soilhealth.dac.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="SHC", year="Ongoing",
          elig_en="All farmers are eligible to receive a Soil Health Card for their landholding.",
          elig_ta="அனைத்து விவசாயிகளும் தங்கள் நிலத்திற்கு மண் வள அட்டை பெற தகுதியுடையவர்கள்."),
        s("CEN-KCC",
          "Kisan Credit Card (KCC)",
          "கிசான் கடன் அட்டை",
          "central",
          "விவசாயம் மற்றும் தொடர்புடைய செயல்பாடுகளுக்கு ஒற்றை சாளர சுழல் கடன் வசதி. ரூ.5 லட்சம் வரை கடன். சரியான நேரத்தில் திருப்பித் தந்தால் சுமார் 4% வட்டி.",
          benefit="Revolving short-term credit up to ₹5 lakh. Effective interest ~4% per annum.",
          benefit_num=500000.0,
          docs=["Aadhaar card", "Land records or tenancy proof", "Two passport-size photographs", "Bank account details"],
          url="https://www.jansamarth.in", source_url="https://www.pib.gov.in/FactsheetDetails.aspx?Id=148600",
          dept_en="Ministry of Agriculture (NABARD)", dept_ta="வேளாண்மை அமைச்சகம் (நாபார்டு)",
          code="KCC", year="Ongoing",
          elig_en="Small farmers, marginal farmers, sharecroppers, oral lessees and tenant farmers.",
          elig_ta="சிறு விவசாயிகள், குறு விவசாயிகள், குத்தகை விவசாயிகள், வாய்மொழி குத்தகைதாரர்கள்."),
        s("CEN-ENAM",
          "National Agriculture Market (e-NAM)",
          "தேசிய வேளாண் சந்தை (இ-நாம்)",
          "central",
          "விவசாயிகளுக்கு விலை வெளிப்படைத்தன்மை மற்றும் நேரடி விற்பனை வாய்ப்பை வழங்கும் தேசிய ஆன்லைன் வர்த்தக தளம்.",
          benefit="No direct cash benefit. Access to online trading platform for transparent price discovery.",
          docs=["Aadhaar card", "Bank account details", "Mobile number for registration"],
          url="https://www.enam.gov.in", source_url="https://www.enam.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="e-NAM", year="Ongoing",
          elig_en="Farmers, traders and commission agents registered with a participating APMC regulated market.",
          elig_ta="பங்கேற்கும் APMC கட்டுப்படுத்தப்பட்ட சந்தையில் பதிவு செய்யப்பட்ட விவசாயிகள்."),
        s("CEN-PKVY",
          "Paramparagat Krishi Vikas Yojana (PKVY) - Organic Farming",
          "பாரம்பரிய வேளாண் வளர்ச்சித் திட்டம்",
          "central",
          "கொத்து அணுகுமுறையில் அங்கக வேளாண்மையை ஊக்குவிக்கும் திட்டம். மூன்று ஆண்டுகளுக்கு ரூ.6,000/எக்டர்/ஆண்டு நிதி உதவி.",
          benefit="Financial assistance of Rs.6,000 per Hectare per year for 3 years.",
          requires_bank_account=True,
          docs=["Aadhaar card", "Land records", "Bank account details"],
          url="https://pgsindia-ncof.gov.in", source_url="https://www.myscheme.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="PKVY", year="Ongoing",
          elig_en="Farmers willing to adopt or already practicing organic farming, organised into clusters.",
          elig_ta="அங்கக வேளாண்மை மேற்கொள்ள விரும்பும் விவசாயிகள். குழு அணுகுமுறை கட்டாயம்."),
        s("CEN-PMKMY",
          "PM Kisan Maan Dhan Yojana (Farmer Pension Scheme)",
          "பிரதம மந்திரி கிசான் மான்தன் திட்டம்",
          "central",
          "சிறு மற்றும் குறு விவசாயிகளுக்கான தன்னார்வ ஓய்வூதியத் திட்டம். 60 வயதிற்குப் பிறகு மாதம் ரூ.3,000 ஓய்வூதியம்.",
          benefit="Assured monthly pension of ₹3,000 after age 60. Government matches farmer's monthly contribution.",
          benefit_num=3000.0, max_land=5.0,
          requires_aadhaar=True, requires_bank_account=True,
          min_age=18, max_age=40,
          eligible_income_bands=["below_1L", "1L_2L"],
          docs=["Aadhaar card", "Land records", "Bank account or savings account details"],
          url="https://maandhan.in", source_url="https://www.myscheme.gov.in",
          dept_en="Ministry of Agriculture and Farmers Welfare",
          dept_ta="வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்",
          code="PM-KMY", year="Ongoing",
          elig_en="Small and marginal farmers aged 18 to 40 years with cultivable landholding up to 2 hectares.",
          elig_ta="18 முதல் 40 வயதுடைய சிறு மற்றும் குறு விவசாயிகள். 2 எக்டர் வரை பயிரிடும் நிலம்."),
        # ── State schemes (level='state') ─────────────────────────────────────
        s("CEN-TNFR",
          "Tamil Nadu Farmer Registry (AgriStack Farmer ID)",
          "தமிழ்நாடு விவசாயி பதிவு (விவசாயி அடையாள எண்)",
          "state",
          "இந்தியாவின் AgriStack டிஜிட்டல் வேளாண்மை திட்டத்தின் தமிழ்நாடு செயலாக்கம். ஆதார், நில ஆவணங்கள், பயிர் விவரங்கள் மற்றும் வங்கி கணக்குடன் இணைக்கப்பட்ட தனித்துவமான விவசாயி அடையாள எண்.",
          benefit="No direct cash benefit. Unique Farmer ID for seamless access to all schemes.",
          docs=["Aadhaar card", "Chitta", "Adangal", "Patta", "Bank account details"],
          url="https://tnfr.agristack.gov.in", source_url="https://tnfr.agristack.gov.in",
          dept_en="Agriculture (Tamil Nadu / AgriStack)", dept_ta="வேளாண்மை (தமிழ்நாடு / AgriStack)",
          code="TNFR", year="Ongoing",
          elig_en="Tamil Nadu farmers with land records (Chitta, Adangal, Patta).",
          elig_ta="சிட்டா, அடங்கல், பட்டா ஆவணங்களுடன் தமிழ்நாடு விவசாயிகள்."),
        s("TN-AGRI-147",
          "Sub-Mission on Agricultural Mechanisation (Agri)",
          "வேளாண்மை இயந்திரமயமாக்கும் துணை இயக்கத்திட்டம்",
          "state",
          "வேளாண் இயந்திர சக்தியினை மேப்படுத்துவதற்காக, சிறு மற்றும் குறு விவசாயிகளிடையே வேளாண்மை இயந்திரமயமாக்குதலை ஊக்குவித்தல்.",
          docs=["Patta", "Chitta", "Adangal"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="SMAM", year="2023-24", source_id="147",
          elig_en="All District Farmer",
          elig_ta="அனைத்து மாவட்ட விவசாயிகள்"),
        s("TN-AGRI-153",
          "Chief Minister's Mannuyir Kaathu Mannuyir Kaappom Scheme",
          "முதலமைச்சரின் மண்ணுயிர் காத்து மன்னுயிர் காப்போம் திட்டம்",
          "state",
          "உயிர்ம வேளாண் பண்ணைத் திடல் அமைத்தல், மண்புழு உரப்படுக்கைகள், பசுந்தாள் உர விதைகள், திரவ உயிர் உரங்கள், வேப்ப மரக்கன்றுகள் விநியோகம் மற்றும் இயற்கை இடுபொருள் மையம் அமைத்தல் ஆகியவை மூலம் மண்வளத்தை மேம்படுத்துகிறது.",
          docs=["Aadhaar", "Patta", "Adangal"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="MMKMK", year="2024-25", source_id="153",
          elig_en="All Farmers", elig_ta="அனைத்து விவசாயிகள்"),
        s("TN-AGRI-162",
          "Rainfed Area Development - Integrated Farming System 2024-25",
          "மானாவாரி பகுதி மேம்பாடு-ஒருங்கிணைந்த பண்ணையம் 2024-25",
          "state",
          "பயிர் சாகுபடியுடன் கறவை மாடு/ஆடுகள், பழ மரக்கன்றுகள், தேனீ வளர்ப்பு, மண்புழு உரம் தயாரிப்பு ஆகியவற்றை மேற்கொள்ள 50% மானியம் அதிகபட்சமாக ரூ.30,000/- வழங்கப்படும்.",
          benefit="50% subsidy up to Rs.30,000 per IFS unit",
          docs=["Patta", "Adangal", "Aadhaar"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="RAD", year="2024-25", source_id="162",
          elig_en="Farmers of 28 Districts in Tamil Nadu",
          elig_ta="28 மாவட்ட விவசாயிகள்"),
        s("TN-AGRI-163",
          "National Agricultural Development Program (NADP) 2024-25",
          "தேசிய வேளாண் வளர்ச்சித் திட்டம் 2024-25",
          "state",
          "மக்காச்சோள சாகுபடி விரிவாக்கம், நடவு துவரை திட்டம், பருத்தி சாகுபடி மற்றும் நெல் உற்பத்தியை மேம்படுத்துதல் ஆகியவை 2024-25 தேசிய வேளாண் வளர்ச்சி திட்டத்தின் கீழ் செயல்படுத்தப்படுகிறது.",
          benefit="Varies by component (e.g., Rs.9,000/Ha for redgram transplantation at 50% subsidy)",
          docs=["Chitta", "Adangal", "Aadhaar", "Bank passbook first page with photo"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="NADP", year="2024-25", source_id="163",
          elig_en="Varies by component; farmers in notified districts of Tamil Nadu",
          elig_ta="கூறுக்கு ஏற்ப மாறுபடும்; தமிழ்நாட்டில் அறிவிக்கப்பட்ட மாவட்ட விவசாயிகள்",
          eligible_crops=["maize", "redgram", "cotton", "rice", "paddy"]),
        s("TN-AGRI-164",
          "Food and Nutrition Security Mission 2024-25",
          "உணவு மற்றும் ஊட்டச்சத்து பாதுகாப்பு இயக்கம் 2024-25",
          "state",
          "மக்காச்சோளம், ஊட்டச்சத்து சிறுதானியங்கள், பருத்தி, கரும்பு, பயறுவகைகள் மற்றும் நெல் உற்பத்தியை ஊக்குவிக்கும் திட்டக் கூறுகள் தமிழ்நாட்டில் செயல்படுத்தப்படுகிறது.",
          benefit="Varies by component (e.g., Rs.5,000/Ha cluster demo; Rs.8,500/Ha intercropping)",
          docs=["Chitta", "Adangal", "Aadhaar", "Bank passbook first page with photo"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="FNSM", year="2024-25", source_id="164",
          elig_en="Farmers growing notified crops in eligible districts of Tamil Nadu",
          elig_ta="தமிழ்நாட்டில் தகுதியான மாவட்டங்களில் அறிவிக்கப்பட்ட பயிர்கள் பயிரிடும் விவசாயிகள்",
          eligible_crops=["maize", "millets", "ragi", "bajra", "jowar", "cotton",
                          "sugarcane", "pulses", "rice", "paddy", "redgram", "blackgram", "greengram"]),
        s("TN-AGRI-165",
          "Tamil Nadu Millet Mission 2024-25",
          "தமிழ்நாடு சிறுதானிய இயக்கம் 2024-25",
          "state",
          "ஊட்டச்சத்து மிக்க சிறுதானியங்களின் உற்பத்தி மற்றும் உற்பத்தித்திறனை அதிகரித்தல்.",
          docs=["Aadhaar", "Chitta", "Adangal"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="TNMM", year="2024-25", source_id="165",
          elig_en="All farmers of all 25 Millet Special Zone districts",
          elig_ta="சிறுதானிய சிறப்பு மண்டலங்களின் 25 மாவட்டங்களில் உள்ள அனைத்து விவசாயிகள்",
          eligible_crops=["ragi", "bajra", "jowar", "sorghum", "finger millet",
                          "pearl millet", "foxtail millet", "little millet",
                          "kodo millet", "barnyard millet", "millets"]),
        s("TN-AGRI-167",
          "Tamil Nadu Irrigated Agriculture Modernization Project (TNIAMP) 2024-25",
          "தமிழ்நாடு பாசன வேளாண்மை நவீனமயமாக்கல் திட்டம் 2024-25",
          "state",
          "உலகவங்கி நிதியுதவியில் 66 துணையாற்றுப்படுகைகளில் நீர் மேலாண்மை மற்றும் காலநிலை மாற்றத்திற்கு உகந்த பயிர் உற்பத்தி திறனை பெருக்குதல்.",
          docs=["Aadhaar", "Patta", "Chitta", "Bank passbook"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="TNIAMP", year="2024-25", source_id="167",
          elig_en="All Farmers in the Sub Basin only. Preference given to Small/Marginal, Women, SC/ST. Maximum 2 Ha per beneficiary.",
          elig_ta="துணையாற்றுப் படுகைகளில் உள்ள அனைத்து விவசாயிகளும்."),
        s("TN-AGRI-168",
          "Sub-Mission on Seeds and Planting Materials 2024-25",
          "விதைகள் மற்றும் நடவுப் பொருட்களுக்கான துணை இயக்கத் திட்டம் 2024-25",
          "state",
          "விதை கிராமத் திட்டம் மூலம் நெல், பயறு, எண்ணெய்வித்து மற்றும் பிற பயிர்களுக்கான ஆதார மற்றும் சான்றிதழ் பெற்ற விதைகள் உற்பத்தி மற்றும் விநியோகம்.",
          docs=["Chitta", "Aadhaar", "Ration Card"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="SMSP", year="2024-25", source_id="168",
          elig_en="All farmers; seed farm registration required for seed production component",
          elig_ta="அனைத்து விவசாயிகளும்; விதை உற்பத்தி கூறுக்கு விதைப்பண்ணை பதிவு தேவை"),
        s("TN-AGRI-171",
          "Kalaignar All Village Integrated Agricultural Development Programme (KAVIADP) 2024-25",
          "கலைஞரின் அனைத்து கிராம ஒருங்கிணைந்த வேளாண் வளர்ச்சித் திட்டம் 2024-25",
          "state",
          "அனைத்து கிராமங்களும் ஒட்டுமொத்த வேளாண் வளர்ச்சி மற்றும் தன்னிறைவு அடைந்திடும் நோக்கத்துடன் வேளாண்மை உழவர் நலத்துறை திட்டங்களுடன் ஒருங்கிணைத்து செயல்படுத்தப்படுகிறது.",
          docs=["Patta", "Chitta", "Adangal", "Ration card", "Aadhaar card photocopies"],
          url="https://www.tnagrisnet.tn.gov.in/KaviaDP/scheme_register",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="KAVIADP", year="2024-25", source_id="171",
          elig_en="All families in the selected village panchayats",
          elig_ta="தேர்வு செய்யப்பட்ட கிராமத்தில் உள்ள அனைத்து குடும்பமும்",
          app_mode="HYBRID",
          portal_name="TNAGRISNET — KAVIADP Online Registration Portal",
          process_summary="Online: Visit tnagrisnet.tn.gov.in/KaviaDP/scheme_register → fill Registration Form → track at Track Application page. Offline: Submit documents at nearest Block Agriculture Office.",
          verification_status="VERIFIED — tnagrisnet.tn.gov.in/KaviaDP/scheme_register confirmed live"),
        s("TN-AGRI-172",
          "National Mission on Edible Oils (NMEO) - Oilseeds 2024-25",
          "தேசிய சமையல் எண்ணெய் இயக்கம் 2024-25",
          "state",
          "எண்ணெய் வித்து பயிர்களில் தொகுப்பு செயல் விளக்கத் திடல்கள், சான்று விதைகள், நுண்ணூட்ட உரங்கள் 50 சதவீத மானியத்தில் செயல்படுத்தப்படுகிறது.",
          benefit="50% subsidy on inputs (seeds, fertilizers, biocontrol agents)",
          docs=["Aadhaar", "Bank passbook first page with photo", "Seed Farm registration details"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="NMEO", year="2024-25", source_id="172",
          elig_en="All oilseed growing farmers in Tamil Nadu",
          elig_ta="எண்ணெய்வித்துப் பயிர் சாகுபடி செய்யும் விவசாயிகள்",
          eligible_crops=["groundnut", "gingelly", "sunflower"]),
        s("TN-AGRI-173",
          "Rainfed Area Development - Integrated Farming System 2024-25",
          "மானாவாரி பகுதி மேம்பாடு - ஒருங்கிணைந்த பண்ணையம் 2024-25",
          "state",
          "பயிர் சாகுபடியுடன் கறவை மாடு/ஆடுகள், பழ மரக்கன்றுகள், தேனீ வளர்ப்பு, மண்புழு உரம் தயாரிப்பு ஆகியவற்றை 50% மானியம் அதிகபட்சமாக ரூ.30,000/- வழங்கப்படும்.",
          benefit="50% subsidy up to Rs.30,000 per IFS unit",
          docs=["Chitta", "Adangal", "Aadhaar", "Bank passbook first page with photo"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="RAD-IFS", year="2024-25", source_id="173",
          elig_en="All Farmers of 29 Districts: Ariyalur, Coimbatore, Cuddalore, Dharmapuri, Dindigul, Karur, Krishnagiri, Kallakurichi, Vellore, Madurai, Namakkal, Perambalur, Ramanathapuram, Salem, Thoothukudi, Trichy, Tiruvannamalai, Villupuram, Virudhunagar, Sivagangai, Tiruppur, Ranipet, Thiruppathur, Thiruvarur, Tiruvallur, Erode, Thenkasi, Pudukottai and Theni",
          elig_ta="அரியலூர், கோயம்புத்தூர், கடலூர் உட்பட 29 மாவட்ட விவசாயிகள்",
          eligible_districts=["Ariyalur", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
                               "Karur", "Krishnagiri", "Kallakurichi", "Vellore", "Madurai",
                               "Namakkal", "Perambalur", "Ramanathapuram", "Salem", "Thoothukudi",
                               "Trichy", "Tiruvannamalai", "Villupuram", "Virudhunagar", "Sivagangai",
                               "Tiruppur", "Ranipet", "Thiruppathur", "Thiruvarur", "Tiruvallur",
                               "Erode", "Thenkasi", "Pudukottai", "Theni"]),
        s("TN-AGRI-174",
          "Paramparagat Krishi Vikas Yojana (PKVY) - Organic Farming 2024-25",
          "பாரம்பரிய வேளாண் வளர்ச்சி திட்டம் 2024-25",
          "state",
          "அங்கக விவசாயத்தில் ஆர்வமுள்ள விவசாயிகளை குழுக்களாக ஒருங்கிணைத்து மூன்றாண்டுகள் நிதியுதவி வழங்கி அங்கக வேளாண்மை ஊக்குவிக்கப்படுகிறது. ஹெக்டேருக்கு ரூ.6,000/ஆண்டு.",
          benefit="Rs.6,000 per Hectare per year for 3 years (Rs.2,000 in year 1)",
          docs=["Chitta", "Adangal", "Aadhaar", "Bank passbook first page with photo"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="PKVY", year="2024-25", source_id="174",
          elig_en="All District Farmers except Chennai and Nilgiris",
          elig_ta="சென்னை, நீலகிரி நீங்கலாக அனைத்து மாவட்ட விவசாயிகள்"),
        s("TN-AGRI-175",
          "State Agricultural Development Schemes (SADS) 2024-25",
          "மாநில வேளாண் வளர்ச்சித் திட்டம் 2024-25",
          "state",
          "பலன் தரும் பருத்தி சாகுபடி, துவரை பரப்பு விரிவாக்கம், மாற்றுப் பயிர் சாகுபடி, ஜிங்க் சல்பேட் மற்றும் ஜிப்சம் வழங்குதல் மற்றும் பாரம்பரிய நெல் ரகங்கள் 50% மானியத்தில் விநியோகம்.",
          benefit="50% subsidy on traditional paddy seeds; Rs.75 Lakh total allocation for 300MT seed distribution",
          docs=["Chitta", "Adangal", "Aadhaar"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="SADS", year="2024-25", source_id="175",
          elig_en="All Tamil Nadu farmers; 10 kg seeds per farmer for traditional paddy; priority to SC/ST small and marginal farmers",
          elig_ta="அனைத்து தமிழ்நாடு விவசாயிகள்; பாரம்பரிய நெல் விதை ஒரு விவசாயிக்கு 10 கிலோ",
          eligible_crops=["cotton", "redgram", "rice", "paddy"]),
        s("TN-AGRI-176",
          "Chief Minister's Mannuyir Kaathu Mannuyir Kaappom Scheme 2024-25",
          "முதலமைச்சரின் மண்ணுயிர் காத்து மன்னுயிர் காப்போம் திட்டம் 2024-25",
          "state",
          "பாரம்பரிய சிறுதானியம் மற்றும் பயறு பாதுகாத்தல், மருத்துவ தாவர நடவுப்பொருட்கள் விநியோகம், மாதிரி உயிர்ம வேளாண் திடல், வேப்ப மரக்கன்றுகள், மண்புழு உரம், பசுந்தாள் உரம் மற்றும் திரவ உயிர் உரங்கள் மூலம் மண்வளம் மேம்படுத்தல்.",
          docs=["Aadhaar", "Patta", "Adangal"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="CMMKMK-25", year="2024-25", source_id="176",
          elig_en="All Farmers in Tamil Nadu", elig_ta="அனைத்து விவசாயிகள்"),
        s("TN-AGRI-177",
          "Kuruvai Special Package 2024",
          "குறுவை சாகுபடி சிறப்புத் தொகுப்புத் திட்டம் 2024",
          "state",
          "குறுவைப் பருவ நெல் சாகுபடியை ஊக்குவிக்க டெல்டா மாவட்டங்களில் விதை, உரம் மற்றும் பயிர் பாதுகாப்பு இடுபொருட்களுக்கு மானியம் வழங்கும் சிறப்புத் தொகுப்பு.",
          docs=["Chitta", "Adangal", "Aadhaar", "Bank passbook"],
          url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          source_url="https://www.tnagrisnet.tn.gov.in/home/schemes/en",
          dept_en="Agriculture", dept_ta="வேளாண்மைத்துறை",
          code="KSP", year="2024-25", source_id="177",
          elig_en="Farmers in Tamil Nadu delta districts cultivating paddy during Kuruvai season",
          elig_ta="குறுவைப் பருவத்தில் நெல் சாகுபடி செய்யும் தமிழ்நாடு டெல்டா மாவட்ட விவசாயிகள்",
          eligible_crops=["rice"]),
    ]

    created = []
    for d in schemes_data:
        obj = GovernmentScheme(**d)
        db.add(obj)
        created.append(obj)
    await db.flush()
    return created


@pytest_asyncio.fixture
async def registered_farmer(client: AsyncClient):
    """Register a farmer and return (farmer_id, token)."""
    r = await client.post(
        "/v1/auth/register",
        json={"name": "Test Farmer", "district": "Coimbatore", "language": "ta"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    return data["farmer_id"], data["token"]
