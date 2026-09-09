import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReceiptItems } from '../hooks/useReceiptItems'
import { useReceipts } from '../hooks/useReceipts'
import { longDate } from '../lib/dates'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import type { Receipt } from '../lib/supabase'

const money = (n: number) => `$${Number(n).toFixed(2)}`

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { items, loading: itemsLoading, fetchReceiptItems } = useReceiptItems()
  const { deleteReceipt } = useReceipts()

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

  async function handleDelete() {
    if (!id) return
    await deleteReceipt(id)
    navigate('/receipts')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* A pushed screen: back and delete sit on the nav row, and the screen's
          name is the large store title below rather than a centred caption. */}
      <div className="flex flex-none items-center justify-between px-4 pb-3 pt-2">
        <button onClick={() => navigate('/receipts')} className="text-nav text-accent">‹ Receipts</button>
        <button onClick={() => setConfirmDelete(true)} className="text-nav text-danger">Delete</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4.5 pb-6">
        <ErrorBanner message={error} />

        {loadingReceipt ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : receipt ? (
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
