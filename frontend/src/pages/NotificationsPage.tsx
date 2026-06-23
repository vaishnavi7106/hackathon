import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, TrendingUp, Sprout, Landmark, AlertTriangle } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { useProfileStore } from '@/store/profileStore'
import type { NotificationItem } from '@/api/notifications'

const TYPE_CONFIG = {
  market:  { Icon: TrendingUp, bg: '#E8F5F1', color: '#0A5C47',  label: 'சந்தை' },
  soil:    { Icon: Sprout,     bg: '#FEF3C7', color: '#D97706',  label: 'மண்' },
  scheme:  { Icon: Landmark,   bg: '#DBEAFE', color: '#1D4ED8',  label: 'திட்டம்' },
  disease: { Icon: AlertTriangle, bg: '#FEE2E2', color: '#991B1B', label: 'நோய்' },
} as const

function timeAgo(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (mins < 60) return lang === 'ta' ? `${mins} நிமிடம் முன்` : `${mins}m ago`
  if (hours < 24) return lang === 'ta' ? `${hours} மணி முன்` : `${hours}h ago`
  const d = new Date(iso)
  const months = ['ஜன','பிப்','மார்','ஏப்','மே','ஜூன்','ஜூலை','ஆக','செப்','அக்','நவ','டிச']
  return lang === 'ta'
    ? `${months[d.getMonth()]} ${d.getDate()}`
    : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function groupByDay(notifications: NotificationItem[]) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const groups: { label: string; items: NotificationItem[] }[] = []
  const map: Record<string, NotificationItem[]> = {}

  for (const n of notifications) {
    const d = new Date(n.created_at).toDateString()
    const key = d === today ? 'today' : d === yesterday ? 'yesterday' : 'earlier'
    if (!map[key]) map[key] = []
    map[key].push(n)
  }

  if (map.today)     groups.push({ label: 'இன்று', items: map.today })
  if (map.yesterday) groups.push({ label: 'நேற்று', items: map.yesterday })
  if (map.earlier)   groups.push({ label: 'முன்பு', items: map.earlier })
  return groups
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications, unreadCount, fetch, markRead, markAllRead, remove } = useNotificationStore()
  const { profile } = useProfileStore()
  const lang = profile.language as 'ta' | 'en'

  useEffect(() => { fetch() }, [fetch])

  async function handleTap(n: NotificationItem) {
    if (!n.is_read) await markRead(n.notification_id)
    if (n.action_route) navigate(n.action_route)
  }

  const groups = groupByDay(notifications)

  return (
    <div style={{ backgroundColor: '#F9FAFB', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)' }}>
        <button onClick={() => navigate(-1)} style={{ color: 'rgba(255,255,255,0.8)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 font-semibold text-base text-white">
          {lang === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{ color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            {lang === 'ta' ? 'அனைத்தும் படித்தது' : 'Mark all read'}
          </button>
        )}
      </header>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-24 pb-8 px-8 gap-4">
          <div style={{ width: 72, height: 72, borderRadius: 36, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={32} color="#9CA3AF" />
          </div>
          <p className="text-base font-semibold text-center" style={{ color: '#374151' }}>
            {lang === 'ta' ? 'அறிவிப்புகள் இல்லை' : 'No notifications yet'}
          </p>
          <p className="text-sm text-center" style={{ color: '#6B7280' }}>
            {lang === 'ta'
              ? 'இலை ஸ்கேன், மண் பணி, திட்ட காலாவதி ஆகியவற்றுக்கான அறிவிப்புகள் இங்கே தோன்றும்'
              : 'Leaf scans, soil tasks, and scheme deadlines will appear here'}
          </p>
        </div>
      )}

      {/* Notification groups */}
      <div className="pb-8">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-4 pt-4 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                {group.label}
              </span>
            </div>
            {group.items.map((n) => {
              const cfg = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.disease
              const { Icon } = cfg
              const title = lang === 'ta' ? n.title_ta : n.title_en
              const body  = lang === 'ta' ? n.body_ta  : n.body_en

              return (
                <div
                  key={n.notification_id}
                  onClick={() => handleTap(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',
                    backgroundColor: n.is_read ? '#F9FAFB' : 'white',
                    borderLeft: n.is_read ? '3px solid transparent' : '3px solid #0A5C47',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  {/* Icon circle */}
                  <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={cfg.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#111827', margin: 0, lineHeight: 1.4 }}>
                      {title}
                    </p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0', lineHeight: 1.4 }}>
                      {body}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{timeAgo(n.created_at, lang)}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg, padding: '1px 6px', borderRadius: 4 }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(n.notification_id) }}
                    style={{ color: '#D1D5DB', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, fontSize: 16, lineHeight: 1 }}
                    aria-label="Delete"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
