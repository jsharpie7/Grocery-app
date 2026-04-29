import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'
import type { MonthlySpend, StoreMonthlySpend, Item, ItemPrice } from '../lib/supabase'

export interface TopItem {
  item: Item
  avgPrice: number
  count: number
  prices: ItemPrice[]
}

export interface CategoryBreakdown {
  category: string
  total: number
}

export function useInsights() {
  const [monthlyData, setMonthlyData] = useState<MonthlySpend[]>([])
  const [storeMonthlyData, setStoreMonthlyData] = useState<StoreMonthlySpend[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const householdId = useHouseholdStore((s) => s.householdId)

  async function fetchMonthlySpend(months = 12) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_monthly_spend', { p_months: months })
      if (err) { setError(err.message); return }
      setMonthlyData((data as MonthlySpend[]) ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchStoreMonthlySpend(months = 12) {
    setError(null)
    const { data, error: err } = await supabase.rpc('get_store_monthly_spend', { p_months: months })
    if (err) { setError(err.message); return }
    setStoreMonthlyData((data as StoreMonthlySpend[]) ?? [])
  }

  async function fetchTopItems(limit = 10) {
    if (!householdId) return
    setError(null)
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('items')
        .select()
        .eq('household_id', householdId)
        .limit(100)
      if (itemsErr) { setError(itemsErr.message); return }

      if (!items?.length) { setTopItems([]); return }

      const { data: prices, error: pricesErr } = await supabase
        .from('item_prices')
        .select()
        .in('item_id', items.map((i) => i.id))
        .order('purchased_at', { ascending: false })
      if (pricesErr) { setError(pricesErr.message); return }

      const pricesByItem = new Map<string, ItemPrice[]>()
      for (const p of prices ?? []) {
        const existing = pricesByItem.get(p.item_id) ?? []
        existing.push(p)
        pricesByItem.set(p.item_id, existing)
      }

      const result: TopItem[] = items
        .map((item) => {
          const itemPrices = pricesByItem.get(item.id) ?? []
          if (!itemPrices.length) return null
          const avg = itemPrices.reduce((s, p) => s + Number(p.unit_price), 0) / itemPrices.length
          return { item, avgPrice: avg, count: itemPrices.length, prices: itemPrices }
        })
        .filter((x): x is TopItem => x !== null)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)

      setTopItems(result)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function fetchCategoryBreakdown(months = 12) {
    if (!householdId) return
    setError(null)
    try {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)

      const { data: receipts, error: rErr } = await supabase
        .from('receipts')
        .select('id')
        .eq('household_id', householdId)
        .gte('receipt_date', cutoff.toISOString().split('T')[0])

      if (rErr) { setError(rErr.message); return }
      if (!receipts?.length) { setCategoryData([]); return }

      const { data: items, error: iErr } = await supabase
        .from('receipt_items')
        .select('category, total_price')
        .in('receipt_id', receipts.map((r) => r.id))

      if (iErr) { setError(iErr.message); return }

      const totals = new Map<string, number>()
      for (const item of items ?? []) {
        const prev = totals.get(item.category) ?? 0
        totals.set(item.category, prev + Number(item.total_price ?? 0))
      }

      setCategoryData(
        Array.from(totals.entries())
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total)
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return {
    monthlyData, storeMonthlyData, topItems, categoryData,
    error, loading,
    fetchMonthlySpend, fetchStoreMonthlySpend, fetchTopItems, fetchCategoryBreakdown,
  }
}
