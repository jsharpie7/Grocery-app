import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store, Category } from '../lib/supabase'

interface HouseholdState {
  householdId: string | null
  householdName: string
  joinCode: string | null
  stores: Store[]
  categories: Category[]
  activeStoreId: string | null

  setHousehold: (id: string, name: string, joinCode: string) => void
  setStores: (stores: Store[]) => void
  setCategories: (categories: Category[]) => void
  setActiveStore: (storeId: string | null) => void
  clearHousehold: () => void
}

export const useHouseholdStore = create<HouseholdState>()(
  persist(
    (set) => ({
      householdId: null,
      householdName: 'My Household',
      joinCode: null,
      stores: [],
      categories: [],
      activeStoreId: null,

      setHousehold: (id, name, joinCode) =>
        set({ householdId: id, householdName: name, joinCode }),

      setStores: (stores) => set({ stores }),

      setCategories: (categories) => set({ categories }),

      setActiveStore: (storeId) => set({ activeStoreId: storeId }),

      clearHousehold: () =>
        set({
          householdId: null,
          householdName: 'My Household',
          joinCode: null,
          stores: [],
          categories: [],
          activeStoreId: null,
        }),
    }),
    {
      name: 'grocery-household',
      partialize: (state) => ({
        householdId: state.householdId,
        householdName: state.householdName,
        joinCode: state.joinCode,
      }),
    }
  )
)
