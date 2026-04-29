import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReceiptItems } from '../hooks/useReceiptItems'
import { useReceipts } from '../hooks/useReceipts'
import PageShell from '../components/layout/PageShell'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import type { Receipt } from '../lib/supabase'

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

  const date = receipt
    ? new Date(receipt.receipt_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : ''

  return (
    <PageShell
      title="Receipt Detail"
      action={
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-sm text-red-500 hover:text-red-700 font-medium"
        >
          Delete
        </button>
      }
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
      </div>

      <ErrorBanner message={error} />

      {loadingReceipt ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : receipt ? (
        <div className="p-4 space-y-5">
          {receipt.image_url && (
            <img src={receipt.image_url} alt="Receipt" className="w-full rounded-2xl object-contain max-h-64" />
          )}

          <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Store</span>
              <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                {receipt.store && (
                  <span
                    className="h-3 w-3 rounded-full inline-block"
                    style={{ backgroundColor: receipt.store.color }}
                  />
                )}
                {receipt.store?.name ?? '—'}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-900">{date}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-sm font-semibold text-gray-900">${Number(receipt.total_amount).toFixed(2)}</span>
            </div>
            {receipt.tax_amount > 0 && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Tax / Fees</span>
                <span className="text-sm text-gray-700">${Number(receipt.tax_amount).toFixed(2)}</span>
              </div>
            )}
            {receipt.notes && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Notes</span>
                <span className="text-sm text-gray-700">{receipt.notes}</span>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Items ({items.length})</h2>
            {itemsLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-400">No line items recorded.</p>
            ) : (
              <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                      <div className="text-xs text-gray-400">{item.category} · {item.quantity} {item.unit}</div>
                    </div>
                    <div className="text-sm text-gray-700">
                      {item.total_price != null ? `$${Number(item.total_price).toFixed(2)}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Receipt?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the receipt and all its line items.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
