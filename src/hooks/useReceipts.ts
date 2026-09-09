import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadReceiptImage } from '../lib/storage'
import { matchItem, normalizeStoreName } from '../lib/itemMatcher'
import { useHouseholdStore } from '../store/householdStore'
import type { Receipt, ReceiptItem, Item, ItemAlias } from '../lib/supabase'

export interface PendingLineItem {
  item_number: string | null
  ocr_name: string | null       // original OCR name — never shown, used for alias creation
  item_name: string             // display name (may be pre-filled from catalog or edited)
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

  function findAlias(
    ocrName: string,
    normBarcode: string | null,
    storeId: string | null,
    aliases: (ItemAlias & { item: Item | null })[],
  ): (ItemAlias & { item: Item | null }) | null {
    const normName = ocrName.toLowerCase().trim()
    const byBarcode = (a: ItemAlias & { item: Item | null }) =>
      normBarcode && a.item_number?.replace(/\D/g, '') === normBarcode && a.item
    const byName = (a: ItemAlias & { item: Item | null }) =>
      a.receipt_name.toLowerCase().trim() === normName && a.item

    return (
      (normBarcode && storeId && aliases.find(a => a.store_id === storeId && byBarcode(a))) ||
      (normBarcode && aliases.find(a => byBarcode(a))) ||
      (storeId && aliases.find(a => a.store_id === storeId && byName(a))) ||
      aliases.find(a => byName(a)) ||
      null
    )
  }

  async function resolveAliasesForReview(
    extractedItems: { item_number: string | null; item_name: string; quantity: number; unit: string; unit_price: number | null; total_price: number | null; category: string }[],
    storeId: string | null,
  ): Promise<PendingLineItem[]> {
    const base = extractedItems.map(i => ({
      ocr_name: i.item_name,
      item_name: i.item_name,
      item_number: i.item_number,
      quantity: i.quantity,
      unit: i.unit,
      unit_price: i.unit_price,
      total_price: i.total_price,
      category: i.category,
      matchedItemId: null as string | null,
      prevAvgPrice: null as number | null,
    }))
    if (!householdId || extractedItems.length === 0) return base

    const [{ data: aliasData }, { data: itemData }] = await Promise.all([
      supabase.from('item_aliases').select('*').eq('household_id', householdId),
      supabase.from('items').select().eq('household_id', householdId),
    ])
    const items = (itemData ?? []) as Item[]
    const aliases = ((aliasData ?? []) as ItemAlias[]).map(a => ({
      ...a,
      item: items.find(i => i.id === a.item_id) ?? null,
    }))

    return base.map((pending, idx) => {
      const normBarcode = extractedItems[idx].item_number?.replace(/\D/g, '') ?? null
      const alias = findAlias(pending.item_name, normBarcode, storeId, aliases)
      if (alias?.item) {
        return { ...pending, item_name: alias.item.name, category: alias.item.category, matchedItemId: alias.item_id }
      }
      const fuzzy = matchItem(pending.item_name, items, normBarcode)
      if (fuzzy) {
        return { ...pending, item_name: fuzzy.name, category: fuzzy.category, matchedItemId: fuzzy.id }
      }
      return pending
    })
  }

  async function fetchReceipts(limit = 50) {
    if (!householdId) return
    setLoading(true)
    setError(null)
    try {
      // List rows read "{date} · {n} items", so the count comes back with the
      // receipt rather than as a query per row. If the embedded aggregate is
      // unavailable, fall back to the plain select: a missing count costs one
      // line of caption, an unhandled error costs the whole list.
      const query = (select: string) => supabase
        .from('receipts')
        .select(select)
        .eq('household_id', householdId)
        .order('receipt_date', { ascending: false })
        .limit(limit)

      let { data, error: err } = await query('*, store:stores(*), receipt_items(count)')
      if (err) {
        ({ data, error: err } = await query('*, store:stores(*)'))
      }
      if (err) { setError(err.message); return }

      type CountRow = Receipt & { receipt_items?: { count: number }[] }
      setReceipts(
        ((data as unknown as CountRow[]) ?? []).map(({ receipt_items, ...r }) => ({
          ...r,
          item_count: receipt_items?.[0]?.count,
        })),
      )
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
      .insert({ household_id: householdId, name: storeName.trim(), color: '#1D7A47' })
      .select()
      .single()
    if (err) return null
    useHouseholdStore.getState().setStores([...stores, data])
    return data.id
  }

  async function matchAndPrepareItems(
    pendingItems: PendingLineItem[],
    existingItems: Item[],
    existingAliases: ItemAlias[],
    storeId: string | null,
    receiptId: string,
  ): Promise<{ receiptItemRows: Omit<ReceiptItem, 'id'>[]; priceRows: { item_id: string; store_id: string | null; unit_price: number; receipt_id: string }[]; newAliasRows: Omit<ItemAlias, 'id'>[] }> {
    const receiptItemRows: Omit<ReceiptItem, 'id'>[] = []
    const priceRows: { item_id: string; store_id: string | null; unit_price: number; receipt_id: string }[] = []
    const newAliasRows: Omit<ItemAlias, 'id'>[] = []
    const aliasesWithItems = existingAliases.map(a => ({ ...a, item: existingItems.find(i => i.id === a.item_id) ?? null }))

    for (const pending of pendingItems) {
      const normBarcode = pending.item_number?.replace(/\D/g, '') ?? null

      // Use matchedItemId from review if already resolved, otherwise re-match
      let itemId = pending.matchedItemId ?? null
      if (!itemId) {
        const alias = findAlias(pending.ocr_name ?? pending.item_name, normBarcode, storeId, aliasesWithItems)
        itemId = alias?.item_id ?? null
      }
      if (!itemId) {
        const fuzzy = matchItem(pending.item_name, existingItems, normBarcode)
        itemId = fuzzy?.id ?? null
        if (fuzzy && !fuzzy.item_number && normBarcode) {
          await supabase.from('items').update({ item_number: normBarcode }).eq('id', fuzzy.id)
        }
      }
      if (!itemId) {
        const { data: newItem, error: itemErr } = await supabase
          .from('items')
          .upsert(
            { household_id: householdId!, name: pending.item_name.trim().replace(/\s+/g, ' '), category: pending.category, item_number: normBarcode },
            { onConflict: 'household_id,name' }
          )
          .select()
          .single()
        if (!itemErr && newItem) { itemId = newItem.id; existingItems.push(newItem) }
      }

      receiptItemRows.push({
        receipt_id: receiptId,
        item_name: pending.item_name,
        item_number: normBarcode,
        quantity: pending.quantity,
        unit: pending.unit,
        unit_price: pending.unit_price,
        total_price: pending.total_price,
        category: pending.category,
        matched_item_id: itemId,
      })

      // Prepare alias row if not already known
      if (itemId) {
        const ocrName = (pending.ocr_name ?? pending.item_name).trim()
        const normName = ocrName.toLowerCase()
        const exists = existingAliases.some(a =>
          a.item_id === itemId &&
          a.store_id === storeId &&
          a.receipt_name.toLowerCase().trim() === normName
        )
        if (!exists) {
          newAliasRows.push({ household_id: householdId!, item_id: itemId, store_id: storeId, receipt_name: ocrName, item_number: normBarcode })
        }
      }

      if (itemId && pending.unit_price != null) {
        priceRows.push({ item_id: itemId, store_id: storeId, unit_price: pending.unit_price, receipt_id: receiptId })
      }
    }

    return { receiptItemRows, priceRows, newAliasRows }
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
        // Load existing items and aliases for matching
        const [{ data: existingItems }, { data: aliasData }] = await Promise.all([
          supabase.from('items').select().eq('household_id', householdId),
          supabase.from('item_aliases').select('*').eq('household_id', householdId),
        ])

        const { receiptItemRows, priceRows, newAliasRows } = await matchAndPrepareItems(
          input.items,
          existingItems ?? [],
          (aliasData ?? []) as ItemAlias[],
          input.storeId,
          receipt.id,
        )

        if (receiptItemRows.length > 0) {
          const { error: riErr } = await supabase.from('receipt_items').insert(receiptItemRows)
          if (riErr) throw riErr
        }

        if (newAliasRows.length > 0) {
          await supabase.from('item_aliases').upsert(newAliasRows, { onConflict: 'household_id,store_id,receipt_name', ignoreDuplicates: true })
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

  return { receipts, error, loading, fetchReceipts, createReceipt, deleteReceipt, resolveStoreId, resolveAliasesForReview }
}
