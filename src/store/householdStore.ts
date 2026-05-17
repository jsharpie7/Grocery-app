import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store } from '../lib/supabase'

export const DEFAULT_CATEGORIES = [
  'Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry',
  'Beverages', 'Snacks', 'Household', 'Personal Care', 'Baby', 'Pet', 'Other',
]

interface HouseholdState {
  householdId: string | null
  householdName: string
  stores: Store[]
  geminiKey: string
  categories: string[]
  setHousehold: (id: string, name: string) => void
  setStores: (stores: Store[]) => void
  setGeminiKey: (key: string) => void
  setCategories: (categories: string[]) => void
  clearHousehold: () => void
}

export const useHouseholdStore = create<HouseholdState>()(
  persist(
    (set) => ({
      householdId: null,
      householdName: '',
      stores: [],
      geminiKey: '',
      categories: DEFAULT_CATEGORIES,
      setHousehold: (id, name) => set({ householdId: id, householdName: name }),
      setStores: (stores) => set({ stores }),
      setGeminiKey: (key) => set({ geminiKey: key }),
      setCategories: (categories) => set({ categories }),
      clearHousehold: () => set({ householdId: null, householdName: '', stores: [] }),
    }),
    {
      name: 'grocery-spend-settings',
      partialize: (state) => ({ geminiKey: state.geminiKey, categories: state.categories }),
    }
  )
)
