// Frontend-only symptom data for all 6 TN-priority crops.
// Rice uses the same local matching path when entering from the mismatch flow.
// (The existing backend rice-symptoms endpoint is only used in the normal
//  requires_symptom_check flow returned by the diagnose API.)

export interface SymptomEntry {
  key: string
  label_en: string
  label_ta: string
}

export interface DiseaseEntry {
  disease_id: string
  name_en: string
  name_ta: string
  symptom_keys: string[]
}

export interface CropSymptomData {
  symptoms: SymptomEntry[]
  diseases: DiseaseEntry[]
}

export const SYMPTOM_MAP: Record<string, CropSymptomData> = {

  tomato: {
    symptoms: [
      { key: 'dark_spots',           label_en: 'Dark brown or black spots on leaves',              label_ta: 'இலைகளில் கருப்பு அல்லது கறுப்பு புள்ளிகள்' },
      { key: 'concentric_rings',     label_en: 'Spots have ring patterns (like a target)',          label_ta: 'புள்ளிகளில் வளைய வடிவ கோடுகள்' },
      { key: 'yellow_halo',          label_en: 'Yellow ring around spots',                         label_ta: 'புள்ளிகளை சுற்றி மஞ்சள் நிறம்' },
      { key: 'water_soaked',         label_en: 'Dark water-soaked patches on leaves or stem',      label_ta: 'இலை / தண்டில் நீர் ஊறிய கருமையான திட்டுகள்' },
      { key: 'white_mold_underside', label_en: 'White mould on underside of leaves',              label_ta: 'இலை அடிப்பகுதியில் வெள்ளை பூஞ்சை' },
      { key: 'olive_green_mold',     label_en: 'Olive green or brown mold on upper leaf surface', label_ta: 'இலை மேல் பகுதியில் பச்சை / பழுப்பு பூஞ்சை' },
      { key: 'tiny_dark_dots',       label_en: 'Many tiny dark dots with yellow halos',           label_ta: 'நிறைய சிறிய கருப்பு புள்ளிகள் மஞ்சள் வட்டத்துடன்' },
      { key: 'webbing_mites',        label_en: 'Fine webbing on leaf, tiny mites visible',        label_ta: 'இலை மேல் சிலந்தி வலை, சிறு பூச்சிகள் தெரியும்' },
      { key: 'yellow_curled',        label_en: 'Leaves turn yellow and curl upward',              label_ta: 'இலைகள் மஞ்சளாகி மேல்நோக்கி சுருங்குகின்றன' },
      { key: 'mosaic_pattern',       label_en: 'Light and dark green mosaic/mottled pattern',    label_ta: 'இலைகளில் வெளிர் மற்றும் கடும் பச்சை கலந்த வடிவம்' },
      { key: 'lower_leaves_first',   label_en: 'Bottom leaves affected first',                    label_ta: 'கீழ் இலைகள் முதலில் பாதிப்பு' },
    ],
    diseases: [
      {
        disease_id: 'tomato_bacterial_spot',
        name_en: 'Tomato Bacterial Spot',
        name_ta: 'தக்காளி பாக்டீரியா புள்ளி நோய்',
        symptom_keys: ['dark_spots', 'water_soaked', 'yellow_halo'],
      },
      {
        disease_id: 'tomato_early_blight',
        name_en: 'Tomato Early Blight',
        name_ta: 'தக்காளி முற்கால இலைக்கருகல் நோய்',
        symptom_keys: ['dark_spots', 'concentric_rings', 'yellow_halo', 'lower_leaves_first'],
      },
      {
        disease_id: 'tomato_late_blight',
        name_en: 'Tomato Late Blight',
        name_ta: 'தக்காளி பிற்கால இலைக்கருகல் நோய்',
        symptom_keys: ['water_soaked', 'white_mold_underside', 'dark_spots'],
      },
      {
        disease_id: 'tomato_leaf_mold',
        name_en: 'Tomato Leaf Mold',
        name_ta: 'தக்காளி இலை பூஞ்சாண நோய்',
        symptom_keys: ['olive_green_mold', 'yellow_halo', 'lower_leaves_first'],
      },
      {
        disease_id: 'tomato_septoria_leaf_spot',
        name_en: 'Tomato Septoria Leaf Spot',
        name_ta: 'தக்காளி செப்டோரியா இலைப்புள்ளி நோய்',
        symptom_keys: ['tiny_dark_dots', 'yellow_halo', 'lower_leaves_first'],
      },
      {
        disease_id: 'tomato_spider_mites',
        name_en: 'Tomato Spider Mite Damage',
        name_ta: 'தக்காளி சிலந்தி பூச்சி தாக்குதல்',
        symptom_keys: ['webbing_mites', 'yellow_halo'],
      },
      {
        disease_id: 'tomato_target_spot',
        name_en: 'Tomato Target Spot',
        name_ta: 'தக்காளி இலக்கு புள்ளி நோய்',
        symptom_keys: ['concentric_rings', 'dark_spots'],
      },
      {
        disease_id: 'tomato_yellow_leaf_curl_virus',
        name_en: 'Tomato Yellow Leaf Curl Virus',
        name_ta: 'தக்காளி மஞ்சள் இலை சுருள் வைரஸ்',
        symptom_keys: ['yellow_curled', 'yellow_halo'],
      },
      {
        disease_id: 'tomato_mosaic_virus',
        name_en: 'Tomato Mosaic Virus',
        name_ta: 'தக்காளி மொசைக் வைரஸ்',
        symptom_keys: ['mosaic_pattern', 'yellow_halo'],
      },
    ],
  },

  groundnut: {
    symptoms: [
      { key: 'small_circular_spots', label_en: 'Small circular dark spots on leaves',              label_ta: 'இலைகளில் சிறிய வட்ட கருப்பு புள்ளிகள்' },
      { key: 'light_center',         label_en: 'Spots have a lighter centre',                      label_ta: 'புள்ளிகளின் மையம் வெளிர் நிறமாக உள்ளது' },
      { key: 'dark_all_through',     label_en: 'Spots are very dark all through (no light centre)', label_ta: 'புள்ளிகள் முழுவதும் கருப்பு (மைய வெளிர் நிறம் இல்லை)' },
      { key: 'yellow_halo_gnut',     label_en: 'Yellow ring surrounds the spots',                  label_ta: 'புள்ளிகளை சுற்றி மஞ்சள் வட்டம்' },
      { key: 'lower_leaves_gnut',    label_en: 'Lower leaves affected first',                      label_ta: 'கீழ் இலைகள் முதலில் பாதிப்பு' },
      { key: 'leaves_dropping',      label_en: 'Leaves dropping off the plant',                    label_ta: 'இலைகள் உதிர்கின்றன' },
    ],
    diseases: [
      {
        disease_id: 'groundnut_early_leaf_spot',
        name_en: 'Groundnut Early Leaf Spot',
        name_ta: 'நிலக்கடலை முற்கால இலைப்புள்ளி நோய்',
        symptom_keys: ['small_circular_spots', 'light_center', 'yellow_halo_gnut', 'lower_leaves_gnut'],
      },
      {
        disease_id: 'groundnut_late_leaf_spot',
        name_en: 'Groundnut Late Leaf Spot',
        name_ta: 'நிலக்கடலை பிற்கால இலைப்புள்ளி நோய்',
        symptom_keys: ['small_circular_spots', 'dark_all_through', 'leaves_dropping', 'lower_leaves_gnut'],
      },
    ],
  },

  banana: {
    symptoms: [
      { key: 'yellow_streaks',     label_en: 'Yellow or pale streaks running along the leaf',  label_ta: 'இலையில் மஞ்சள் அல்லது வெளிர் நேர்கோடுகள்' },
      { key: 'brown_dry',          label_en: 'Streaks turn brown and dry out',                  label_ta: 'கோடுகள் பழுப்பாகி காய்கின்றன' },
      { key: 'oval_brown_spots',   label_en: 'Oval brown spots on the leaf surface',            label_ta: 'இலையில் நீள வட்ட பழுப்பு புள்ளிகள்' },
      { key: 'outer_leaves_first', label_en: 'Older outer leaves affected first',               label_ta: 'பழைய வெளி இலைகள் முதலில் பாதிப்பு' },
    ],
    diseases: [
      {
        disease_id: 'banana_sigatoka',
        name_en: 'Banana Sigatoka Leaf Spot',
        name_ta: 'வாழை சிகடோகா இலைப்புள்ளி நோய்',
        symptom_keys: ['yellow_streaks', 'brown_dry', 'oval_brown_spots', 'outer_leaves_first'],
      },
    ],
  },

  sugarcane: {
    symptoms: [
      { key: 'mosaic_patches',  label_en: 'Alternating light and dark green patches on leaves', label_ta: 'இலைகளில் மாறி மாறி வெளிர் மற்றும் கடும் பச்சை திட்டுகள்' },
      { key: 'yellow_stripes',  label_en: 'Yellow or pale stripes along the leaf length',       label_ta: 'இலையில் மஞ்சள் அல்லது வெளிர் கோடுகள்' },
      { key: 'stunted',         label_en: 'Plant growing slowly or looking stunted',            label_ta: 'தாவரம் மெதுவாக வளர்கிறது அல்லது குட்டையாக உள்ளது' },
      { key: 'young_affected',  label_en: 'Young leaves show symptoms first',                   label_ta: 'இளம் இலைகளில் முதலில் அறிகுறிகள் தெரிகின்றன' },
    ],
    diseases: [
      {
        disease_id: 'sugarcane_mosaic',
        name_en: 'Sugarcane Mosaic',
        name_ta: 'கரும்பு மொசைக் நோய்',
        symptom_keys: ['mosaic_patches', 'yellow_stripes', 'stunted', 'young_affected'],
      },
    ],
  },

  maize: {
    symptoms: [
      { key: 'gray_rectangular', label_en: 'Gray or tan rectangular lesions parallel to leaf veins', label_ta: 'நரம்புகளுக்கு இணையாக நீண்ட சாம்பல் திட்டுகள்' },
      { key: 'orange_pustules',  label_en: 'Orange or reddish-brown raised pustules on leaves',     label_ta: 'இலைகளில் ஆரஞ்சு அல்லது செம்பழுப்பு புடைப்புகள்' },
      { key: 'powdery_dust',     label_en: 'Powdery orange/brown dust on leaf surface',             label_ta: 'இலை மேல் ஆரஞ்சு / பழுப்பு தூள்' },
      { key: 'cigar_spots',      label_en: 'Long cigar-shaped tan or gray spots',                   label_ta: 'நீண்ட சிகார் வடிவ சாம்பல் / பழுப்பு திட்டுகள்' },
      { key: 'lower_leaves_mz',  label_en: 'Lower / older leaves affected first',                  label_ta: 'கீழ் / பழைய இலைகளில் முதலில் பாதிப்பு' },
    ],
    diseases: [
      {
        disease_id: 'maize_gray_leaf_spot',
        name_en: 'Maize Gray Leaf Spot',
        name_ta: 'மக்காச்சோளம் சாம்பல் இலைப்புள்ளி நோய்',
        symptom_keys: ['gray_rectangular', 'lower_leaves_mz'],
      },
      {
        disease_id: 'maize_common_rust',
        name_en: 'Maize Common Rust',
        name_ta: 'மக்காச்சோளம் பொதுவான ரஸ்ட் நோய்',
        symptom_keys: ['orange_pustules', 'powdery_dust'],
      },
      {
        disease_id: 'maize_northern_leaf_blight',
        name_en: 'Maize Northern Leaf Blight',
        name_ta: 'மக்காச்சோளம் வடக்கு இலைக்கருகல் நோய்',
        symptom_keys: ['cigar_spots', 'gray_rectangular', 'lower_leaves_mz'],
      },
    ],
  },

  // Rice is included here for the mismatch → "describe symptoms" path.
  // The normal API flow (requires_symptom_check from backend) is unchanged.
  rice: {
    symptoms: [
      { key: 'tip_burn',        label_en: 'Leaf tip turning white or pale',                   label_ta: 'இலை நுனி வெளிர்ப்பு அல்லது வெள்ளையாதல்' },
      { key: 'wavy_margins',    label_en: 'Wavy or water-soaked margins on leaf tips',        label_ta: 'இலை நுனியில் அலை போன்ற அல்லது நீர் ஊறிய விளிம்பு' },
      { key: 'yellow_tip_down', label_en: 'Yellowing spreading from leaf tip downward',       label_ta: 'இலை நுனியிலிருந்து கீழ்நோக்கி மஞ்சளாகுதல்' },
      { key: 'brown_streaks',   label_en: 'Irregular yellow or brown streaks along the leaf', label_ta: 'இலையில் ஒழுங்கற்ற மஞ்சள் அல்லது பழுப்பு கோடுகள்' },
    ],
    diseases: [
      {
        disease_id: 'rice_leaf_scald',
        name_en: 'Rice Leaf Scald',
        name_ta: 'நெல் இலை சுட்டெரிப்பு நோய்',
        symptom_keys: ['tip_burn', 'wavy_margins', 'yellow_tip_down', 'brown_streaks'],
      },
    ],
  },
}

// ── Scoring utility ────────────────────────────────────────────────────────────
// Returns the best-matching disease(s) for the selected symptom keys.
// Returns null if no symptoms matched any disease.
export function matchSymptoms(
  cropId: string,
  selectedKeys: string[],
): DiseaseEntry | null {
  const data = SYMPTOM_MAP[cropId]
  if (!data || selectedKeys.length === 0) return null

  let best: DiseaseEntry | null = null
  let bestScore = 0

  for (const disease of data.diseases) {
    const score = disease.symptom_keys.filter(k => selectedKeys.includes(k)).length
    if (score > bestScore) {
      bestScore = score
      best = disease
    }
  }

  return bestScore > 0 ? best : null
}
