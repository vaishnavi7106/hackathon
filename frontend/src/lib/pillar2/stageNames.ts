export interface StageInfo {
  name: string    // English
  name_ta: string // Tamil
  dayRange: string
}

// Spec-defined stage names (replace all Day X labels everywhere)
const RICE_STAGES: Array<{ from: number; to: number; name: string; name_ta: string }> = [
  { from: 0,  to: 0,   name: 'Transplanting',         name_ta: 'நடவு' },
  { from: 1,  to: 20,  name: 'Early Vegetative',       name_ta: 'ஆரம்ப வளர்ச்சி' },
  { from: 21, to: 40,  name: 'Tillering',              name_ta: 'துரவு' },
  { from: 41, to: 60,  name: 'Panicle Initiation',     name_ta: 'கதிர் தோற்றம்' },
  { from: 61, to: 80,  name: 'Flowering',              name_ta: 'பூக்கும் தருணம்' },
  { from: 81, to: 999, name: 'Grain Filling',          name_ta: 'மணி நிரவல்' },
]

/**
 * Returns stage info (name, Tamil name, day range) for the given stage_days.
 * Falls back to FAO stage name strings for non-rice crops.
 */
export function getStageName(stageDays: number, crop = 'rice'): StageInfo {
  if (crop.toLowerCase() === 'rice' || crop.toLowerCase() === 'paddy') {
    for (const stage of RICE_STAGES) {
      if (stageDays >= stage.from && stageDays <= stage.to) {
        return {
          name: stage.name,
          name_ta: stage.name_ta,
          dayRange: stage.from === stage.to
            ? `Day ${stage.from}`
            : stage.to === 999
            ? `Day ${stage.from}+`
            : `Day ${stage.from}–${stage.to}`,
        }
      }
    }
    const last = RICE_STAGES[RICE_STAGES.length - 1]
    return { name: last.name, name_ta: last.name_ta, dayRange: `Day ${last.from}+` }
  }

  // Generic fallback for other crops — return generic FAO stage labels
  if (stageDays === 0) return { name: 'Initial', name_ta: 'ஆரம்பம்', dayRange: 'Day 0' }
  if (stageDays <= 30) return { name: 'Development', name_ta: 'வளர்ச்சி', dayRange: `Day 1–30` }
  if (stageDays <= 70) return { name: 'Mid Season', name_ta: 'நடு பருவம்', dayRange: `Day 31–70` }
  return { name: 'Late Season', name_ta: 'இறுதி பருவம்', dayRange: `Day 71+` }
}

/**
 * Returns the first day of the NEXT stage for the given stageDays.
 * Returns null if already in the last stage.
 */
export function getNextStageDays(stageDays: number, crop = 'rice'): number | null {
  if (crop.toLowerCase() === 'rice' || crop.toLowerCase() === 'paddy') {
    for (let i = 0; i < RICE_STAGES.length - 1; i++) {
      const stage = RICE_STAGES[i]
      if (stageDays >= stage.from && stageDays <= stage.to) {
        return RICE_STAGES[i + 1].from
      }
    }
    return null // already in last stage
  }

  // Generic fallback
  if (stageDays === 0) return 1
  if (stageDays <= 30) return 31
  if (stageDays <= 70) return 71
  return null
}
