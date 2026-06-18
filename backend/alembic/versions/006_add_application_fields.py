"""Pillar 4 — Add application_mode, application_portal_name,
application_process_summary, verification_status columns.
Update all 24 scheme records with authoritative data from the
Uzhavan AI Unified Agricultural Scheme Database (2026-06-17).
Also update application_url values to more specific registration pages
where the new dataset provides them.

Revision ID: 006
Revises: 005
Create Date: 2026-06-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Per-scheme application data from the authoritative dataset.
# application_url updated where the new dataset provides a more specific page.
# ---------------------------------------------------------------------------
_DATA = [
    {
        "scheme_id": "CEN-PMKISAN",
        "application_mode": "HYBRID",
        "application_url": "https://pmkisan.gov.in/NewFarmerRegistration.aspx",
        "application_portal_name": "PM-KISAN Official Portal — Farmers Corner",
        "application_process_summary": (
            "Online: Visit pmkisan.gov.in → Farmers Corner → New Farmer Registration "
            "→ enter Aadhaar, mobile, state → fill personal and land details → complete "
            "e-KYC (OTP/biometric/face auth) → submit. Also available via PMKISAN mobile "
            "app (Google Play). Offline: Visit nearest Common Service Centre (CSC) or "
            "Jan Seva Kendra — operator registers on portal on farmer's behalf for a "
            "nominal fee. State nodal officers and local revenue officers can also assist."
        ),
        "verification_status": "VERIFIED — official portal confirmed live",
    },
    {
        "scheme_id": "CEN-PMFBY",
        "application_mode": "HYBRID",
        "application_url": "https://pmfby.gov.in",
        "application_portal_name": "National Crop Insurance Portal (PMFBY)",
        "application_process_summary": (
            "Three enrolment channels: (1) Online — visit pmfby.gov.in → Farmer Corner "
            "→ create login → select state/district/crop/season → pay premium online. "
            "(2) Bank — visit crop loan bank branch (especially for KCC holders; premium "
            "auto-debited). (3) CSC — visit nearest Common Service Centre. Season-specific "
            "deadlines apply (Kharif: approx July 31; Rabi: approx December 31). "
            "Losses reported within 72 hours via pmfby.gov.in, PMFBY app, or call to 14447."
        ),
        "verification_status": "VERIFIED — official portal confirmed live",
    },
    {
        "scheme_id": "CEN-PMKSY",
        "application_mode": "HYBRID",
        "application_url": "https://pmksy.gov.in",
        "application_portal_name": "PMKSY Official Portal / Tamil Nadu Agricultural Engineering Department (aed.tn.gov.in)",
        "application_process_summary": (
            "In Tamil Nadu, applications are submitted offline through the nearest "
            "Agriculture / Horticulture / Agricultural Engineering Department office with "
            "required documents and a BIS-certified equipment quotation. The Tamil Nadu "
            "NIC portal (pmksy.nic.in) is available for department-level processing. "
            "Beneficiary identification, inspection, and subsidy disbursement (DBT to "
            "bank account) is handled through the state department."
        ),
        "verification_status": "VERIFIED — pmksy.gov.in live; TN state portal aed.tn.gov.in confirmed",
    },
    {
        "scheme_id": "CEN-SHC",
        "application_mode": "HYBRID",
        "application_url": "https://soilhealth.dac.gov.in",
        "application_portal_name": "Soil Health Card Portal — Ministry of Agriculture",
        "application_process_summary": (
            "Online: Visit soilhealth.dac.gov.in → farmer module → enter state, land "
            "details and Aadhaar → request soil sample collection. Government field staff "
            "visit and collect samples. Offline: Apply at nearest Krishi Vigyan Kendra "
            "(KVK), Block Agriculture Office, or Gram Panchayat — fill form with Aadhaar, "
            "land records, and crop details. Soil sample collected within 15-30 days; "
            "SHC available digitally on portal or as printout from extension office. "
            "Card reissued every 2-3 years. Helpline: 011-24305591."
        ),
        "verification_status": "VERIFIED — soilhealth.dac.gov.in live; PIB article confirms process",
    },
    {
        "scheme_id": "CEN-KCC",
        "application_mode": "HYBRID",
        "application_url": "https://www.jansamarth.in/kisan-credit-card-scheme",
        "application_portal_name": "JanSamarth Portal (Ministry of Finance) — KCC Scheme Page",
        "application_process_summary": (
            "Online: Visit jansamarth.in/kisan-credit-card-scheme → check eligibility → "
            "fill online application → select bank → get in-principle digital approval → "
            "bank processes final disbursement. Also apply via individual bank websites or "
            "apps (SBI YONO, PNB, etc.). Offline: Visit nearest bank branch (SBI, "
            "cooperative bank, RRB) with documents — PM-KISAN beneficiaries only need a "
            "one-page simplified form. Bank issues RuPay KCC debit card."
        ),
        "verification_status": "VERIFIED — jansamarth.in KCC page confirmed live",
    },
    {
        "scheme_id": "CEN-ENAM",
        "application_mode": "HYBRID",
        "application_url": "https://enam.gov.in/NAMV2/home/other_register.html",
        "application_portal_name": "e-NAM Portal — Farmer Registration",
        "application_process_summary": (
            "Three registration methods: (1) Online — visit enam.gov.in → select "
            "Registration Type as Farmer → select APMC → provide email, Aadhaar, bank "
            "details → receive temporary login → complete KYC on dashboard → APMC approves "
            "and issues permanent Farmer ID. (2) e-NAM mobile app (Google Play/App Store) "
            "— same process. (3) Mandi gate entry — visit nearest e-NAM mandi with "
            "documents; staff registers at the gate. No fee for registration."
        ),
        "verification_status": "VERIFIED — registration page and guidelines confirmed live on enam.gov.in",
    },
    {
        "scheme_id": "CEN-PKVY",
        "application_mode": "HYBRID",
        "application_url": "https://pgsindia-ncof.gov.in/pkvy/Introduction.aspx",
        "application_portal_name": "PGS-India / NCOF — PKVY Portal",
        "application_process_summary": (
            "Online: Visit pgsindia-ncof.gov.in → register cluster on PGS-India portal "
            "with farmer group details and land records → submit to Regional Council (RC). "
            "Offline: Contact nearest State Agriculture Department PKVY nodal officer or "
            "Regional Council → form/join a cluster of 50+ farmers → RC consolidates "
            "applications into Annual Action Plan → submitted to Ministry for fund approval "
            "→ financial assistance via DBT to individual farmer accounts."
        ),
        "verification_status": "VERIFIED — pgsindia-ncof.gov.in PKVY page confirmed live",
    },
    {
        "scheme_id": "CEN-PMKMY",
        "application_mode": "OFFLINE",
        "application_url": "https://pmkmy.gov.in",
        "application_portal_name": "PM Kisan Maan Dhan Yojana Official Portal",
        "application_process_summary": (
            "Primarily offline via CSC: visit nearest Common Service Centre (CSC) with "
            "Aadhaar, bank passbook and mobile number → biometric Aadhaar authentication "
            "→ operator fills enrollment form → first contribution paid → auto-debit set "
            "up → unique KPAN generated and Kisan Card printed. PM-KISAN beneficiaries "
            "can opt for auto-deduction from their PM-KISAN installment. Online check via "
            "pmkmy.gov.in for status only. Helpline: 1800-267-6888."
        ),
        "verification_status": "VERIFIED — pmkmy.gov.in confirmed live; CSC enrollment process confirmed",
    },
    {
        "scheme_id": "CEN-TNFR",
        "application_mode": "HYBRID",
        "application_url": "https://tnfr.agristack.gov.in",
        "application_portal_name": "Tamil Nadu Farmer Registry — AgriStack Portal",
        "application_process_summary": (
            "Online: Visit tnfr.agristack.gov.in → New Farmer Registration → enter "
            "Aadhaar → OTP verification → upload Chitta/Adangal → fill crop and bank "
            "details → submit → Farmer ID issued. Offline: Visit nearest CSC / Common "
            "Service Centre with Aadhaar, Chitta, Adangal, Patta and bank passbook — "
            "CSC operator completes registration. Farmer ID checked at "
            "tnfr.agristack.gov.in → Check Enrollment Status. Helpline: 1800-180-1551."
        ),
        "verification_status": "VERIFIED — tnfr.agristack.gov.in confirmed live",
    },
    {
        "scheme_id": "TN-AGRI-147",
        "application_mode": "HYBRID",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department Schemes Portal",
        "application_process_summary": (
            "Apply through nearest Block Agriculture Office or District Agriculture Office "
            "with Patta, Chitta, Adangal. Online input registration also available via "
            "tnagrisnet.tn.gov.in/esevai/ (Agri Online E-Sevai). A dedicated SMAM "
            "application portal is also accessible at tnagrisnet.tn.gov.in/KaviaDP/"
            "scheme_register for some components. Selection is through local agriculture "
            "officer verification and committee approval."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in schemes page confirmed live; e-Sevai portal confirmed",
    },
    {
        "scheme_id": "TN-AGRI-153",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline through nearest Block Agriculture Office or District Agriculture "
            "Office. Farmer submits Aadhaar, Patta and Adangal; local agriculture officer "
            "verifies eligibility and enrolls. Scheme benefits (vermicompost units, "
            "seedlings, inputs) distributed at block/district level. Information available "
            "at tnagrisnet.tn.gov.in."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-162",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office in the eligible districts. "
            "Submit Patta, Adangal, Aadhaar and bank passbook. Agriculture officer "
            "verifies and recommends beneficiary. Subsidy (up to ₹30,000) transferred "
            "to farmer bank account via DBT after physical inspection of IFS unit."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-163",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office. Submit documents based on "
            "the specific NADP component (maize, redgram, cotton, paddy). Agriculture "
            "officer verifies eligibility and enrolls. Subsidy on inputs and cash "
            "assistance transferred via DBT."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-164",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office in eligible districts. "
            "Submit documents relevant to the specific crop component. For back-ended "
            "subsidy components, purchase bills and photo documentation required at time "
            "of application. Benefits via DBT after verification."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-165",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office in the 25 eligible Millet "
            "Special Zone districts. Submit Aadhaar, Chitta and Adangal. Agriculture "
            "officer verifies district eligibility and enrolls farmer. Seeds and inputs "
            "distributed at block level or transferred via DBT."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-167",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply through the Block Agriculture Office in the designated sub-basin area. "
            "Submit Aadhaar, Patta, Chitta and bank passbook. Agriculture officer confirms "
            "sub-basin eligibility and processes enrollment. Benefits include seeds, "
            "demonstration plot support, training and vermicompost unit subsidy."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-168",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office or through the Tamil Nadu "
            "Seeds Development Agency (TANSEDA). Submit Chitta, Aadhaar and ration card. "
            "For seed farm registration, additional documentation on land suitability "
            "required. Seeds distributed at subsidised rates through block-level "
            "distribution camps."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-171",
        "application_mode": "HYBRID",
        "application_url": "https://www.tnagrisnet.tn.gov.in/KaviaDP/scheme_register",
        "application_portal_name": "TNAGRISNET — KAVIADP Online Registration Portal",
        "application_process_summary": (
            "Online: Visit tnagrisnet.tn.gov.in/KaviaDP/scheme_register → fill "
            "Registration Form → track at Track Application page on same portal. "
            "Offline: Submit documents at nearest Block Agriculture Office or Village "
            "Panchayat in the selected village. Benefits distributed at village level "
            "including coconut seedlings, inputs and infrastructure support."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in/KaviaDP/scheme_register confirmed live",
    },
    {
        "scheme_id": "TN-AGRI-172",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office. Submit Aadhaar, bank "
            "passbook and seed farm registration details. For back-ended subsidy "
            "components, purchase vouchers and photo documentation are required. "
            "Agriculture officer verifies and processes. Subsidy disbursed via DBT."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-173",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office in the 29 eligible "
            "districts. Submit Chitta/Adangal, Aadhaar and bank passbook. Agriculture "
            "officer inspects farm and verifies IFS components. Subsidy (up to ₹30,000) "
            "transferred to bank account via DBT after physical verification."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-174",
        "application_mode": "HYBRID",
        "application_url": "https://pgsindia-ncof.gov.in/pkvy/Introduction.aspx",
        "application_portal_name": "PGS-India / NCOF — PKVY Portal (State implementation through TN Agriculture Dept)",
        "application_process_summary": (
            "Contact State Agriculture Department PKVY nodal officer or Block Agriculture "
            "Office. Form/join a cluster of 50+ farmers on at least 50 acres. Register "
            "cluster on pgsindia-ncof.gov.in PGS-India portal. Regional Council submits "
            "Annual Action Plan to Ministry. Financial assistance (₹6,000/Ha/year) "
            "disbursed via DBT to individual farmer accounts over 3 years."
        ),
        "verification_status": "VERIFIED — pgsindia-ncof.gov.in PKVY page confirmed live",
    },
    {
        "scheme_id": "TN-AGRI-175",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply at nearest Block Agriculture Office with Chitta, Adangal and Aadhaar. "
            "Component-specific applications (cotton, redgram, alternative crops, ZnSO4) "
            "filed separately with the relevant section of the agriculture office. "
            "Traditional paddy seeds distributed at 50% subsidy through TANSEDA seed "
            "farms. Benefits via DBT."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-176",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply offline at nearest Block Agriculture Office with Aadhaar, Patta and "
            "Adangal. Agriculture officer verifies and enrolls. Benefits (vermicompost "
            "beds, neem saplings, green manure seeds, organic model plot support, "
            "medicinal plant cuttings) distributed at block/district level camps."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
    {
        "scheme_id": "TN-AGRI-177",
        "application_mode": "OFFLINE",
        "application_url": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        "application_portal_name": "TNAGRISNET — Tamil Nadu Agriculture Department",
        "application_process_summary": (
            "Apply at nearest Block Agriculture Office in eligible delta districts during "
            "the Kuruvai season enrollment window. Submit Chitta, Adangal, Aadhaar and "
            "bank passbook. Agriculture officer verifies paddy cultivation and Kuruvai "
            "season eligibility. Seeds and inputs distributed at block-level camps or "
            "DBT to bank account."
        ),
        "verification_status": "VERIFIED — tnagrisnet.tn.gov.in confirmed",
    },
]

_UPDATE_SQL = sa.text("""
    UPDATE government_schemes SET
        application_mode           = :application_mode,
        application_url            = :application_url,
        application_portal_name    = :application_portal_name,
        application_process_summary = :application_process_summary,
        verification_status        = :verification_status,
        updated_at                 = now()
    WHERE scheme_id = :scheme_id
""")


def upgrade() -> None:
    op.add_column("government_schemes", sa.Column("application_mode", sa.String(20), nullable=True))
    op.add_column("government_schemes", sa.Column("application_portal_name", sa.String(500), nullable=True))
    op.add_column("government_schemes", sa.Column("application_process_summary", sa.Text(), nullable=True))
    op.add_column("government_schemes", sa.Column("verification_status", sa.String(200), nullable=True))

    conn = op.get_bind()
    for row in _DATA:
        conn.execute(_UPDATE_SQL, row)


def downgrade() -> None:
    for col in ("application_mode", "application_portal_name",
                "application_process_summary", "verification_status"):
        op.drop_column("government_schemes", col)
