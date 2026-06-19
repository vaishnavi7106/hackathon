import { useNavigate } from 'react-router-dom'
import { useSchemeStore } from '@/store/schemeStore'

export default function MarketNavigator() {
  const navigate = useNavigate()
  const { lang } = useSchemeStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const mockPrices = [
    { crop: t('நெல்', 'Paddy'), price: '₹2,183', change: '+1.2%', up: true },
    { crop: t('வேர்க்கடலை', 'Groundnut'), price: '₹5,850', change: '-0.4%', up: false },
    { crop: t('மஞ்சள்', 'Turmeric'), price: '₹9,200', change: '+2.8%', up: true },
    { crop: t('தக்காளி', 'Tomato'), price: '₹1,400', change: '+5.1%', up: true },
    { crop: t('வெங்காயம்', 'Onion'), price: '₹2,100', change: '-1.5%', up: false },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="font-semibold text-gray-900 text-base">{t('சந்தை வழிகாட்டி 📊', 'Market Navigator 📊')}</h1>
      </header>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Coming soon banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-800 text-sm font-semibold">{t('🚧 விரைவில் வருகிறது', '🚧 Coming Soon')}</p>
          <p className="text-amber-700 text-xs mt-1">
            {t('நேரடி சந்தை விலைகள், e-NAM ஒருங்கிணைப்பு மற்றும் விலை சரிவு எச்சரிக்கைகள்.',
              'Live market prices, e-NAM integration, and price alert notifications.')}
          </p>
        </div>

        {/* Sample prices (demo) */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 font-semibold">{t('இன்றைய விலைகள் (மாதிரி)', 'Today\'s Prices (Demo)')}</p>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{t('தரவு இல்லை', 'Not live')}</span>
          </div>
          <div className="space-y-2.5">
            {mockPrices.map(({ crop, price, change, up }) => (
              <div key={crop} className="flex items-center justify-between">
                <span className="text-sm text-gray-800 font-medium">{crop}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{price}</span>
                  <span className={`ml-2 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>{change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📈', ta: 'விலை வரலாறு', en: 'Price History' },
            { icon: '🔔', ta: 'விலை எச்சரிக்கை', en: 'Price Alerts' },
            { icon: '🏪', ta: 'அருகில் உள்ள சந்தைகள்', en: 'Nearby Markets' },
            { icon: '🚚', ta: 'போக்குவரத்து ஏற்பாடு', en: 'Transport Booking' },
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
