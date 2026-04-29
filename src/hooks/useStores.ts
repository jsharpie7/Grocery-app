import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'
import type { Store } from '../lib/supabase'

export function useStores() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { householdId, stores, setStores } = useHouseholdStore()

  async function fetchStores() {
    if (!householdId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('stores')
        .select()
        .eq('household_id', householdId)
        .order('created_at')
      if (err) { setError(err.message); return }
      setStores(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function createStore(name: string, color: string): Promise<Store | null> {
    if (!householdId) return null
    setError(null)
    const { data, error: err } = await supabase
      .from('stores')
      .insert({ household_id: householdId, name, color })
      .select()
      .single()
    if (err) { setError(err.message); return null }
    setStores([...stores, data])
    return data
  }

  async function updateStore(id: string, updates: { name?: string; color?: string }) {
    setError(null)
    const { data, error: err } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (err) { setError(err.message); return }
    setStores(stores.map((s) => (s.id === id ? data : s)))
  }

  async function deleteStore(id: string) {
    setError(null)
    const { error: err } = await supabase.from('stores').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setStores(stores.filter((s) => s.id !== id))
  }

  return { stores, error, loading, fetchStores, createStore, updateStore, deleteStore }
}
