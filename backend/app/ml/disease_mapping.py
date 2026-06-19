"""
Crop Sentinel — Disease ID / Tamil Name Mapping  (43 classes)
Uzhavar AI · Pillar 1

Bridges:
  model output  → PlantVillage-style label  e.g. "Tomato___Early_blight"
  DB / router   → clean slug + Tamil name   e.g. "tomato_early_blight"

Tamil names follow TNAU agricultural terminology.
"""

DISEASE_MAP: dict[str, dict] = {

    # ── Apple (ஆப்பிள்) ───────────────────────────────────────────────────────
    "Apple___Apple_scab": {
        "disease_id": "apple_scab",
        "crop_id": "apple",
        "name_en": "Apple Scab",
        "name_ta": "ஆப்பிள் சாம்பல் நோய்",
    },
    "Apple___Black_rot": {
        "disease_id": "apple_black_rot",
        "crop_id": "apple",
        "name_en": "Apple Black Rot",
        "name_ta": "ஆப்பிள் கருப்பு அழுகல் நோய்",
    },
    "Apple___Cedar_apple_rust": {
        "disease_id": "apple_cedar_rust",
        "crop_id": "apple",
        "name_en": "Apple Cedar Rust",
        "name_ta": "ஆப்பிள் சிடார் ரஸ்ட் நோய்",
    },
    "Apple___healthy": {
        "disease_id": "apple_healthy",
        "crop_id": "apple",
        "name_en": "Apple Healthy",
        "name_ta": "ஆப்பிள் ஆரோக்கியமானது",
    },

    # ── Banana (வாழை) ─────────────────────────────────────────────────────────
    "Banana___Sigatoka": {
        "disease_id": "banana_sigatoka",
        "crop_id": "banana",
        "name_en": "Banana Sigatoka Leaf Spot",
        "name_ta": "வாழை சிகடோகா இலைப்புள்ளி நோய்",
    },

    # ── Blueberry (நீலக்கனி) ──────────────────────────────────────────────────
    "Blueberry___healthy": {
        "disease_id": "blueberry_healthy",
        "crop_id": "blueberry",
        "name_en": "Blueberry Healthy",
        "name_ta": "நீலக்கனி ஆரோக்கியமானது",
    },

    # ── Cherry (செர்ரி) ───────────────────────────────────────────────────────
    "Cherry_(including_sour)___Powdery_mildew": {
        "disease_id": "cherry_powdery_mildew",
        "crop_id": "cherry",
        "name_en": "Cherry Powdery Mildew",
        "name_ta": "செர்ரி பொடி பூஞ்சாண நோய்",
    },
    "Cherry_(including_sour)___healthy": {
        "disease_id": "cherry_healthy",
        "crop_id": "cherry",
        "name_en": "Cherry Healthy",
        "name_ta": "செர்ரி ஆரோக்கியமானது",
    },

    # ── Maize / Corn (மக்காச்சோளம்) ──────────────────────────────────────────
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "disease_id": "maize_gray_leaf_spot",
        "crop_id": "maize",
        "name_en": "Maize Gray Leaf Spot",
        "name_ta": "மக்காச்சோளம் சாம்பல் இலைப்புள்ளி நோய்",
    },
    "Corn_(maize)___Common_rust_": {
        "disease_id": "maize_common_rust",
        "crop_id": "maize",
        "name_en": "Maize Common Rust",
        "name_ta": "மக்காச்சோளம் பொதுவான ரஸ்ட் நோய்",
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "disease_id": "maize_northern_leaf_blight",
        "crop_id": "maize",
        "name_en": "Maize Northern Leaf Blight",
        "name_ta": "மக்காச்சோளம் வடக்கு இலைக்கருகல் நோய்",
    },
    "Corn_(maize)___healthy": {
        "disease_id": "maize_healthy",
        "crop_id": "maize",
        "name_en": "Maize Healthy",
        "name_ta": "மக்காச்சோளம் ஆரோக்கியமானது",
    },

    # ── Grape (திராட்சை) ──────────────────────────────────────────────────────
    "Grape___Black_rot": {
        "disease_id": "grape_black_rot",
        "crop_id": "grape",
        "name_en": "Grape Black Rot",
        "name_ta": "திராட்சை கருப்பு அழுகல் நோய்",
    },
    "Grape___Esca_(Black_Measles)": {
        "disease_id": "grape_esca",
        "crop_id": "grape",
        "name_en": "Grape Esca (Black Measles)",
        "name_ta": "திராட்சை எஸ்கா நோய்",
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "disease_id": "grape_leaf_blight",
        "crop_id": "grape",
        "name_en": "Grape Leaf Blight",
        "name_ta": "திராட்சை இலைக்கருகல் நோய்",
    },
    "Grape___healthy": {
        "disease_id": "grape_healthy",
        "crop_id": "grape",
        "name_en": "Grape Healthy",
        "name_ta": "திராட்சை ஆரோக்கியமானது",
    },

    # ── Groundnut (நிலக்கடலை) ─────────────────────────────────────────────────
    "Groundnut___Early_leaf_spot": {
        "disease_id": "groundnut_early_leaf_spot",
        "crop_id": "groundnut",
        "name_en": "Groundnut Early Leaf Spot",
        "name_ta": "நிலக்கடலை முற்கால இலைப்புள்ளி நோய்",
    },
    "Groundnut___Late_leaf_spot": {
        "disease_id": "groundnut_late_leaf_spot",
        "crop_id": "groundnut",
        "name_en": "Groundnut Late Leaf Spot",
        "name_ta": "நிலக்கடலை பிற்கால இலைப்புள்ளி நோய்",
    },

    # ── Orange (ஆரஞ்சு) ───────────────────────────────────────────────────────
    "Orange___Haunglongbing_(Citrus_greening)": {
        "disease_id": "orange_citrus_greening",
        "crop_id": "orange",
        "name_en": "Orange Citrus Greening (HLB)",
        "name_ta": "ஆரஞ்சு சிட்ரஸ் பச்சையடித்தல் நோய்",
    },

    # ── Peach (பீச்) ──────────────────────────────────────────────────────────
    "Peach___Bacterial_spot": {
        "disease_id": "peach_bacterial_spot",
        "crop_id": "peach",
        "name_en": "Peach Bacterial Spot",
        "name_ta": "பீச் பாக்டீரியா புள்ளி நோய்",
    },
    "Peach___healthy": {
        "disease_id": "peach_healthy",
        "crop_id": "peach",
        "name_en": "Peach Healthy",
        "name_ta": "பீச் ஆரோக்கியமானது",
    },

    # ── Bell Pepper (குடைமிளகாய்) ─────────────────────────────────────────────
    "Pepper,_bell___Bacterial_spot": {
        "disease_id": "pepper_bacterial_spot",
        "crop_id": "pepper",
        "name_en": "Bell Pepper Bacterial Spot",
        "name_ta": "குடைமிளகாய் பாக்டீரியா புள்ளி நோய்",
    },
    "Pepper,_bell___healthy": {
        "disease_id": "pepper_healthy",
        "crop_id": "pepper",
        "name_en": "Bell Pepper Healthy",
        "name_ta": "குடைமிளகாய் ஆரோக்கியமானது",
    },

    # ── Potato (உருளைக்கிழங்கு) ───────────────────────────────────────────────
    "Potato___Early_blight": {
        "disease_id": "potato_early_blight",
        "crop_id": "potato",
        "name_en": "Potato Early Blight",
        "name_ta": "உருளைக்கிழங்கு முற்கால இலைக்கருகல் நோய்",
    },
    "Potato___Late_blight": {
        "disease_id": "potato_late_blight",
        "crop_id": "potato",
        "name_en": "Potato Late Blight",
        "name_ta": "உருளைக்கிழங்கு பிற்கால இலைக்கருகல் நோய்",
    },
    "Potato___healthy": {
        "disease_id": "potato_healthy",
        "crop_id": "potato",
        "name_en": "Potato Healthy",
        "name_ta": "உருளைக்கிழங்கு ஆரோக்கியமானது",
    },

    # ── Raspberry (ராஸ்பெர்ரி) ────────────────────────────────────────────────
    "Raspberry___healthy": {
        "disease_id": "raspberry_healthy",
        "crop_id": "raspberry",
        "name_en": "Raspberry Healthy",
        "name_ta": "ராஸ்பெர்ரி ஆரோக்கியமானது",
    },

    # ── Rice (நெல்) ───────────────────────────────────────────────────────────
    "Rice___Leaf_scald": {
        "disease_id": "rice_leaf_scald",
        "crop_id": "rice",
        "name_en": "Rice Leaf Scald",
        "name_ta": "நெல் இலை சுட்டெரிப்பு நோய்",
    },

    # ── Soybean (சோயாபீன்) ────────────────────────────────────────────────────
    "Soybean___healthy": {
        "disease_id": "soybean_healthy",
        "crop_id": "soybean",
        "name_en": "Soybean Healthy",
        "name_ta": "சோயாபீன் ஆரோக்கியமானது",
    },

    # ── Squash (சுரைக்காய்) ───────────────────────────────────────────────────
    "Squash___Powdery_mildew": {
        "disease_id": "squash_powdery_mildew",
        "crop_id": "squash",
        "name_en": "Squash Powdery Mildew",
        "name_ta": "சுரைக்காய் பொடி பூஞ்சாண நோய்",
    },

    # ── Strawberry (ஸ்ட்ராபெர்ரி) ────────────────────────────────────────────
    "Strawberry___Leaf_scorch": {
        "disease_id": "strawberry_leaf_scorch",
        "crop_id": "strawberry",
        "name_en": "Strawberry Leaf Scorch",
        "name_ta": "ஸ்ட்ராபெர்ரி இலை கருகல் நோய்",
    },
    "Strawberry___healthy": {
        "disease_id": "strawberry_healthy",
        "crop_id": "strawberry",
        "name_en": "Strawberry Healthy",
        "name_ta": "ஸ்ட்ராபெர்ரி ஆரோக்கியமானது",
    },

    # ── Sugarcane (கரும்பு) ───────────────────────────────────────────────────
    "Sugarcane___Mosaic": {
        "disease_id": "sugarcane_mosaic",
        "crop_id": "sugarcane",
        "name_en": "Sugarcane Mosaic",
        "name_ta": "கரும்பு மொசைக் நோய்",
    },

    # ── Tomato (தக்காளி) ──────────────────────────────────────────────────────
    "Tomato___Bacterial_spot": {
        "disease_id": "tomato_bacterial_spot",
        "crop_id": "tomato",
        "name_en": "Tomato Bacterial Spot",
        "name_ta": "தக்காளி பாக்டீரியா புள்ளி நோய்",
    },
    "Tomato___Early_blight": {
        "disease_id": "tomato_early_blight",
        "crop_id": "tomato",
        "name_en": "Tomato Early Blight",
        "name_ta": "தக்காளி முற்கால இலைக்கருகல் நோய்",
    },
    "Tomato___Late_blight": {
        "disease_id": "tomato_late_blight",
        "crop_id": "tomato",
        "name_en": "Tomato Late Blight",
        "name_ta": "தக்காளி பிற்கால இலைக்கருகல் நோய்",
    },
    "Tomato___Leaf_Mold": {
        "disease_id": "tomato_leaf_mold",
        "crop_id": "tomato",
        "name_en": "Tomato Leaf Mold",
        "name_ta": "தக்காளி இலை பூஞ்சாண நோய்",
    },
    "Tomato___Septoria_leaf_spot": {
        "disease_id": "tomato_septoria_leaf_spot",
        "crop_id": "tomato",
        "name_en": "Tomato Septoria Leaf Spot",
        "name_ta": "தக்காளி செப்டோரியா இலைப்புள்ளி நோய்",
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "disease_id": "tomato_spider_mites",
        "crop_id": "tomato",
        "name_en": "Tomato Two-Spotted Spider Mite",
        "name_ta": "தக்காளி இரட்டை புள்ளி சிலந்தி பூச்சி தாக்குதல்",
    },
    "Tomato___Target_Spot": {
        "disease_id": "tomato_target_spot",
        "crop_id": "tomato",
        "name_en": "Tomato Target Spot",
        "name_ta": "தக்காளி இலக்கு புள்ளி நோய்",
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "disease_id": "tomato_yellow_leaf_curl_virus",
        "crop_id": "tomato",
        "name_en": "Tomato Yellow Leaf Curl Virus",
        "name_ta": "தக்காளி மஞ்சள் இலை சுருள் வைரஸ்",
    },
    "Tomato___Tomato_mosaic_virus": {
        "disease_id": "tomato_mosaic_virus",
        "crop_id": "tomato",
        "name_en": "Tomato Mosaic Virus",
        "name_ta": "தக்காளி மொசைக் வைரஸ்",
    },
    "Tomato___healthy": {
        "disease_id": "tomato_healthy",
        "crop_id": "tomato",
        "name_en": "Tomato Healthy",
        "name_ta": "தக்காளி ஆரோக்கியமானது",
    },
}

REVERSE_DISEASE_MAP: dict[str, str] = {
    v["disease_id"]: label for label, v in DISEASE_MAP.items()
}


def get_disease_meta(label: str) -> dict:
    if label not in DISEASE_MAP:
        raise KeyError(
            f"No DB mapping for model label '{label}'. "
            f"Add it to DISEASE_MAP in disease_mapping.py."
        )
    return DISEASE_MAP[label]