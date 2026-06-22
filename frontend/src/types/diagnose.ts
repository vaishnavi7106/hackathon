export interface ModernTreatment {
  chemical: string | null
  dosage: string | null
  cost_per_acre: number | null
  supply_note: string | null
}

export interface IndigenousRemedy {
  name: string | null
  method: string | null
  preparation_ta: string | null
}

export interface TreatmentOut {
  modern: ModernTreatment
  indigenous: IndigenousRemedy
}

export interface DiseaseOut {
  id: string
  name_en: string
  name_ta: string
}

export interface SimilarDisease {
  name_en: string
  name_ta: string
  confidence: number
}

export interface SymptomOption {
  key: string
  label_en: string
  label_ta: string
}

export interface DiagnoseResponse {
  diagnosis_id: string
  disease: DiseaseOut | null
  confidence: number | null
  confidence_level: 'high' | 'medium' | 'low' | null
  source: 'ml_model' | 'symptom_match' | 'symptom_check_needed' | null
  heatmap_url: string | null
  shap_label_ta: string | null
  treatment: TreatmentOut | null
  low_confidence_prompt_ta: string | null
  low_confidence_prompt_en: string | null
  rejection_reason: 'image_quality' | 'similar_diseases' | null
  similar_diseases: SimilarDisease[] | null
  requires_symptom_check: boolean | null
  prompt_en: string | null
  prompt_ta: string | null
  symptoms_to_show: SymptomOption[] | null
  matched_symptoms: string[] | null
  match_score: number | null
}

export interface DiagnoseHistoryItem {
  diagnosis_id: string
  disease_name_ta: string | null
  disease_name_en: string | null
  confidence: number | null
  created_at: string
  heatmap_url: string | null
}

export interface DiagnoseHistoryResponse {
  diagnoses: DiagnoseHistoryItem[]
}
