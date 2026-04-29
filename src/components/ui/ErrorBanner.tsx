import { useState, useEffect } from 'react'

interface ErrorBannerProps {
  message: string | null
  onDismiss?: () => void
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!!message)
  }, [message])

  if (!visible || !message) return null

  function dismiss() {
    setVisible(false)
    onDismiss?.()
  }

  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <span className="flex-1">{message}</span>
      <button onClick={dismiss} className="shrink-0 font-medium text-red-500 hover:text-red-700">
        Dismiss
      </button>
    </div>
  )
}
