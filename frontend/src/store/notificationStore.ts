import { create } from 'zustand'
import { notificationsApi, type NotificationItem } from '@/api/notifications'

interface NotificationStore {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  fetch: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const res = await notificationsApi.list()
      set({ notifications: res.notifications, unreadCount: res.unread_count, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  markRead: async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.notification_id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } catch { /* ignore */ }
  },

  markAllRead: async () => {
    try {
      await notificationsApi.markAllRead()
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }))
    } catch { /* ignore */ }
  },

  remove: async (id: string) => {
    const n = get().notifications.find((x) => x.notification_id === id)
    try {
      await notificationsApi.remove(id)
      set((s) => ({
        notifications: s.notifications.filter((x) => x.notification_id !== id),
        unreadCount: n && !n.is_read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      }))
    } catch { /* ignore */ }
  },
}))
