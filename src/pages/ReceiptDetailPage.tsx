import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReceiptItems } from '../hooks/useReceiptItems'
import { useReceipts } from '../hooks/useReceipts'
import { useStores } from '../hooks/useStores'
import { useHouseholdStore } from '../store/householdStore'
import { longDate } from '../lib/dates'
import StorePicker from '../components/receipts/StorePicker'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import type { Receipt } from '../lib/supabase'

const money = (n: number) => `$${Number(n).toFixed(2)}`

/** Blank and half-typed values become null, not zero. */
function parseAmount(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { items, loading: itemsLoading, fetchReceiptItems } = useReceiptItems()
  const { deleteReceipt, updateReceipt, error: receiptsError } = useReceipts()
  const { createStore } = useStores()
  const stores = useHouseholdStore((s) => s.stores)

  // Edit is a mode rather than a separate screen: the same rows, made typeable.
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftDate, setDraftDate] = useState('')
  const [draftStoreId, setDraftStoreId] = useState<string | null>(null)
  const [draftStoreName, setDraftStoreName] = useState('')
  const [draftTotal, setDraftTotal] = useState('')
  const [draftTax, setDraftTax] = useState('')

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data, error: err } = await supabase
        .from('receipts')
        .select('*, store:stores(*)')
        .eq('id', id!)
        .single()
      if (err) { setError(err.message); return }
      setReceipt(data as Receipt)
      setLoadingReceipt(false)
    }
    load()
    fetchReceiptItems(id)
  }, [id])

  function startEdit() {
    if (!receipt) return
    setError(null)
    setDraftDate(receipt.receipt_date)
    setDraftStoreId(receipt.store_id)
    setDraftStoreName(receipt.store?.name ?? '')
    setDraftTotal(String(receipt.total_amount))
    setDraftTax(String(receipt.tax_amount ?? 0))
    setEditing(true)
  }

  async function handleSave() {
    if (!id || !receipt) return
    const total = parseAmount(draftTotal)
    if (!draftDate) { setError('Pick a date for this receipt.'); return }
    if (total == null || total <= 0) { setError('Enter a valid receipt total.'); return }

    setSaving(true)
    const ok = await updateReceipt(id, {
      receiptDate: draftDate,
      storeId: draftStoreId,
      totalAmount: total,
      taxAmount: parseAmount(draftTax) ?? 0,
    })
    setSaving(false)

    if (!ok) { setError(receiptsError ?? 'Could not save those changes.'); return }

    setReceipt({
      ...receipt,
      receipt_date: draftDate,
      store_id: draftStoreId,
      total_amount: total,
      tax_amount: parseAmount(draftTax) ?? 0,
      store: stores.find((s) => s.id === draftStoreId) ?? undefined,
    })
    setEditing(false)
  }

  async function handleDelete() {
    if (!id) return
    await deleteReceipt(id)
    navigate('/receipts')
  }

  const fieldClass = 'w-full rounded-input border border-border bg-surface px-3 py-3 text-field'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <div className="flex flex-none items-center justify-between px-4 pb-3 pt-2">
        {editing ? (
          <>
            <button onClick={() => { setEditing(false); setError(null) }} className="text-nav text-accent">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-nav font-semibold text-accent disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/receipts')} className="text-nav text-accent">‹ Receipts</button>
            {receipt && <button onClick={startEdit} className="text-nav text-accent">Edit</button>}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4.5 pb-6">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {loadingReceipt ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : receipt ? (
          <>
            {editing ? (
              <div className="rounded-card bg-surface px-4 py-4">
                <StorePicker
                  storeId={draftStoreId}
                  storeName={draftStoreName}
                  onChange={(sid, name) => { setDraftStoreId(sid); setDraftStoreName(name) }}
                  onCreateStore={async (name) => createStore(name, '#1D7A47')}
                />

                <div className="mt-3">
                  <label className="mb-1.5 block text-label text-ink-2" htmlFor="edit-date">Date</label>
                  <input
                    id="edit-date"
                    type="date"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="mt-3 flex gap-2.5">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-label text-ink-2" htmlFor="edit-total">Total</label>
                    <input
                      id="edit-total"
                      inputMode="decimal"
                      value={draftTotal}
                      onChange={(e) => setDraftTotal(e.target.value)}
                      className={`${fieldClass} border-2 border-accent px-[11px] py-[11px] text-right font-medium tabular-nums`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-label text-ink-2" htmlFor="edit-tax">Tax / fees</label>
                    <input
                      id="edit-tax"
                      inputMode="decimal"
                      value={draftTax}
                      onChange={(e) => setDraftTax(e.target.value)}
                      className={`${fieldClass} text-right tabular-nums`}
                    />
                  </div>
                </div>

                {/* Line items are corrected on the review screen when a receipt
                    is scanned, not here. */}
                <p className="mt-3 text-label leading-normal text-ink-2">
                  Item lines can't be changed after saving — only the receipt's own details.
                </p>

                <button
                  onClick={() => setConfirmDelete(true)}
                  className="mt-4 w-full rounded-button border border-danger/30 py-3 text-nav font-semibold text-danger"
                >
                  Delete receipt
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-title-detail">{receipt.store?.name ?? 'Unknown store'}</h1>
                <p className="mt-1 text-[15px] leading-snug text-ink-2">{longDate(receipt.receipt_date)}</p>

                <div className="mt-4 flex items-center gap-4 rounded-card bg-surface p-4.5">
                  {receipt.image_url ? (
                    <img
                      src={receipt.image_url}
                      alt="Receipt"
                      className="h-[76px] w-[58px] flex-none rounded-lg border border-hairline object-cover"
                    />
                  ) : (
                    <div className="h-[76px] w-[58px] flex-none rounded-lg border border-hairline bg-canvas" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-total-lg tabular-nums">{money(receipt.total_amount)}</p>
                    <p className="mt-1.5 text-meta leading-normal text-ink-2">
                      {items.length} item{items.length === 1 ? '' : 's'}
                      {receipt.tax_amount > 0 && ` · ${money(receipt.tax_amount)} tax`}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-baseline justify-between px-1 pb-2 pt-5.5">
              <h2 className="text-section">{items.length} item{items.length === 1 ? '' : 's'}</h2>
            </div>

            {itemsLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : items.length === 0 ? (
              <p className="px-1 text-meta text-ink-2">No line items recorded.</p>
            ) : (
              <div className="overflow-hidden rounded-card">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border-t border-hairline bg-surface px-4 py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-row">{item.item_name}</p>
                      <p className="mt-[3px] text-[12px] leading-tight text-ink-2">
                        {item.category} · qty {item.quantity}
                      </p>
                    </div>
                    <span className="text-amount tabular-nums">
                      {item.total_price != null ? money(item.total_price) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {receipt.notes && (
              <p className="mt-4 rounded-card bg-surface p-4 text-meta leading-normal text-ink-2">{receipt.notes}</p>
            )}
          </>
        ) : null}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-card bg-surface p-6">
            <h3 className="mb-2 text-[17px] font-semibold">Delete receipt?</h3>
            <p className="mb-5 text-meta leading-normal text-ink-2">
              This permanently deletes the receipt and all its line items.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-button border border-border py-3 text-nav font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-button bg-danger py-3 text-nav font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
