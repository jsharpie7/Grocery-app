import { useEffect } from 'react'

interface ToastProps {
  message: string
  /** Right-aligned trailing figure, e.g. the saved receipt's total. */
  detail?: string
  onDismiss: () => void
}

/** Auto-dismisses after 2.6s, the interval the design specifies. */
const DISMISS_MS = 2600

export default function Toast({ message, detail, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role="status"
      className="fixed inset-x-6 z-50 flex items-center justify-between rounded-card-sm bg-[rgba(20,22,21,0.92)] px-4.5 py-3.5 text-[15px] font-medium leading-tight text-white"
      style={{ bottom: 'calc(var(--tab-bar-h) + 47px)' }}
    >
      <span>{message}</span>
      {detail && <span className="text-[14px] font-normal text-accent-tint">{detail}</span>}
    </div>
  )
}
