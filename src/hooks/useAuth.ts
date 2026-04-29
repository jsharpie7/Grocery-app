import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, session, loading } = useAuthStore()

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, session, loading, signOut }
}
