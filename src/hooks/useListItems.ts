import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type ListItem } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'

export function useListItems(storeId?: string) {
  const { householdId } = useHouseholdStore()
  const [listItems, setListItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchListItems = useCallback(async () => {
    if (!householdId) return

    setLoading(true)
    let query = supabase
      .from('list_items')
      .select(`
        *,
        item:items(
          *,
          category:categories(*)
        )
      `)
      .eq('household_id', householdId)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query.order('added_at', { ascending: true })

    setLoading(false)

    if (!error && data) {
      setListItems(data as ListItem[])
    }
  }, [householdId, storeId])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!householdId) return

    fetchListItems()

    const channel = supabase
      .channel(`list-items-${householdId}${storeId ? `-${storeId}` : ''}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          fetchListItems()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [householdId, storeId, fetchListItems])

  const addItem = useCallback(async (
    storeId: string,
    itemId: string,
    quantity = 1,
    unit = 'ea'
  ) => {
    if (!householdId) return null

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const tempItem: ListItem = {
      id: tempId,
      household_id: householdId,
      store_id: storeId,
      item_id: itemId,
      quantity,
      unit,
      is_checked: false,
      added_at: new Date().toISOString(),
      added_by: null,
    }

    setListItems(prev => [...prev.filter(i => i.item_id !== itemId), tempItem])

    const { data, error } = await supabase
      .from('list_items')
      .upsert({
        household_id: householdId,
        store_id: storeId,
        item_id: itemId,
        quantity,
        unit,
        is_checked: false,
      }, {
        onConflict: 'household_id,store_id,item_id',
      })
      .select(`*, item:items(*, category:categories(*))`)
      .single()

    if (error) {
      // Revert optimistic update
      setListItems(prev => prev.filter(i => i.id !== tempId))
      console.error('Error adding item:', error)
      return null
    }

    setListItems(prev => prev.map(i => i.id === tempId ? data as ListItem : i))
    return data as ListItem
  }, [householdId])

  const removeItem = useCallback(async (listItemId: string) => {
    // Optimistic update
    setListItems(prev => prev.filter(i => i.id !== listItemId))

    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('id', listItemId)

    if (error) {
      console.error('Error removing item:', error)
      fetchListItems() // revert on error
    }
  }, [fetchListItems])

  const checkItem = useCallback(async (listItemId: string, checked: boolean) => {
    // Optimistic update
    setListItems(prev =>
      prev.map(i => i.id === listItemId ? { ...i, is_checked: checked } : i)
    )

    const { error } = await supabase
      .from('list_items')
      .update({ is_checked: checked })
      .eq('id', listItemId)

    if (error) {
      console.error('Error checking item:', error)
      fetchListItems()
    }
  }, [fetchListItems])

  const clearStore = useCallback(async (storeId: string) => {
    if (!householdId) return

    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('household_id', householdId)
      .eq('store_id', storeId)

    if (!error) {
      setListItems(prev => prev.filter(i => i.store_id !== storeId))
    }
  }, [householdId])

  // Get count per store
  const getStoreCount = useCallback((sId: string) => {
    return listItems.filter(i => i.store_id === sId).length
  }, [listItems])

  return {
    listItems,
    loading,
    fetchListItems,
    addItem,
    removeItem,
    checkItem,
    clearStore,
    getStoreCount,
  }
}
