import { useState, useCallback } from 'react'
import { supabase, type ListItem, type StoreItem } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'

export function useSmartOrder(storeId: string) {
  const { householdId } = useHouseholdStore()
  const [commonItems, setCommonItems] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCommonItems = useCallback(async (excludeItemIds: string[] = []) => {
    if (!householdId || !storeId) return

    setLoading(true)

    // Get top items by purchase count for this store
    const { data, error } = await supabase
      .from('store_items')
      .select(`
        *,
        item:items(
          *,
          category:categories(*)
        )
      `)
      .eq('store_id', storeId)
      .order('purchase_count', { ascending: false })
      .limit(20)

    setLoading(false)

    if (error || !data) return

    // Filter out items already on list
    const filtered = data.filter(
      si => !excludeItemIds.includes(si.item_id)
    ) as StoreItem[]

    setCommonItems(filtered.slice(0, 8))
  }, [householdId, storeId])

  const sortByShoppingPath = useCallback(async (items: ListItem[]): Promise<ListItem[]> => {
    if (!storeId || items.length === 0) return items

    const itemIds = items.map(i => i.item_id)

    const { data } = await supabase
      .from('shopping_order')
      .select()
      .eq('store_id', storeId)
      .in('item_id', itemIds)

    if (!data || data.length === 0) return items

    const orderMap: Record<string, number> = {}
    for (const so of data) {
      orderMap[so.item_id] = so.average_position
    }

    // Sort: items with known position first, then alphabetically
    return [...items].sort((a, b) => {
      const posA = orderMap[a.item_id]
      const posB = orderMap[b.item_id]

      if (posA !== undefined && posB !== undefined) return posA - posB
      if (posA !== undefined) return -1
      if (posB !== undefined) return 1

      // Fall back to category order
      const catA = a.item?.category?.name || 'zzz'
      const catB = b.item?.category?.name || 'zzz'
      return catA.localeCompare(catB)
    })
  }, [storeId])

  const getAllItemsForStore = useCallback(async () => {
    if (!householdId || !storeId) return []

    const { data } = await supabase
      .from('items')
      .select(`*, category:categories(*)`)
      .eq('household_id', householdId)
      .order('name')

    return data || []
  }, [householdId, storeId])

  return { commonItems, loading, fetchCommonItems, sortByShoppingPath, getAllItemsForStore }
}
