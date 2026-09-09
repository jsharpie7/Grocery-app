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
    <div className="mb-3.5 flex items-start gap-3 rounded-card border border-danger/25 bg-danger/5 px-4 py-3 text-meta leading-normal text-danger">
      <span className="flex-1">{message}</span>
      <button onClick={dismiss} className="shrink-0 font-semibold">
        Dismiss
      </button>
    </div>
  )
}
