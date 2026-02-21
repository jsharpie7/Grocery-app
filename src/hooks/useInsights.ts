import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'

export type MonthlySpend = {
  month: string
  total: number
}

export type ItemSpend = {
  item_id: string
  item_name: string
  total: number
}

export type CategorySpend = {
  category: string
  icon: string
  total: number
}

export type StoreSpend = {
  store_id: string
  store_name: string
  monthly: MonthlySpend[]
}

export type TripTime = {
  store_id: string
  store_name: string
  total_minutes: number
  trip_count: number
  avg_minutes: number
}

export type InsightsData = {
  monthlySpend: MonthlySpend[]
  topItems: ItemSpend[]
  categorySpend: CategorySpend[]
  storeSpend: StoreSpend[]
  tripTimes: TripTime[]
}

export function useInsights() {
  const { householdId } = useHouseholdStore()
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchInsights = useCallback(async () => {
    if (!householdId) return

    setLoading(true)

    // Fetch completed trips in last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data: trips } = await supabase
      .from('trips')
      .select(`
        *,
        store:stores(name),
        trip_items(
          *,
          item:items(
            name,
            category:categories(name, icon)
          )
        )
      `)
      .eq('household_id', householdId)
      .not('ended_at', 'is', null)
      .gte('started_at', twelveMonthsAgo.toISOString())
      .order('started_at', { ascending: true })

    if (!trips) {
      setLoading(false)
      return
    }

    // Process monthly spend
    const monthlyMap: Record<string, number> = {}
    const itemSpendMap: Record<string, { name: string; total: number }> = {}
    const categoryMap: Record<string, { icon: string; total: number }> = {}
    const storeMonthlyMap: Record<string, Record<string, number>> = {}
    const storeNameMap: Record<string, string> = {}
    const tripTimeMap: Record<string, { name: string; totalMs: number; count: number }> = {}

    for (const trip of trips) {
      const monthKey = new Date(trip.started_at).toISOString().slice(0, 7) // YYYY-MM
      const storeId = trip.store_id
      const storeName = (trip.store as { name: string })?.name || 'Unknown'

      storeNameMap[storeId] = storeName

      // Monthly spend
      if (trip.total_spent) {
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + trip.total_spent
      }

      // Store monthly
      if (!storeMonthlyMap[storeId]) storeMonthlyMap[storeId] = {}
      if (trip.total_spent) {
        storeMonthlyMap[storeId][monthKey] = (storeMonthlyMap[storeId][monthKey] || 0) + trip.total_spent
      }

      // Trip times
      if (trip.ended_at) {
        const duration = new Date(trip.ended_at).getTime() - new Date(trip.started_at).getTime()
        if (!tripTimeMap[storeId]) {
          tripTimeMap[storeId] = { name: storeName, totalMs: 0, count: 0 }
        }
        tripTimeMap[storeId].totalMs += duration
        tripTimeMap[storeId].count += 1
      }

      // Item and category spend
      for (const ti of (trip.trip_items || [])) {
        if (!ti.price_paid) continue

        const itemName = (ti.item as { name: string })?.name || 'Unknown'
        const cat = (ti.item as { category: { name: string; icon: string } | null })?.category
        const catName = cat?.name || 'Other'
        const catIcon = cat?.icon || '🛒'

        itemSpendMap[ti.item_id] = {
          name: itemName,
          total: (itemSpendMap[ti.item_id]?.total || 0) + ti.price_paid,
        }

        categoryMap[catName] = {
          icon: catIcon,
          total: (categoryMap[catName]?.total || 0) + ti.price_paid,
        }
      }
    }

    const monthlySpend: MonthlySpend[] = Object.entries(monthlyMap)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const topItems: ItemSpend[] = Object.entries(itemSpendMap)
      .map(([item_id, { name, total }]) => ({ item_id, item_name: name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const categorySpend: CategorySpend[] = Object.entries(categoryMap)
      .map(([category, { icon, total }]) => ({ category, icon, total }))
      .sort((a, b) => b.total - a.total)

    const storeSpend: StoreSpend[] = Object.entries(storeMonthlyMap).map(([store_id, monthly]) => ({
      store_id,
      store_name: storeNameMap[store_id] || 'Unknown',
      monthly: Object.entries(monthly)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    }))

    const tripTimes: TripTime[] = Object.entries(tripTimeMap).map(([store_id, { name, totalMs, count }]) => ({
      store_id,
      store_name: name,
      total_minutes: Math.round(totalMs / 60000),
      trip_count: count,
      avg_minutes: Math.round(totalMs / 60000 / count),
    }))

    setData({ monthlySpend, topItems, categorySpend, storeSpend, tripTimes })
    setLoading(false)
  }, [householdId])

  return { data, loading, fetchInsights }
}
