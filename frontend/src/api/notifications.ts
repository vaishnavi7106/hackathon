import { api } from './client'

export interface NotificationItem {
  notification_id: string
  farmer_id: string
  type: 'market' | 'soil' | 'scheme' | 'disease'
  title_en: string
  title_ta: string
  body_en: string
  body_ta: string
  icon_type: string
  is_read: boolean
  action_route: string | null
  action_params: Record<string, string> | null
  created_at: string
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  unread_count: number
}

export const notificationsApi = {
  list: (unreadOnly = false, limit = 50) =>
    api.get<NotificationListResponse>(`/notifications?unread_only=${unreadOnly}&limit=${limit}`),

  markRead: (id: string) =>
    api.post<void>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post<void>('/notifications/read-all'),

  remove: (id: string) =>
    api.delete<void>(`/notifications/${id}`),
}
