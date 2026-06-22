import { useState } from 'react'
import type { SymptomOption } from '@/types/diagnose'
import { cn } from '@/lib/utils'

type Lang = 'ta' | 'en'

const L = {
  ta: {
    heading: 'அறிகுறிகளை தேர்ந்தெடுக்கவும்',
    subheading: 'நீங்கள் பயிரில் காணும் அறிகுறிகளை தேர்வு செய்யுங்கள்',
    none_selected: 'குறைந்தது ஒரு அறிகுறி தேர்ந்தெடுக்கவும்',
    confirm: 'கண்டறிக →',
    confirming: 'கண்டறிகிறது…',
    selected: 'தேர்ந்தெடுக்கப்பட்டது',
  },
  en: {
    heading: 'Select Symptoms',
    subheading: 'Choose all the symptoms you can see on your crop',
    none_selected: 'Select at least one symptom',
    confirm: 'Identify →',
    confirming: 'Identifying…',
    selected: 'selected',
  },
} as const

interface Props {
  lang: Lang
  promptText: string
  symptoms: SymptomOption[]
  loading: boolean
  onSubmit: (selected: string[]) => void
}

export function SymptomSelector({ lang, promptText, symptoms, loading, onSubmit }: Props) {
  const t = L[lang]
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState(false)

  function toggle(key: string) {
    setError(false)
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleSubmit() {
    if (selected.size === 0) { setError(true); return }
    onSubmit(Array.from(selected))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border border-amber-200">
        <div className="px-4 py-3" style={{ background: '#92400E' }}>
          <p className="text-xs font-bold tracking-wide text-amber-200 uppercase">{t.heading}</p>
        </div>
        <div className="bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 leading-relaxed">{promptText}</p>
          <p className="text-xs text-amber-700 mt-1">{t.subheading}</p>
        </div>
      </div>

      {/* Symptom grid */}
      <div className="grid grid-cols-1 gap-2">
        {symptoms.map((s) => {
          const active = selected.has(s.key)
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className={cn(
                'w-full text-left rounded-xl border px-4 py-3 transition-all',
                active
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-amber-300',
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                    active ? 'border-amber-600 bg-amber-600' : 'border-gray-300',
                  )}
                >
                  {active && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {lang === 'ta' ? s.label_ta : s.label_en}
                  </p>
                  {lang === 'ta' && (
                    <p className="text-xs text-gray-400 mt-0.5">{s.label_en}</p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 text-center">{t.none_selected}</p>
      )}

      {/* Count chip */}
      {selected.size > 0 && (
        <p className="text-xs text-center text-amber-700 font-semibold">
          {selected.size} {t.selected}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
        style={{ background: '#92400E' }}
      >
        {loading ? t.confirming : t.confirm}
      </button>
    </div>
  )
}
