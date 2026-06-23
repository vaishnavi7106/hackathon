import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { useFarmerStore } from '@/store/farmerStore'

const POLL_INTERVAL = 60_000

export function NotificationBell() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const { unreadCount, fetch } = useNotificationStore()

  useEffect(() => {
    if (!isLoggedIn()) return
    fetch()
    const id = setInterval(fetch, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [isLoggedIn, fetch])

  if (!isLoggedIn()) return null

  const label = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <button
      onClick={() => navigate('/notifications')}
      aria-label={`அறிவிப்புகள் ${unreadCount > 0 ? `(${label} புதியவை)` : ''}`}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
    >
      <Bell size={22} color="white" />
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          minWidth: 18, height: 18, borderRadius: 9,
          backgroundColor: '#DC2626', color: 'white',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px', lineHeight: 1,
        }}>
          {label}
        </span>
      )}
    </button>
  )
}
