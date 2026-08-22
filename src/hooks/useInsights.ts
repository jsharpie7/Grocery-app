import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'
import type { MonthlySpend, StoreMonthlySpend } from '../lib/supabase'

export interface TopItem {
  /** matched_item_id, or the normalized receipt name when the line never matched a catalog item. */
  groupKey: string
  /** null for unmatched line items (matched_item_id is SET NULL when a catalog item is deleted). */
  itemId: string | null
  displayName: string
  category: string
  totalSpend: number
  purchaseCount: number
  /** Most recent unit prices, newest first, for the price-history strip. */
  recentPrices: number[]
}

export interface CategoryBreakdown {
  category: string
  total: number
}

export interface MtdComparison {
  /** Spend so far in the current calendar month. */
  currentTotal: number
  /** Average of complete prior months, or null when there aren't any to average. */
  typicalMonth: number | null
}

/**
 * "$X so far this month vs. $Y in a typical month."
 *
 * Two months are deliberately excluded from the average:
 *  - the current month, which is partial by definition (including it would drag
 *    the baseline toward the very number it is supposed to be compared against);
 *  - the oldest month in the series, which is *structurally* partial because
 *    get_monthly_spend uses a rolling `CURRENT_DATE - N months` window, so its
 *    first month starts mid-month. Averaging it as though it were a full month
 *    permanently deflated the baseline.
 *
 * Pure and exported so the exclusions are unit-testable — the previous inline
 * version assumed `monthlyData`'s last row was always the current month, which
 * is false in any month that has no receipts yet.
 */
export function computeMtdComparison(monthlyData: MonthlySpend[], today: Date): MtdComparison {
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const currentRow = monthlyData.find((d) => d.month === currentMonthKey)
  const currentTotal = currentRow ? Number(currentRow.total) : 0

  // monthlyData arrives sorted ascending by month, so index 0 is the oldest.
  const completePriorMonths = monthlyData
    .filter((d) => d.month !== currentMonthKey)
    .slice(1)

  if (completePriorMonths.length === 0) return { currentTotal, typicalMonth: null }

  const sum = completePriorMonths.reduce((s, d) => s + Number(d.total), 0)
  return { currentTotal, typicalMonth: sum / completePriorMonths.length }
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

  /**
   * Top items by total dollars spent.
   *
   * Aggregation happens in Postgres (get_top_items_by_spend) rather than here:
   * the previous client-side version ranked by purchase COUNT while being
   * labelled as spend, and read from item_prices, which stores no quantity and
   * therefore cannot express dollars spent at all.
   */
  async function fetchTopItems(limit = 10, months = 12) {
    setError(null)
    const { data, error: err } = await supabase.rpc('get_top_items_by_spend', {
      p_months: months,
      p_limit: limit,
    })
    if (err) { setError(err.message); return }

    const rows = (data ?? []) as {
      group_key: string
      item_id: string | null
      display_name: string
      category: string
      total_spend: number | string
      purchase_count: number | string
      recent_prices: (number | string)[] | null
    }[]

    setTopItems(rows.map((r) => ({
      groupKey: r.group_key,
      itemId: r.item_id,
      displayName: r.display_name,
      category: r.category,
      totalSpend: Number(r.total_spend),
      purchaseCount: Number(r.purchase_count),
      recentPrices: (r.recent_prices ?? []).map(Number),
    })))
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
