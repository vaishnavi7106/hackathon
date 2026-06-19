"""Add benefit_amount_ta column and populate Tamil benefit text for all schemes

Revision ID: 010
Revises: 009
Create Date: 2026-06-18
"""
from alembic import op
from sqlalchemy.sql import text

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None

_BENEFITS_TA = {
    "CEN-PMKISAN": "ஆண்டுக்கு ₹6,000 மூன்று தவணைகளில் நேரடி வங்கி பரிமாற்றம்",
    "CEN-PMFBY":   "பயிர் காப்பீட்டு இழப்பு ஈடு. விவசாயி பங்களிப்பு: கரீப் 2%, ரபி 1.5%, தோட்டப் பயிர்கள் 5%",
    "CEN-PMKSY":   "சொட்டு நீர் மற்றும் தெளிப்பு நீர்ப்பாசன அமைப்புகளில் 55%+ மானியம்",
    "CEN-SHC":     "இலவச மண் பரிசோதனை மற்றும் பயிர்வாரி ஊட்டச்சத்து பரிந்துரை மண் வள அட்டை",
    "CEN-KCC":     "₹5 லட்சம் வரை குறுகிய கால சுழல் கடன். சரியான நேரத்தில் திருப்பித் தந்தால் சுமார் 4% வட்டி",
    "CEN-ENAM":    "நேரடி பண நன்மை இல்லை. விலை வெளிப்படைத்தன்மை மற்றும் நேரடி விற்பனைக்கு ஆன்லைன் வர்த்தக தளம்",
    "CEN-PKVY":    "மூன்று ஆண்டுகளுக்கு ஹெக்டேருக்கு ₹6,000/ஆண்டு நிதி உதவி",
    "CEN-PMKMY":   "60 வயதிற்கு பிறகு மாதம் ₹3,000 ஓய்வூதியம். அரசு விவசாயியின் மாதாந்திர பங்களிப்பை நேர் சரியாக செலுத்தும்",
    "CEN-TNFR":    "நேரடி பண நன்மை இல்லை. அனைத்து திட்டங்களுக்கும் தடையற்ற அணுகலுக்கான தனித்துவமான விவசாயி அடையாள எண்",
    "TN-AGRI-162": "ஒரு ஒருங்கிணைந்த பண்ணைய அலகுக்கு ₹30,000 வரை 50% மானியம்",
    "TN-AGRI-163": "கூறுக்கு ஏற்ப மாறுபடும் (நடவு துவரைக்கு ₹9,000/ஹெக்டேர் 50% மானியம்)",
    "TN-AGRI-164": "கூறுக்கு ஏற்ப மாறுபடும் (திரட்டு செயல் விளக்கத்திற்கு ₹5,000/ஹெக்டேர்)",
    "TN-AGRI-172": "இடுபொருட்களில் (விதைகள், உரங்கள், உயிர்க் கட்டுப்பாட்டு முகவர்கள்) 50% மானியம்",
    "TN-AGRI-173": "ஒரு ஒருங்கிணைந்த பண்ணைய அலகுக்கு ₹30,000 வரை 50% மானியம்",
    "TN-AGRI-174": "மூன்று ஆண்டுகளுக்கு ஹெக்டேருக்கு ₹6,000/ஆண்டு (முதல் ஆண்டில் ₹2,000)",
    "TN-AGRI-175": "பாரம்பரிய நெல் விதைகளில் 50% மானியம்; 300 டன் விதை விநியோகத்திற்கு மொத்தம் ₹75 லட்சம்",
}


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(
        "ALTER TABLE government_schemes ADD COLUMN IF NOT EXISTS benefit_amount_ta VARCHAR(200)"
    ))
    for scheme_id, ta in _BENEFITS_TA.items():
        conn.execute(
            text("UPDATE government_schemes SET benefit_amount_ta = :ta WHERE scheme_id = :sid"),
            {"ta": ta, "sid": scheme_id},
        )


def downgrade() -> None:
    op.get_bind().execute(text(
        "ALTER TABLE government_schemes DROP COLUMN IF EXISTS benefit_amount_ta"
    ))
