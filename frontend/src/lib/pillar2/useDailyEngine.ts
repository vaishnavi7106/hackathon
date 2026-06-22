import { useCallback, useEffect, useRef, useState } from 'react'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { needsRecalculation, runDailyCalculation } from './dailyEngine'

/**
 * Triggers the daily calculation for all crops when needed.
 * Call this hook from any page that wants fresh daily data.
 * Only one calculation runs at a time (guarded by isCalculating in store).
 */
export function useDailyEngine() {
  const { profile } = useProfileStore()
  const { lastCalculatedAt, lastPlantingDateUsedByCrop, historyByCrop, isCalculating } =
    useDailyRecordStore()

  const [error, setError] = useState<string | null>(null)

  // Stable key: serialise crop ids + planting dates so useEffect can compare
  const cropsKey = profile.crops.map((c) => `${c.id}:${c.plantingDate}`).join(',')
  const hasCalculatedRef = useRef(false)

  const calculate = useCallback(() => {
    if (!profile.district || profile.crops.length === 0) return
    if (isCalculating) return

    // Find yesterday's rain from first crop's history
    const firstCropId = profile.crops[0]?.id
    const firstHistory = firstCropId ? (historyByCrop[firstCropId] ?? []) : []
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const yesterdayRecord = firstHistory.find((r) => r.date === yesterdayStr)
    const yesterday_rain = yesterdayRecord?.weather?.rain_mm ?? 0

    setError(null)
    runDailyCalculation(profile, yesterday_rain).catch((e) => {
      setError(e instanceof Error ? e.message : String(e))
    })
  }, [profile, isCalculating, historyByCrop])

  useEffect(() => {
    if (!profile.district || profile.crops.length === 0) return

    const anyDateChanged = profile.crops.some(
      (crop) => (crop.plantingDate || '') !== (lastPlantingDateUsedByCrop[crop.id] ?? ''),
    )

    if (!needsRecalculation(lastCalculatedAt) && !anyDateChanged) return
    calculate()
    hasCalculatedRef.current = true
  }, [profile.district, cropsKey, lastCalculatedAt])

  return { isCalculating, error, retry: calculate }
}
