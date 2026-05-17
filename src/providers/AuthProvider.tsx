import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useHouseholdStore } from '../store/householdStore'
import type { Session } from '@supabase/supabase-js'

async function loadHouseholdFromSession(session: Session | null, setHousehold: (id: string, name: string) => void, setStores: (stores: import('../lib/supabase').Store[]) => void) {
  if (!session?.user) return
  try {
    const { data: member } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)
      .single()
    if (!member) return

    const [{ data: hh }, { data: stores }] = await Promise.all([
      supabase.from('households').select().eq('id', member.household_id).single(),
      supabase.from('stores').select().eq('household_id', member.household_id).order('created_at'),
    ])
    if (hh) {
      setHousehold(hh.id, hh.name)
      setStores(stores ?? [])
    }
  } catch {
    // No household yet — that's fine
  }
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setLoading } = useAuthStore()
  const { setHousehold, setStores, clearHousehold } = useHouseholdStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadHouseholdFromSession(data.session, setHousehold, setStores).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        clearHousehold()
      } else if (event === 'SIGNED_IN') {
        loadHouseholdFromSession(session, setHousehold, setStores)
      }
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading, setHousehold, setStores, clearHousehold])

  return <>{children}</>
}
