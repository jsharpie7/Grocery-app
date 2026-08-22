import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'
import type { Store } from '../lib/supabase'

/**
 * Find an existing store whose name collides with `name`, case- and
 * whitespace-insensitively. Mirrors the database's
 * UNIQUE(household_id, lower(trim(name))) index so the UI can explain the
 * collision instead of surfacing a raw constraint violation.
 *
 * `excludeId` omits the store being edited. Without it, saving a store with
 * only its colour changed would collide with itself and be rejected.
 */
export function findDuplicateStore(
  name: string,
  stores: Store[],
  excludeId?: string,
): Store | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  return (
    stores.find((s) => s.id !== excludeId && s.name.trim().toLowerCase() === normalized) ?? null
  )
}

/**
 * The local store list can be stale (a household partner may have added a store
 * since it was fetched), so the database's unique index is the real guard. Turn
 * its constraint violation into the same sentence the client-side check uses.
 */
function friendlyStoreError(message: string, attemptedName: string): string {
  const isDuplicate =
    message.includes('stores_household_name_ci_idx') ||
    message.includes('stores_household_id_name_key') ||
    message.includes('duplicate key value')
  return isDuplicate
    ? `A store named "${attemptedName.trim()}" already exists.`
    : message
}

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

    const clash = findDuplicateStore(name, stores)
    if (clash) { setError(`A store named "${clash.name}" already exists.`); return null }

    const { data, error: err } = await supabase
      .from('stores')
      .insert({ household_id: householdId, name: name.trim(), color })
      .select()
      .single()
    if (err) { setError(friendlyStoreError(err.message, name)); return null }
    setStores([...stores, data])
    return data
  }

  async function updateStore(
    id: string,
    updates: { name?: string; color?: string },
  ): Promise<boolean> {
    setError(null)

    if (updates.name !== undefined) {
      const clash = findDuplicateStore(updates.name, stores, id)
      if (clash) { setError(`A store named "${clash.name}" already exists.`); return false }
    }

    const payload = updates.name !== undefined
      ? { ...updates, name: updates.name.trim() }
      : updates

    const { data, error: err } = await supabase
      .from('stores')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) { setError(friendlyStoreError(err.message, updates.name ?? '')); return false }
    setStores(stores.map((s) => (s.id === id ? data : s)))
    return true
  }

  async function deleteStore(id: string) {
    setError(null)
    const { error: err } = await supabase.from('stores').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setStores(stores.filter((s) => s.id !== id))
  }

  return { stores, error, loading, fetchStores, createStore, updateStore, deleteStore }
}
