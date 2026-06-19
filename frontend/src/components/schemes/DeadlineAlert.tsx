import type { DeadlineAlert } from '@/types/api'
import { formatDate } from '@/lib/utils'

interface DeadlineAlertProps {
  alerts: DeadlineAlert[]
}

export function DeadlineAlerts({ alerts }: DeadlineAlertProps) {
  if (!alerts.length) return null

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => (
        <div
          key={alert.scheme_id}
          className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3"
          role="alert"
        >
          <span className="text-orange-500 text-lg shrink-0">⏰</span>
          <div className="flex-1 min-w-0">
            <p className="text-orange-800 text-sm font-medium truncate">{alert.scheme_name_ta}</p>
            <p className="text-orange-700 text-xs mt-0.5">
              கடைசி தேதி: {formatDate(alert.deadline)}
              {alert.days_remaining !== null && (
                <span className="ml-1 font-semibold">({alert.days_remaining} நாட்கள் மீதமுள்ளன)</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
