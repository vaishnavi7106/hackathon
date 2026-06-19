interface EmptyStateProps {
  icon?: string
  titleTa: string
  descTa?: string
  action?: React.ReactNode
}

export function EmptyState({ icon = '📭', titleTa, descTa, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4" role="img">{icon}</div>
      <p className="text-gray-800 font-semibold text-base">{titleTa}</p>
      {descTa && <p className="text-gray-500 text-sm mt-1 max-w-xs">{descTa}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
