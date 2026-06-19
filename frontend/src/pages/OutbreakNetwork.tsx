import { useNavigate } from 'react-router-dom'
import { useSchemeStore } from '@/store/schemeStore'

export default function OutbreakNetwork() {
  const navigate = useNavigate()
  const { lang } = useSchemeStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const mockAlerts = [
    { district: t('கோயம்புத்தூர்', 'Coimbatore'), issue: t('அசடு மிட்டை', 'Aphid outbreak'), crop: t('வேர்க்கடலை', 'Groundnut'), severity: 'high', date: '2 நாட்கள் முன்பு' },
    { district: t('திருச்சி', 'Trichy'), issue: t('பூஞ்சை நோய்', 'Fungal disease'), crop: t('நெல்', 'Paddy'), severity: 'medium', date: '4 நாட்கள் முன்பு' },
    { district: t('மதுரை', 'Madurai'), issue: t('வாட்டு நோய்', 'Wilt disease'), crop: t('வாழை', 'Banana'), severity: 'low', date: '1 வாரம் முன்பு' },
  ]

  const severityColor = (s: string) =>
    s === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
    s === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200' :
    'bg-yellow-100 text-yellow-700 border-yellow-200'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="font-semibold text-gray-900 text-base">{t('நோய் வலைப்பின்னல் 🔴', 'Outbreak Network 🔴')}</h1>
      </header>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Coming soon banner */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800 text-sm font-semibold">{t('🚧 விரைவில் வருகிறது', '🚧 Coming Soon')}</p>
          <p className="text-red-700 text-xs mt-1">
            {t('அருகில் நடக்கும் பயிர் நோய் வெடிப்புகளை கண்காணிக்கவும், அரசு எச்சரிக்கைகளை பெறவும்.',
              'Track nearby crop disease outbreaks and receive government pest alerts.')}
          </p>
        </div>

        {/* Sample alerts (demo) */}
        <div>
          <p className="text-xs text-gray-500 font-semibold mb-2.5 px-1">{t('சமீபத்திய எச்சரிக்கைகள் (மாதிரி)', 'Recent Alerts (Demo)')}</p>
          <div className="space-y-2.5">
            {mockAlerts.map(({ district, issue, crop, severity, date }) => (
              <div key={district + issue} className={`card p-4 border ${severityColor(severity)}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{issue}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{crop} • {district}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityColor(severity)}`}>
                    {severity === 'high' ? t('அதிக', 'HIGH') : severity === 'medium' ? t('நடுத்தர', 'MED') : t('குறைந்த', 'LOW')}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{date}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🗺️', ta: 'நோய் வரைபடம்', en: 'Disease Map' },
            { icon: '🔔', ta: 'எச்சரிக்கை அமைப்பு', en: 'Alert Setup' },
            { icon: '📸', ta: 'நோய் அறிக்கை', en: 'Report Disease' },
            { icon: '👨‍🌾', ta: 'நிபுணர் ஆலோசனை', en: 'Expert Advice' },
          ].map(({ icon, ta, en }) => (
            <div key={ta} className="card p-4 flex flex-col items-center gap-2 text-center opacity-60">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-medium text-gray-700">{t(ta, en)}</span>
              <span className="text-[10px] text-gray-400">{t('விரைவில்', 'Soon')}</span>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/navigator')} className="w-full btn-secondary text-sm py-2.5">
          {t('அரசு திட்டங்கள் பார்க்க', 'View Government Schemes')}
        </button>
      </div>
    </div>
  )
}
