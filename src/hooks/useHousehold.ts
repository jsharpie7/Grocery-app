import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'
import { generateJoinCode } from '../lib/storage'

export function useHousehold() {
  const { householdId, householdName, joinCode, setHousehold, setCategories } = useHouseholdStore()

  const createHousehold = useCallback(async (name = 'My Household') => {
    const code = generateJoinCode()

    const { data, error } = await supabase
      .from('households')
      .insert({ name, join_code: code })
      .select()
      .single()

    if (error) {
      console.error('Error creating household:', error)
      return null
    }

    setHousehold(data.id, data.name, data.join_code)

    // Load default categories
    await loadCategories(data.id)

    return data
  }, [setHousehold])

  const joinHousehold = useCallback(async (code: string) => {
    const { data, error } = await supabase
      .from('households')
      .select()
      .eq('join_code', code.toUpperCase())
      .single()

    if (error || !data) {
      return { success: false, error: 'Invalid join code' }
    }

    setHousehold(data.id, data.name, data.join_code)
    await loadCategories(data.id)

    return { success: true, household: data }
  }, [setHousehold])

  const loadCategories = useCallback(async (hid: string) => {
    const { data } = await supabase
      .from('categories')
      .select()
      .or(`household_id.eq.${hid},is_default.eq.true`)
      .order('name')

    if (data) {
      setCategories(data)
    }
  }, [setCategories])

  useEffect(() => {
    if (householdId) {
      loadCategories(householdId)
    }
  }, [householdId, loadCategories])

  return {
    householdId,
    householdName,
    joinCode,
    isSetup: !!householdId,
    createHousehold,
    joinHousehold,
  }
}
