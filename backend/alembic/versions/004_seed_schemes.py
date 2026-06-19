"""Pillar 4 — Seed 16 Tamil Nadu / Central agricultural schemes.

Revision ID: 004
Revises: 003
Create Date: 2026-06-17

Source of truth: verified JSON dataset of 16 schemes provided as authoritative input.
Null fields in the JSON are preserved as NULL here. No data was invented or inferred.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert all 16 schemes. ON CONFLICT DO NOTHING makes this idempotent.
    op.execute(sa.text("""
    INSERT INTO government_schemes (
        scheme_id, name_en, name_ta, level, state,
        benefit_amount, benefit_amount_num,
        min_land_acres, max_land_acres,
        requires_aadhaar,
        documents_required,
        application_url,
        description_ta, eligibility_ta,
        last_verified, is_active
    ) VALUES

    -- ── Central schemes ────────────────────────────────────────────────────────

    ('CEN-PMKISAN',
     'PM Kisan Samman Nidhi',
     'பிரதமர் கிசான் சம்மான் நிதி திட்டம்',
     'central', 'All India',
     '₹6,000/year (3 installments of ₹2,000)', 6000.00,
     0.0, NULL,
     TRUE,
     ARRAY['Aadhaar card', 'Land ownership record (Patta/Chitta)', 'Bank account passbook'],
     'https://pmkisan.gov.in',
     'நில உடைமையாளர் விவசாய குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 மூன்று தவணைகளில் நேரடியாக வங்கி கணக்கில் வழங்கப்படும்.',
     'நில உடைமையாளர் விவசாயி குடும்பங்கள். ஆதார், நில பதிவேடு, வங்கி கணக்கு இணைக்கப்பட்டிருக்க வேண்டும்.',
     '2026-01-01', TRUE),

    ('CEN-PMFBY',
     'Pradhan Mantri Fasal Bima Yojana',
     'பிரதமர் பயிர் காப்பீடு திட்டம்',
     'central', 'All India',
     'Premium: 2% (Kharif), 1.5% (Rabi), 5% (Horticulture)', NULL,
     0.0, NULL,
     FALSE,
     ARRAY['Land records', 'Sowing certificate', 'Bank account passbook'],
     'https://pmfby.gov.in',
     'கோடை பயிர்களுக்கு 2%, ராபி பயிர்களுக்கு 1.5%, தோட்டக்கலை பயிர்களுக்கு 5% பிரீமியம் செலுத்தி பயிர் காப்பீடு பெறலாம்.',
     'அரசால் அறிவிக்கப்பட்ட பயிர்களை பயிரிடும் அனைத்து விவசாயிகளும் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('CEN-PMKSY-PDMC',
     'PM Krishi Sinchayee Yojana - PDMC (Micro Irrigation)',
     'நுண்ணீர்ப்பாசன மானியம் திட்டம்',
     'central', 'All India',
     'Subsidy on drip/sprinkler installation (up to 5 ha)', NULL,
     0.0, 12.0,
     FALSE,
     ARRAY['Land records', 'Aadhaar card', 'Bank account', 'BIS-certified equipment invoice'],
     'https://pmksy.gov.in',
     'சொட்டு நீர்ப்பாசனம் மற்றும் தெளிப்பு நீர்ப்பாசன நிறுவலுக்கு மானியம். 5 ஹெக்டேர் (சுமார் 12 ஏக்கர்) வரையிலான நிலத்திற்கு BIS சான்றளிக்கப்பட்ட உபகரணங்கள் மூலம் பயனடையலாம்.',
     '5 ஹெக்டேர் (சுமார் 12 ஏக்கர்) வரையிலான நிலம் உடைய விவசாயிகள். BIS சான்றளிக்கப்பட்ட உபகரணங்கள் தேவை.',
     '2026-01-01', TRUE),

    ('CEN-SHC',
     'Soil Health Card Scheme',
     'மண் ஆரோக்கிய அட்டை திட்டம்',
     'central', 'All India',
     'Free soil testing and health card', NULL,
     0.0, NULL,
     FALSE,
     ARRAY[]::text[],
     'https://soilhealth.dac.gov.in',
     'அனைத்து விவசாயிகளுக்கும் இலவசமாக மண் ஆரோக்கிய அட்டை வழங்கப்படும். மண்ணின் வேதியியல் நிலை மற்றும் உர பரிந்துரை அறியலாம்.',
     'அனைத்து விவசாயிகளும் இலவசமாக பெறலாம். விண்ணப்பம் தேவையில்லை.',
     '2026-01-01', TRUE),

    ('CEN-KCC',
     'Kisan Credit Card',
     'கிசான் கிரெடிட் கார்டு',
     'central', 'All India',
     'Credit up to ₹5 lakh at ~4% interest', 500000.00,
     0.0, NULL,
     FALSE,
     ARRAY['Aadhaar card', 'Land records', 'Passport photo', 'Bank account passbook'],
     'https://jansamarth.in',
     'விவசாய தேவைகளுக்கு ₹5 லட்சம் வரை கடன் வசதி. சுமார் 4% வட்டி விகிதம்.',
     'சிறு, குறு, பட்டா, குத்தகை மற்றும் பங்கு விவசாயிகள் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('CEN-ENAM',
     'Electronic National Agriculture Market (e-NAM)',
     'மின்னணு தேசிய வேளாண் சந்தை (e-NAM)',
     'central', 'All India',
     'Online trading platform access', NULL,
     0.0, NULL,
     FALSE,
     ARRAY['APMC registration', 'Bank account passbook'],
     'https://enam.gov.in',
     'ஆன்லைன் தளத்தில் பயிர் விலை பட்டியல் பார்த்து விற்பனை செய்யலாம். நேரடி சந்தை அணுகல் வழங்கப்படும்.',
     'APMC பதிவு செய்த விவசாயிகள் மற்றும் வணிகர்கள் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('CEN-PKVY',
     'Paramparagat Krishi Vikas Yojana (Organic Farming)',
     'இயற்கை விவசாய ஊக்க திட்டம் (PKVY)',
     'central', 'All India',
     'Cluster-based assistance for organic farming', NULL,
     0.0, NULL,
     FALSE,
     ARRAY['Land records', 'Cluster formation documents'],
     'https://pgsindia-ncof.gov.in',
     'கூட்டு இயற்கை விவசாய அணிகளுக்கு உதவி. PGS-India சான்றிதழ் பெற ஆதரவு வழங்கப்படும்.',
     'குழு விவசாய நடைமுறைகள் கடைப்பிடிக்க வேண்டும். கிளஸ்டர் விதிமுறைகள் பின்பற்றப்பட வேண்டும்.',
     '2026-01-01', TRUE),

    ('CEN-PMKMY',
     'PM Kisan Mandhan Yojana (Farmer Pension)',
     'பிரதமர் கிசான் மாந்தன் யோஜனா',
     'central', 'All India',
     '₹3,000/month pension after age 60', 3000.00,
     0.0, 5.0,
     FALSE,
     ARRAY['Aadhaar card', 'Land records', 'Bank account passbook', 'Age proof'],
     'https://maandhan.in',
     '60 வயதிற்கு பின் மாதம் ₹3,000 ஓய்வூதியம். 18-40 வயது விவசாயிகள் இதில் சேரலாம்.',
     '18 முதல் 40 வயது வரையிலான விவசாயிகள். 2 ஹெக்டேர் (சுமார் 5 ஏக்கர்) வரையிலான நிலம் வைத்திருப்பவர்கள்.',
     '2026-01-01', TRUE),

    ('CEN-AIF',
     'Agriculture Infrastructure Fund',
     'வேளாண் உள்கட்டமைப்பு நிதி திட்டம்',
     'central', 'All India',
     'Debt financing with 3% interest subvention', NULL,
     0.0, NULL,
     FALSE,
     ARRAY['Registration documents', 'Project proposal', 'Bank account passbook'],
     'https://agriinfra.dac.gov.in',
     'வேளாண் உள்கட்டமைப்பு திட்டங்களுக்கு கடன் வசதி. 3% வட்டி குறைப்பு மானியம் வழங்கப்படும்.',
     'FPOகள், PACS, வேளாண் தொழில்முனைவோர் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('CEN-KUSUM',
     'PM KUSUM - Solar Pump Scheme',
     'பிரதமர் குசும் சூரிய ஆற்றல் பம்ப் திட்டம்',
     'central', 'All India',
     'Subsidy on solar pump installation', NULL,
     0.0, NULL,
     FALSE,
     ARRAY['Land records', 'Aadhaar card', 'Bank account passbook'],
     'https://pmkusum.mnre.gov.in',
     'சூரிய ஆற்றல் பம்புகளுக்கு மானியம். மின்சாரம் இல்லாத பகுதிகளுக்கு மிகவும் பயனுள்ளது.',
     'தனி விவசாயிகள், விவசாயி குழுக்கள், கூட்டுறவு சங்கங்கள் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    -- ── Tamil Nadu state schemes ────────────────────────────────────────────────

    ('TN-TNFR',
     'Tamil Nadu Farmer Registry (AgriStack)',
     'தமிழ்நாடு விவசாயி பதிவேடு (AgriStack)',
     'state', 'Tamil Nadu',
     'Digital farmer ID and AgriStack enrollment', NULL,
     0.0, NULL,
     FALSE,
     ARRAY['Chitta / Adangal / Patta land records', 'Aadhaar card'],
     'https://tnfr.agristack.gov.in',
     'AgriStack தேசிய விவசாயி தரவுத்தளத்தில் பதிவு செய்து டிஜிட்டல் ID பெறலாம். அரசு திட்டங்கள் எளிதாக அணுக உதவும்.',
     'சிட்டா, அடங்கல் அல்லது பட்டா ஆவணங்கள் உள்ள தமிழ்நாட்டு விவசாயிகள்.',
     '2026-01-01', TRUE),

    ('TN-UZHAVAR-SANTHAI',
     'Uzhavar Sandhai - Farmers Market',
     'உழவர் சந்தை திட்டம்',
     'state', 'Tamil Nadu',
     'Direct market access without middlemen', NULL,
     0.0, NULL,
     FALSE,
     ARRAY[]::text[],
     'https://tnagrisnet.tn.gov.in',
     'நேரடி சந்தையில் இடைத்தரகர் இல்லாமல் விவசாய பொருட்களை விற்பனை செய்யலாம். நியாயமான விலை உறுதிப்படுத்தப்படும்.',
     'தமிழ்நாட்டு விவசாயிகள் அனைவரும் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('TN-MILLET-MISSION',
     'Tamil Nadu Millet Mission',
     'தமிழ்நாடு சிறுதானிய திட்டம்',
     'state', 'Tamil Nadu',
     NULL, NULL,
     0.0, NULL,
     FALSE,
     ARRAY[]::text[],
     NULL,
     'சிறுதானிய பயிர்களான கம்பு, சோளம், ராகி, வரகு, குதிரைவாலி சாகுபடிக்கு ஊக்கமளிக்கும் திட்டம்.',
     'சிறுதானிய பயிர்கள் சாகுபடி செய்யும் தமிழ்நாட்டு விவசாயிகள்.',
     '2026-01-01', TRUE),

    ('TN-MANNUYIR',
     'Mannuyir Kappom - Soil Conservation',
     'மண்ணுயிர் காப்போம் திட்டம்',
     'state', 'Tamil Nadu',
     NULL, NULL,
     0.0, NULL,
     FALSE,
     ARRAY[]::text[],
     NULL,
     'மண் வளம் மற்றும் நீர்ப்பிடிப்பு பாதுகாப்பிற்கு உதவும் திட்டம். இயற்கை விவசாயத்தை ஊக்கப்படுத்துகிறது.',
     'தமிழ்நாட்டு விவசாயிகள் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('TN-KALAIGNAR-AVIADP',
     'Kalaignar Village Integrated Agriculture Development Programme',
     'கலைஞர் கிராம ஒருங்கிணைந்த வேளாண் திட்டம்',
     'state', 'Tamil Nadu',
     NULL, NULL,
     0.0, NULL,
     FALSE,
     ARRAY[]::text[],
     NULL,
     'கிராம அளவில் ஒருங்கிணைந்த வேளாண்மை மேம்பாடு. விவசாயிகளின் வாழ்வாதாரம் மேம்படுத்தும் திட்டம்.',
     'தமிழ்நாட்டு விவசாய குடும்பங்கள் தகுதியானவர்கள்.',
     '2026-01-01', TRUE),

    ('TN-HILL-FARMERS',
     'Special Scheme for Hill Farmers',
     'மலை விவசாயிகளுக்கான சிறப்பு திட்டம்',
     'state', 'Tamil Nadu',
     NULL, NULL,
     0.0, NULL,
     FALSE,
     ARRAY[]::text[],
     NULL,
     'அரசால் அறிவிக்கப்பட்ட மலை மாவட்டங்களில் வசிக்கும் விவசாயிகளுக்கு சிறப்பு உதவி.',
     'அரசால் அறிவிக்கப்பட்ட மலை மாவட்டங்களில் வசிக்கும் விவசாயிகள் மட்டுமே தகுதியானவர்கள். மாவட்ட விவசாய அலுவலகத்தில் சரிபார்க்கவும்.',
     '2026-01-01', TRUE)

    ON CONFLICT (scheme_id) DO NOTHING
    """))


def downgrade() -> None:
    op.execute(sa.text("""
    DELETE FROM government_schemes WHERE scheme_id IN (
        'CEN-PMKISAN', 'CEN-PMFBY', 'CEN-PMKSY-PDMC', 'CEN-SHC',
        'CEN-KCC', 'CEN-ENAM', 'CEN-PKVY', 'CEN-PMKMY', 'CEN-AIF', 'CEN-KUSUM',
        'TN-TNFR', 'TN-UZHAVAR-SANTHAI', 'TN-MILLET-MISSION',
        'TN-MANNUYIR', 'TN-KALAIGNAR-AVIADP', 'TN-HILL-FARMERS'
    )
    """))
