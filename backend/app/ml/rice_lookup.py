"""
Rice Symptom Lookup — Pillar 1 fallback for low-confidence rice diagnoses.

When the MobileNetV2 model confidence is below 0.85 for a rice crop image,
the frontend shows a symptom selector. The farmer picks visible symptoms and
POSTs to /diagnose/rice-symptoms, which uses this table to match the disease.

Confidence reported for symptom matches is always 0.82 — above the 0.70
low-confidence cutoff but clearly below 0.85 ML threshold, so the source
field ("symptom_match") distinguishes it from a direct ML result.
"""

SYMPTOM_CONFIDENCE = 0.82
GENERIC_FALLBACK_ID = "rice_unidentified"

RICE_DISEASES: list[dict] = [
    {
        "disease_id": "rice_blast",
        "name_en": "Rice Blast",
        "name_ta": "நெல் கருகல் நோய்",
        "symptoms": [
            "diamond_shaped_spots",
            "grey_center_spots",
            "brown_border_spots",
            "neck_rot",
            "panicle_damage",
        ],
        "symptom_labels_en": [
            "Diamond-shaped spots on leaves",
            "Spots with grey centre",
            "Spots with brown border",
            "Neck of panicle rotting",
            "Grain formation affected",
        ],
        "symptom_labels_ta": [
            "இலைகளில் வைரம் வடிவ புள்ளிகள்",
            "சாம்பல் நடுவுள்ள புள்ளிகள்",
            "பழுப்பு விளிம்புள்ள புள்ளிகள்",
            "கதிர் கழுத்து அழுகல்",
            "தானிய உருவாக்கம் பாதிப்பு",
        ],
        "modern": {
            "chemical": "Tricyclazole 75% WP",
            "dosage": "0.6g per litre, spray 500L per acre",
            "cost_per_acre": 220,
            "supply_note": "Available at district agri input shop",
        },
        "indigenous": {
            "name": "Pseudomonas fluorescens spray",
            "method": (
                "Mix 5g per litre of water. Spray on leaves at 15-day intervals "
                "from 30 days after transplanting."
            ),
            "preparation_ta": (
                "சூடோமோனாஸ் 5கி/லிட்டர் நீரில் கரைத்து 15 நாள் "
                "இடைவெளியில் தெளிக்கவும்"
            ),
        },
    },
    {
        "disease_id": "rice_bacterial_leaf_blight",
        "name_en": "Bacterial Leaf Blight",
        "name_ta": "நெல் பாக்டீரியல் இலை கருக்கல்",
        "symptoms": [
            "yellow_stripe_leaf_edge",
            "wilting_seedlings",
            "water_soaked_lesions",
            "white_to_yellow_leaves",
            "kresek_seedling_death",
        ],
        "symptom_labels_en": [
            "Yellow stripe along leaf edge",
            "Seedlings wilting and dying",
            "Water-soaked lesions on leaves",
            "Leaves turning white or yellow",
            "Entire seedling collapsing (Kresek)",
        ],
        "symptom_labels_ta": [
            "இலை விளிம்பில் மஞ்சள் கோடு",
            "நாற்றுகள் வாடி இறத்தல்",
            "நீர் ஊறிய புண்கள்",
            "இலைகள் வெள்ளை அல்லது மஞ்சளாதல்",
            "முழு நாற்று சாய்வு (கிரெசெக்)",
        ],
        "modern": {
            "chemical": "Streptomycin 90% + Tetracycline 10% SP",
            "dosage": "300g per acre dissolved in 500L water",
            "cost_per_acre": 160,
            "supply_note": "Prescription required. Available at agricultural offices",
        },
        "indigenous": {
            "name": "TNAU Biocontrol — Streptomyces sp. spray",
            "method": (
                "Seed treatment with bioagent before sowing. "
                "Foliar spray at early infection signs."
            ),
            "preparation_ta": (
                "விதை நேர்த்தி மற்றும் இலை தெளிப்பாக பயன்படுத்தவும்"
            ),
        },
    },
    {
        "disease_id": "rice_sheath_blight",
        "name_en": "Sheath Blight",
        "name_ta": "நெல் உறை அழுகல்",
        "symptoms": [
            "oval_lesions_on_sheath",
            "green_grey_patches_stem",
            "lesions_spreading_upward",
            "white_mycelium_visible",
            "lodging_of_plants",
        ],
        "symptom_labels_en": [
            "Oval lesions on leaf sheath near waterline",
            "Green-grey patches on stem base",
            "Lesions spreading upward toward flag leaf",
            "White fungal growth visible on lesions",
            "Plants falling over (lodging)",
        ],
        "symptom_labels_ta": [
            "நீர் மட்டத்தில் உறையில் நீள்வட்ட புண்கள்",
            "தண்டு அடியில் பச்சை-சாம்பல் திட்டுகள்",
            "புண்கள் மேல்நோக்கி பரவுதல்",
            "புண்களில் வெள்ளை பூஞ்சை தெரிதல்",
            "செடிகள் சாய்தல்",
        ],
        "modern": {
            "chemical": "Hexaconazole 5% EC",
            "dosage": "2ml per litre, spray 500L per acre",
            "cost_per_acre": 190,
            "supply_note": "Available at district agri input shop",
        },
        "indigenous": {
            "name": "Trichoderma viride soil application",
            "method": (
                "Mix 2.5kg Trichoderma with 50kg FYM. "
                "Apply to soil before transplanting."
            ),
            "preparation_ta": (
                "டிரைக்கோடர்மா 2.5கி தொழு உரத்துடன் கலந்து "
                "நடவுக்கு முன் இடவும்"
            ),
        },
    },
    {
        "disease_id": "rice_brown_spot",
        "name_en": "Brown Spot",
        "name_ta": "நெல் பழுப்பு புள்ளி நோய்",
        "symptoms": [
            "circular_brown_spots",
            "spots_with_yellow_halo",
            "spots_on_grain_glumes",
            "seedling_blight",
            "unfilled_grains",
        ],
        "symptom_labels_en": [
            "Circular brown spots on leaves",
            "Spots surrounded by yellow halo",
            "Brown spots on grain husks",
            "Seedling leaves turning brown",
            "Grains remaining unfilled",
        ],
        "symptom_labels_ta": [
            "இலைகளில் வட்ட பழுப்பு புள்ளிகள்",
            "மஞ்சள் வட்டத்துடன் புள்ளிகள்",
            "தானிய உமியில் பழுப்பு புள்ளிகள்",
            "நாற்று இலைகள் பழுப்படைதல்",
            "தானியங்கள் நிரம்பாமல் இருத்தல்",
        ],
        "modern": {
            "chemical": "Mancozeb 75% WP",
            "dosage": "2g per litre, spray 500L per acre",
            "cost_per_acre": 140,
            "supply_note": "Available at district agri input shop",
        },
        "indigenous": {
            "name": "Neem cake soil application",
            "method": (
                "Apply 150kg neem cake per acre before transplanting "
                "to improve soil nutrition and suppress disease."
            ),
            "preparation_ta": (
                "வேப்பம் பிண்ணாக்கு 150கி/ஏக்கர் நடவுக்கு முன் இடவும்"
            ),
        },
    },
    {
        "disease_id": "rice_false_smut",
        "name_en": "False Smut",
        "name_ta": "நெல் பொய் கருங்கால் நோய்",
        "symptoms": [
            "green_velvety_balls_on_grain",
            "orange_yellow_powder",
            "only_few_grains_affected",
            "near_flowering_stage",
        ],
        "symptom_labels_en": [
            "Green velvety balls replacing some grains",
            "Orange or yellow powder released from balls",
            "Only a few grains per panicle affected",
            "Noticed at or after flowering stage",
        ],
        "symptom_labels_ta": [
            "சில தானியங்களை பச்சை வெல்வெட் உருண்டைகள் மாற்றுதல்",
            "உருண்டைகளிலிருந்து ஆரஞ்சு/மஞ்சள் தூள் வெளிவருதல்",
            "ஒரு கதிரில் சில தானியங்கள் மட்டும் பாதிப்பு",
            "பூக்கும் தருணத்தில் அல்லது பின் கண்டறிதல்",
        ],
        "modern": {
            "chemical": "Propiconazole 25% EC",
            "dosage": "1ml per litre, spray at boot leaf stage",
            "cost_per_acre": 210,
            "supply_note": "Spray before flowering for prevention",
        },
        "indigenous": {
            "name": "Copper oxychloride spray",
            "method": (
                "3g per litre spray at booting stage as preventive measure."
            ),
            "preparation_ta": (
                "காப்பர் ஆக்சிகுளோரைடு 3கி/லிட்டர் கதிர் தோற்ற நிலையில் "
                "தெளிக்கவும்"
            ),
        },
    },
    {
        "disease_id": "rice_neck_rot",
        "name_en": "Neck Rot (Neck Blast)",
        "name_ta": "நெல் கழுத்து அழுகல்",
        "symptoms": [
            "panicle_neck_brown_black",
            "panicle_falling_over",
            "white_empty_panicle",
            "at_grain_filling_stage",
        ],
        "symptom_labels_en": [
            "Panicle neck turning brown or black",
            "Panicle bending or falling over",
            "Panicle appears white and empty",
            "Happening during grain filling stage",
        ],
        "symptom_labels_ta": [
            "கதிர் கழுத்து பழுப்பு அல்லது கறுப்பாதல்",
            "கதிர் வளைதல் அல்லது சாய்தல்",
            "கதிர் வெள்ளையாகி காலியாதல்",
            "தானிய நிரவல் நிலையில் நிகழ்தல்",
        ],
        "modern": {
            "chemical": "Tricyclazole 75% WP",
            "dosage": "0.6g per litre, spray at boot leaf stage preventively",
            "cost_per_acre": 220,
            "supply_note": "Prevention is critical — spray before symptoms appear at booting stage",
        },
        "indigenous": {
            "name": "Pseudomonas fluorescens + silicon spray",
            "method": (
                "Foliar spray of Pseudomonas 5g/L at booting stage. "
                "Silicon application strengthens neck tissue."
            ),
            "preparation_ta": (
                "சூடோமோனாஸ் 5கி/லிட்டர் + சிலிக்கன் கதிர் தோற்ற நிலையில் "
                "தெளிக்கவும்"
            ),
        },
    },
]


def get_all_symptom_options() -> list[dict]:
    """
    Return deduplicated list of all symptom keys + bilingual labels
    across all 6 rice diseases. Used to populate the frontend symptom selector.
    """
    seen: set[str] = set()
    options: list[dict] = []
    for disease in RICE_DISEASES:
        for key, label_en, label_ta in zip(
            disease["symptoms"],
            disease["symptom_labels_en"],
            disease["symptom_labels_ta"],
        ):
            if key not in seen:
                seen.add(key)
                options.append({"key": key, "label_en": label_en, "label_ta": label_ta})
    return options


def match_rice_disease(selected_symptoms: list[str]) -> dict:
    """
    Score each rice disease by number of matching symptoms.
    Returns the best match, or a generic fallback if nothing matches.

    Return shape:
        {
            "disease": dict | None,   # entry from RICE_DISEASES
            "match_score": int,
            "matched_symptoms": list[str],
        }
    """
    best_disease: dict | None = None
    best_score = 0
    best_matched: list[str] = []

    selected_set = set(selected_symptoms)

    for disease in RICE_DISEASES:
        disease_symptoms = set(disease["symptoms"])
        matched = list(selected_set & disease_symptoms)
        score = len(matched)
        if score > best_score:
            best_score = score
            best_disease = disease
            best_matched = matched

    return {
        "disease": best_disease,
        "match_score": best_score,
        "matched_symptoms": best_matched,
    }
