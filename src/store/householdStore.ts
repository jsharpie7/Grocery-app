import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store } from '../lib/supabase'

interface HouseholdState {
  householdId: string | null
  householdName: string
  stores: Store[]
  geminiKey: string
  setHousehold: (id: string, name: string) => void
  setStores: (stores: Store[]) => void
  setGeminiKey: (key: string) => void
  clearHousehold: () => void
}

export const useHouseholdStore = create<HouseholdState>()(
  persist(
    (set) => ({
      householdId: null,
      householdName: '',
      stores: [],
      geminiKey: '',
      setHousehold: (id, name) => set({ householdId: id, householdName: name }),
      setStores: (stores) => set({ stores }),
      setGeminiKey: (key) => set({ geminiKey: key }),
      clearHousehold: () => set({ householdId: null, householdName: '', stores: [] }),
    }),
    {
      name: 'grocery-spend-settings',
      partialize: (state) => ({ geminiKey: state.geminiKey }),
    }
  )
)
