import { useNavigate } from 'react-router-dom'
import { useSchemeStore } from '@/store/schemeStore'

export default function CropSentinel() {
  const navigate = useNavigate()
  const { lang } = useSchemeStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="font-semibold text-gray-900 text-base">{t('பயிர் காவலன் 🌿', 'Crop Sentinel 🌿')}</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pb-24">
        <div className="text-7xl mb-6">🌿</div>
        <h2 className="text-gray-900 font-bold text-xl mb-2">{t('பயிர் காவலன்', 'Crop Sentinel')}</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs leading-relaxed">
          {t(
            'AI மூலம் பயிர் நோய்கள் கண்டறிதல், சரியான உரம் பரிந்துரை மற்றும் பருவகால ஆலோசனை.',
            'AI-powered crop disease detection, fertilizer recommendations, and seasonal advisory.',
          )}
        </p>

        <div className="w-full space-y-3 mb-8">
          {[
            { icon: '🔍', ta: 'நோய் கண்டறிதல்', en: 'Disease Detection' },
            { icon: '💊', ta: 'உரம் பரிந்துரை', en: 'Fertilizer Advisory' },
            { icon: '📅', ta: 'பருவகால திட்டமிடல்', en: 'Seasonal Planning' },
            { icon: '🌡️', ta: 'வானிலை ஒருங்கிணைப்பு', en: 'Weather Integration' },
          ].map(({ icon, ta, en }) => (
            <div key={ta} className="card p-3.5 flex items-center gap-3 opacity-60">
              <span className="text-xl">{icon}</span>
              <span className="text-sm text-gray-700 font-medium">{t(ta, en)}</span>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{t('விரைவில்', 'Coming soon')}</span>
            </div>
          ))}
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 w-full">
          <p className="text-primary-800 text-xs font-semibold">{t('🚧 இந்த பகுதி கட்டமைக்கப்படுகிறது', '🚧 This section is under construction')}</p>
          <p className="text-primary-600 text-xs mt-1">
            {t('அரசு திட்ட வழிகாட்டி இப்போது கிடைக்கிறது.', 'Government Navigator is available now.')}
          </p>
          <button
            onClick={() => navigate('/navigator')}
            className="mt-3 btn-primary text-xs px-4 py-2"
          >
            {t('திட்டங்கள் பார்க்க', 'Go to Navigator')}
          </button>
        </div>
      </div>
    </div>
  )
}
