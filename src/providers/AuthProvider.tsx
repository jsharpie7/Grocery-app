import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useHouseholdStore } from '../store/householdStore'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setLoading } = useAuthStore()
  const clearHousehold = useHouseholdStore((s) => s.clearHousehold)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        clearHousehold()
      }
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading, clearHousehold])

  return <>{children}</>
}
