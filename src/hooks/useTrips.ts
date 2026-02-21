import { useState, useCallback } from 'react'
import { supabase, type Trip, type ListItem } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'

export function useTrips() {
  const { householdId } = useHouseholdStore()
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTrips = useCallback(async (limit = 20) => {
    if (!householdId) return

    setLoading(true)
    const { data, error } = await supabase
      .from('trips')
      .select()
      .eq('household_id', householdId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit)

    setLoading(false)

    if (!error && data) {
      setTrips(data)
    }
  }, [householdId])

  const startTrip = useCallback(async (storeId: string) => {
    if (!householdId) return null

    const { data, error } = await supabase
      .from('trips')
      .insert({
        household_id: householdId,
        store_id: storeId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error starting trip:', error)
      return null
    }

    setCurrentTrip(data)
    return data as Trip
  }, [householdId])

  const endTrip = useCallback(async (
    tripId: string,
    checkedItems: ListItem[],
    totalSpent?: number,
    receiptPhotoUrl?: string
  ) => {
    const endedAt = new Date().toISOString()

    // Update trip
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .update({
        ended_at: endedAt,
        total_spent: totalSpent || null,
        receipt_photo_url: receiptPhotoUrl || null,
      })
      .eq('id', tripId)
      .select()
      .single()

    if (tripError) {
      console.error('Error ending trip:', tripError)
      return null
    }

    // Insert trip items
    if (checkedItems.length > 0) {
      const tripItems = checkedItems.map((item, index) => ({
        trip_id: tripId,
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.unit,
        check_order: index, // for shopping path learning
      }))

      await supabase.from('trip_items').insert(tripItems)

      // Update purchase counts and shopping order
      await updatePurchaseStats(checkedItems, index => index)
    }

    setCurrentTrip(null)
    return tripData as Trip
  }, [])

  const updatePurchaseStats = async (
    checkedItems: ListItem[],
    getOrder: (index: number) => number
  ) => {
    for (let i = 0; i < checkedItems.length; i++) {
      const item = checkedItems[i]
      const position = getOrder(i)

      // Update store_items purchase count via manual upsert
      const { data: existingSi } = await supabase
        .from('store_items')
        .select('purchase_count')
        .eq('store_id', item.store_id)
        .eq('item_id', item.item_id)
        .single()

      await supabase
        .from('store_items')
        .upsert({
          store_id: item.store_id,
          item_id: item.item_id,
          purchase_count: (existingSi?.purchase_count || 0) + 1,
          last_purchased_at: new Date().toISOString(),
        }, { onConflict: 'store_id,item_id' })

      // Update shopping order
      const { data: existing } = await supabase
        .from('shopping_order')
        .select()
        .eq('store_id', item.store_id)
        .eq('item_id', item.item_id)
        .single()

      if (existing) {
        const newCount = existing.sample_count + 1
        const newAvg = (existing.average_position * existing.sample_count + position) / newCount

        await supabase
          .from('shopping_order')
          .update({ average_position: newAvg, sample_count: newCount })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('shopping_order')
          .upsert({
            store_id: item.store_id,
            item_id: item.item_id,
            average_position: position,
            sample_count: 1,
          }, { onConflict: 'store_id,item_id' })
      }
    }
  }

  return {
    currentTrip,
    trips,
    loading,
    fetchTrips,
    startTrip,
    endTrip,
    setCurrentTrip,
  }
}
