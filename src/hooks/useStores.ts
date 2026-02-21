import { useState, useEffect, useCallback } from 'react'
import { supabase, type Store } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'

export function useStores() {
  const { householdId, setStores, stores } = useHouseholdStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStores = useCallback(async () => {
    if (!householdId) return

    setLoading(true)
    const { data, error } = await supabase
      .from('stores')
      .select()
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('display_order')

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setStores(data || [])
  }, [householdId, setStores])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const addStore = useCallback(async (name: string, color: string, logoUrl?: string) => {
    if (!householdId) return null

    const maxOrder = stores.length > 0
      ? Math.max(...stores.map(s => s.display_order))
      : -1

    const { data, error } = await supabase
      .from('stores')
      .insert({
        household_id: householdId,
        name,
        color,
        logo_url: logoUrl || null,
        display_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding store:', error)
      return null
    }

    await fetchStores()
    return data as Store
  }, [householdId, stores, fetchStores])

  const updateStore = useCallback(async (id: string, updates: Partial<Store>) => {
    const { error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)

    if (!error) await fetchStores()
    return !error
  }, [fetchStores])

  const deleteStore = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('stores')
      .update({ is_active: false })
      .eq('id', id)

    if (!error) await fetchStores()
    return !error
  }, [fetchStores])

  const reorderStores = useCallback(async (reordered: Store[]) => {
    setStores(reordered)

    const updates = reordered.map((s, i) => ({
      id: s.id,
      display_order: i,
    }))

    for (const update of updates) {
      await supabase
        .from('stores')
        .update({ display_order: update.display_order })
        .eq('id', update.id)
    }
  }, [setStores])

  return { stores, loading, error, fetchStores, addStore, updateStore, deleteStore, reorderStores }
}
