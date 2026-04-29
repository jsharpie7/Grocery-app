import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOffline() { setOffline(true) }
    function handleOnline() { setOffline(false) }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="sticky top-0 z-50 bg-yellow-400 px-4 py-2 text-center text-sm font-medium text-yellow-900">
      You're offline. Changes may not save.
    </div>
  )
}
