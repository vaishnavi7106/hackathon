interface ErrorMessageProps {
  messageTa?: string
  message?: string
  onRetry?: () => void
}

export function ErrorMessage({ messageTa, message, onRetry }: ErrorMessageProps) {
  const text = messageTa || message || 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.'

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-4xl mb-3" role="img" aria-label="error">⚠️</div>
      <p className="text-gray-700 text-sm">{text}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-primary-600 text-sm font-medium underline underline-offset-2"
        >
          மீண்டும் முயற்சி
        </button>
      )}
    </div>
  )
}
