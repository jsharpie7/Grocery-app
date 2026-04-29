import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ReceiptItem } from '../lib/supabase'

export function useReceiptItems() {
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchReceiptItems(receiptId: string) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('receipt_items')
        .select()
        .eq('receipt_id', receiptId)
        .order('id')
      if (err) { setError(err.message); return }
      setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  return { items, error, loading, fetchReceiptItems }
}
