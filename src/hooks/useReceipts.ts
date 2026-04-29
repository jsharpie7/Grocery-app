import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadReceiptImage } from '../lib/storage'
import { matchItem, normalizeStoreName } from '../lib/itemMatcher'
import { useHouseholdStore } from '../store/householdStore'
import type { Receipt, ReceiptItem } from '../lib/supabase'

export interface PendingLineItem {
  item_name: string
  quantity: number
  unit: string
  unit_price: number | null
  total_price: number | null
  category: string
  matchedItemId?: string | null
  prevAvgPrice?: number | null
}

interface CreateReceiptInput {
  storeId: string | null
  receiptDate: string
  totalAmount: number
  taxAmount: number
  items: PendingLineItem[]
  imageFile: File | null
  notes?: string
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { householdId, stores } = useHouseholdStore()

  async function fetchReceipts(limit = 50) {
    if (!householdId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('receipts')
        .select('*, store:stores(*)')
        .eq('household_id', householdId)
        .order('receipt_date', { ascending: false })
        .limit(limit)
      if (err) { setError(err.message); return }
      setReceipts((data as Receipt[]) ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function deleteReceipt(id: string) {
    setError(null)
    const { error: err } = await supabase.from('receipts').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setReceipts((prev) => prev.filter((r) => r.id !== id))
  }

  async function resolveStoreId(storeName: string): Promise<string | null> {
    if (!householdId || !storeName.trim()) return null
    const normalized = normalizeStoreName(storeName)
    const existing = stores.find((s) => normalizeStoreName(s.name) === normalized)
    if (existing) return existing.id

    const { data, error: err } = await supabase
      .from('stores')
      .insert({ household_id: householdId, name: storeName.trim(), color: '#6366f1' })
      .select()
      .single()
    if (err) return null
    useHouseholdStore.getState().setStores([...stores, data])
    return data.id
  }

  async function matchAndPrepareItems(
    pendingItems: PendingLineItem[],
    existingItems: { id: string; name: string; household_id: string; category: string; created_at: string }[],
    storeId: string | null,
    receiptId: string,
  ): Promise<{ receiptItemRows: Omit<ReceiptItem, 'id'>[]; priceRows: { item_id: string; store_id: string | null; unit_price: number; receipt_id: string }[] }> {
    const receiptItemRows: Omit<ReceiptItem, 'id'>[] = []
    const priceRows: { item_id: string; store_id: string | null; unit_price: number; receipt_id: string }[] = []

    for (const pending of pendingItems) {
      const matched = matchItem(pending.item_name, existingItems)
      let itemId = matched?.id ?? null

      if (!itemId) {
        const { data: newItem, error: itemErr } = await supabase
          .from('items')
          .upsert(
            { household_id: householdId!, name: pending.item_name.trim().replace(/\s+/g, ' '), category: pending.category },
            { onConflict: 'household_id,name' }
          )
          .select()
          .single()
        if (!itemErr && newItem) itemId = newItem.id
      }

      receiptItemRows.push({
        receipt_id: receiptId,
        item_name: pending.item_name,
        quantity: pending.quantity,
        unit: pending.unit,
        unit_price: pending.unit_price,
        total_price: pending.total_price,
        category: pending.category,
        matched_item_id: itemId,
      })

      if (itemId && pending.unit_price != null) {
        priceRows.push({ item_id: itemId, store_id: storeId, unit_price: pending.unit_price, receipt_id: receiptId })
      }
    }

    return { receiptItemRows, priceRows }
  }

  async function createReceipt(input: CreateReceiptInput): Promise<{ receipt: Receipt | null; imageUploadFailed: boolean }> {
    if (!householdId) throw new Error('No household')
    setLoading(true)
    setError(null)
    let receipt: Receipt | null = null
    let imageUploadFailed = false

    try {
      // Upload image (non-blocking on failure)
      let imageUrl: string | null = null
      if (input.imageFile) {
        imageUrl = await uploadReceiptImage(householdId, input.imageFile)
        if (!imageUrl) imageUploadFailed = true
      }

      // Create receipt row
      const { data: receiptRow, error: receiptErr } = await supabase
        .from('receipts')
        .insert({
          household_id: householdId,
          store_id: input.storeId,
          receipt_date: input.receiptDate,
          total_amount: input.totalAmount,
          tax_amount: input.taxAmount,
          image_url: imageUrl,
          notes: input.notes ?? null,
        })
        .select('*, store:stores(*)')
        .single()

      if (receiptErr) {
        if (receiptErr.code === '23505') throw Object.assign(receiptErr, { isDuplicate: true })
        throw receiptErr
      }

      receipt = receiptRow as Receipt

      try {
        // Load existing items for matching
        const { data: existingItems } = await supabase
          .from('items')
          .select()
          .eq('household_id', householdId)

        const { receiptItemRows, priceRows } = await matchAndPrepareItems(
          input.items,
          existingItems ?? [],
          input.storeId,
          receipt.id,
        )

        if (receiptItemRows.length > 0) {
          const { error: riErr } = await supabase.from('receipt_items').insert(receiptItemRows)
          if (riErr) throw riErr
        }

        if (priceRows.length > 0) {
          // Check count and trim oldest if > 50 per item
          const itemIds = [...new Set(priceRows.map((p) => p.item_id))]
          for (const itemId of itemIds) {
            const { data: existingPrices } = await supabase
              .from('item_prices')
              .select('id')
              .eq('item_id', itemId)
              .order('purchased_at', { ascending: true })
            const count = existingPrices?.length ?? 0
            const toDelete = count + 1 - 50
            if (toDelete > 0 && existingPrices) {
              const idsToDelete = existingPrices.slice(0, toDelete).map((p) => p.id)
              await supabase.from('item_prices').delete().in('id', idsToDelete)
            }
          }
          await supabase.from('item_prices').insert(priceRows)
        }
      } catch (subErr) {
        // Cleanup orphaned receipt row
        await supabase.from('receipts').delete().eq('id', receipt.id)
        throw subErr
      }

      setReceipts((prev) => [receipt!, ...prev])
      return { receipt, imageUploadFailed }
    } catch (e) {
      const err = e as Error & { isDuplicate?: boolean }
      if (err.isDuplicate) throw err
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { receipts, error, loading, fetchReceipts, createReceipt, deleteReceipt, resolveStoreId }
}
