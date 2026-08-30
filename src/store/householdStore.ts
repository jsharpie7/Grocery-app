import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store } from '../lib/supabase'
import { DEFAULT_GEMINI_MODEL } from '../lib/gemini'

export const DEFAULT_CATEGORIES = [
  'Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry',
  'Beverages', 'Snacks', 'Household', 'Personal Care', 'Baby', 'Pet', 'Other',
]

interface HouseholdState {
  householdId: string | null
  householdName: string
  stores: Store[]
  geminiKey: string
  geminiModel: string
  categories: string[]
  setHousehold: (id: string, name: string) => void
  setStores: (stores: Store[]) => void
  setGeminiKey: (key: string) => void
  setGeminiModel: (model: string) => void
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
      geminiModel: DEFAULT_GEMINI_MODEL,
      categories: DEFAULT_CATEGORIES,
      setHousehold: (id, name) => set({ householdId: id, householdName: name }),
      setStores: (stores) => set({ stores }),
      setGeminiKey: (key) => set({ geminiKey: key }),
      setGeminiModel: (model) => set({ geminiModel: model }),
      setCategories: (categories) => set({ categories }),
      clearHousehold: () => set({ householdId: null, householdName: '', stores: [] }),
    }),
    {
      name: 'grocery-spend-settings',
      partialize: (state) => ({ geminiKey: state.geminiKey, geminiModel: state.geminiModel, categories: state.categories }),
    }
  )
)
