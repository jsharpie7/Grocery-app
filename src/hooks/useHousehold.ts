import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useHouseholdStore } from '../store/householdStore'

export function useHousehold() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const { householdId, setHousehold, setStores } = useHouseholdStore()

  async function createHousehold(name: string) {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const hhId = crypto.randomUUID()
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { error: hhErr } = await supabase
        .from('households')
        .insert({ id: hhId, name, invite_code: inviteCode })
      if (hhErr) throw hhErr

      const { error: memberErr } = await supabase
        .from('household_members')
        .insert({ household_id: hhId, user_id: user.id, role: 'admin', email: user.email ?? '' })
      if (memberErr) throw memberErr

      setHousehold(hhId, name)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function joinHousehold(inviteCode: string) {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .select()
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()
      if (hhErr || !hh) throw new Error('Household not found. Check the invite code.')

      const { error: memberErr } = await supabase
        .from('household_members')
        .insert({ household_id: hh.id, user_id: user.id, role: 'member', email: user.email ?? '' })
      if (memberErr) {
        if (memberErr.message.includes('already has 2 members')) {
          throw new Error('This household is full (max 2 members).')
        }
        throw memberErr
      }

      const { data: stores } = await supabase
        .from('stores')
        .select()
        .eq('household_id', hh.id)
        .order('created_at')

      setHousehold(hh.id, hh.name)
      setStores(stores ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadHousehold() {
    if (!user) return
    try {
      const { data: member } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (!member) return

      const { data: hh } = await supabase
        .from('households')
        .select()
        .eq('id', member.household_id)
        .single()

      if (!hh) return

      const { data: stores } = await supabase
        .from('stores')
        .select()
        .eq('household_id', hh.id)
        .order('created_at')

      setHousehold(hh.id, hh.name)
      setStores(stores ?? [])
    } catch {
      // No household yet — that's ok
    }
  }

  return { householdId, error, loading, createHousehold, joinHousehold, loadHousehold }
}
