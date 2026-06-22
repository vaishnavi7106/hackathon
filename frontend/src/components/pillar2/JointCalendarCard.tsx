import type { CalendarEvent, PrescriptionResponse, SplitScheduleItem } from '@/types/soil'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
}

const LABELS = {
  ta: {
    title: 'ஒருங்கிணைந்த அட்டவணை',
    subtitle: 'உரம் + நீர்பாசனம் இணைந்த திட்டம்',
    fertilizer: 'உரம்',
    irrigation: 'நீர்பாசனம்',
    both: 'உரம் + நீர்',
    rain_advisory: 'மழை அறிவிப்பு',
    min: 'நிமிடம்',
    day_secondary: 'நாள்',
  },
  en: {
    title: 'Joint Calendar',
    subtitle: 'Fertilizer + Irrigation Combined Plan',
    fertilizer: 'Fertilizer',
    irrigation: 'Irrigation',
    both: 'Fertilizer + Irrigation',
    rain_advisory: 'Rain Advisory',
    min: 'min',
    day_secondary: 'Day',
  },
}

const TYPE_STYLE: Record<string, { bg: string; border: string; icon: string }> = {
  fertilizer:    { bg: '#F0FDF4', border: '#86EFAC', icon: '🌱' },
  irrigation:    { bg: '#EFF6FF', border: '#93C5FD', icon: '💧' },
  both:          { bg: '#FFF7ED', border: '#FDBA74', icon: '⚡' },
  rain_advisory: { bg: '#F0F9FF', border: '#7DD3FC', icon: '🌧' },
}

const URGENCY_RING: Record<string, string> = {
  high:   'ring-2 ring-orange-400',
  normal: '',
  low:    'opacity-70',
}

// Build a lookup: {day → SplitScheduleItem} from the split schedule
function buildSplitIndex(schedule: SplitScheduleItem[]): Map<number, SplitScheduleItem> {
  const m = new Map<number, SplitScheduleItem>()
  for (const item of schedule) m.set(item.day, item)
  return m
}

// Format a date string to a short friendly label
function formatEventDate(dateStr: string | null, lang: 'ta' | 'en'): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function EventRow({
  ev,
  t,
  lang,
  splitIndex,
}: {
  ev: CalendarEvent
  t: typeof LABELS['en']
  lang: 'ta' | 'en'
  splitIndex: Map<number, SplitScheduleItem>
}) {
  const style = TYPE_STYLE[ev.type] ?? TYPE_STYLE.fertilizer
  const typeLabel = (t as Record<string, string>)[ev.type] ?? ev.type
  const dateLabel = formatEventDate(ev.date, lang)

  // For fertilizer/both events: look up the TNAU application stage name
  const splitItem = (ev.type === 'fertilizer' || ev.type === 'both')
    ? splitIndex.get(ev.day)
    : null
  const stageName = splitItem
    ? (lang === 'ta' ? splitItem.stage_ta : splitItem.stage)
    : null

  // Primary headline: stage name for fertilizer events, date for irrigation
  const primaryLabel = stageName ?? dateLabel ?? `${t.day_secondary} ${ev.day}`
  // Secondary label: date for fertilizer, nothing else
  const secondaryLabel = stageName && dateLabel ? dateLabel : null

  return (
    <div
      className={`rounded-xl px-3 py-2.5 border ${URGENCY_RING[ev.urgency]}`}
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Primary: stage name or date */}
              <span className="text-xs font-bold text-gray-800 truncate">{primaryLabel}</span>
              {/* Secondary: date (for fertilizer events that have a stage name) */}
              {secondaryLabel && (
                <span className="text-xs text-gray-400 shrink-0">{secondaryLabel}</span>
              )}
            </div>
            <span className="text-xs text-gray-500 shrink-0">{typeLabel}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {ev.actions.map((a, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700"
              >
                {a}
              </span>
            ))}
            {ev.irrigation_duration_min != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {ev.irrigation_duration_min} {t.min}
              </span>
            )}
          </div>
          {ev.note && (
            <p className="text-xs text-gray-500 mt-1">{ev.note}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function JointCalendarCard({ data, lang }: Props) {
  const t = LABELS[lang]
  const events = data.joint_calendar
  const splitIndex = buildSplitIndex(data.split_schedule ?? [])

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      <div
        className="px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #0369A1 100%)' }}
      >
        <p className="text-xs font-bold tracking-widest text-green-200 uppercase">
          {t.title}
        </p>
        <p className="text-xs text-green-300 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="bg-white p-4 space-y-2">
        {events.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {lang === 'ta' ? 'நிகழ்வுகள் இல்லை' : 'No events'}
          </p>
        ) : (
          events.map((ev, i) => (
            <EventRow key={i} ev={ev} t={t} lang={lang} splitIndex={splitIndex} />
          ))
        )}
      </div>
    </div>
  )
}
