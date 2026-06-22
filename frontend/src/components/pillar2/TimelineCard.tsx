import type { PrescriptionResponse, SplitScheduleItem } from '@/types/soil'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
}

const LABELS = {
  ta: {
    title: 'உர பிரிவு அட்டவணை',
    subtitle: 'TNAU பரிந்துரை பிரிவுகள்',
    day: 'நாள்',
    bags: 'பை',
    done: 'முடிந்தது',
    upcoming: 'வரவிருக்கும்',
    urea: 'யூரியா',
    dap: 'டிஏபி',
    mop: 'எம்ஓபி',
    days_away: 'நாட்களில்',
  },
  en: {
    title: 'Fertilizer Split Schedule',
    subtitle: 'TNAU Recommended Splits',
    day: 'Day',
    bags: 'bags',
    done: 'Done',
    upcoming: 'Upcoming',
    urea: 'Urea',
    dap: 'DAP',
    mop: 'MOP',
    days_away: 'days away',
  },
}

function ProductPill({ name, bags, lang }: { name: string; bags: number; lang: 'ta' | 'en' }) {
  const t = LABELS[lang]
  if (bags <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
      {name}: {bags.toFixed(1)} {t.bags}
    </span>
  )
}

function ScheduleRow({ item, lang, isLast }: { item: SplitScheduleItem; lang: 'ta' | 'en'; isLast: boolean }) {
  const t = LABELS[lang]
  const past = item.is_past
  // Stage name from TNAU split schedule — already the fertilizer application stage
  const stageName = lang === 'ta' ? item.stage_ta : item.stage

  return (
    <div className={`flex gap-3 ${past ? 'opacity-50' : ''}`}>
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
            past ? 'bg-gray-200 text-gray-500' : 'text-white'
          }`}
          style={past ? undefined : { background: '#2D6A4F' }}
        >
          {past ? '✓' : '🌱'}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1 min-h-4" />}
      </div>

      {/* Content — stage name is now primary */}
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stage name — primary identifier */}
          <span className="text-sm font-semibold text-gray-800">{stageName}</span>
          {/* Day number — secondary context */}
          <span className="text-xs text-gray-400">
            {t.day} {item.day}
          </span>
          {past && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
              {t.done}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <ProductPill name={t.urea} bags={item.urea_bags} lang={lang} />
          <ProductPill name={t.dap} bags={item.dap_bags} lang={lang} />
          <ProductPill name={t.mop} bags={item.mop_bags} lang={lang} />
        </div>
      </div>
    </div>
  )
}

export function TimelineCard({ data, lang }: Props) {
  const t = LABELS[lang]
  const schedule = data.split_schedule

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      <div className="px-4 py-3" style={{ background: '#1B4332' }}>
        <p className="text-xs font-bold tracking-widest text-green-300 uppercase">
          {t.title}
        </p>
        <p className="text-xs text-green-400 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="bg-white p-4">
        {schedule.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {lang === 'ta' ? 'அட்டவணை இல்லை' : 'No schedule available'}
          </p>
        ) : (
          <div className="mt-1">
            {schedule.map((item, i) => (
              <ScheduleRow key={i} item={item} lang={lang} isLast={i === schedule.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
