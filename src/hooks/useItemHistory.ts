import { useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ItemPurchase {
  receiptId: string
  /** ISO date, e.g. 2026-09-05. */
  date: string
  storeName: string | null
  /** The name as it appeared on that receipt, which may differ from the
   *  catalog name the list shows. */
  itemName: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
}

/**
 * Every purchase of one item: when, where, how much.
 *
 * Keyed on the same `group_key` the items list is grouped by, so opening a row
 * cannot land on a different set of purchases than the row was totalled from.
 */
export function useItemHistory() {
  const [purchases, setPurchases] = useState<ItemPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchHistory(groupKey: string, months = 12) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_item_purchase_history', {
        p_group_key: groupKey,
        p_months: months,
      })
      if (err) { setError(err.message); return }

      const rows = (data ?? []) as {
        receipt_id: string
        receipt_date: string
        store_name: string | null
        item_name: string
        quantity: number | string
        unit_price: number | string | null
        total_price: number | string | null
      }[]

      setPurchases(rows.map((r) => ({
        receiptId: r.receipt_id,
        date: r.receipt_date,
        storeName: r.store_name,
        itemName: r.item_name,
        quantity: Number(r.quantity),
        unitPrice: r.unit_price == null ? null : Number(r.unit_price),
        totalPrice: r.total_price == null ? null : Number(r.total_price),
      })))
    } finally {
      setLoading(false)
    }
  }

  return { purchases, loading, error, fetchHistory }
}
