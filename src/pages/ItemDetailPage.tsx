import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useItemHistory } from '../hooks/useItemHistory'
import { shortDate } from '../lib/dates'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

const money = (n: number | null) => (n == null ? '—' : `$${n.toFixed(2)}`)

/**
 * Every purchase of one item — date, store, price.
 *
 * This is the screen that makes the Items figures checkable. A monthly average
 * is only trustworthy if you can see the purchases behind it, and gaps in this
 * list are the honest answer to "that number looks too low".
 */
export default function ItemDetailPage() {
  const { groupKey = '' } = useParams<{ groupKey: string }>()
  const navigate = useNavigate()
  const { purchases, loading, error, fetchHistory } = useItemHistory()

  useEffect(() => { if (groupKey) fetchHistory(decodeURIComponent(groupKey)) }, [groupKey])

  const total = purchases.reduce((sum, p) => sum + (p.totalPrice ?? 0), 0)
  const units = purchases.reduce((sum, p) => sum + p.quantity, 0)
  // The catalog name the list showed; the per-receipt name can differ.
  const title = purchases[0]?.itemName ?? 'Item'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <div className="flex flex-none items-center justify-between px-4 pb-3 pt-2">
        <button onClick={() => navigate('/insights')} className="text-nav text-accent">‹ Items</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4.5 pb-6">
        <ErrorBanner message={error} />

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : purchases.length === 0 ? (
          <p className="px-1 py-12 text-center text-meta text-ink-2">
            No purchases recorded in the last 12 months.
          </p>
        ) : (
          <>
            <h1 className="text-title-detail">{title}</h1>
            <p className="mt-1 text-[15px] leading-snug text-ink-2">
              {money(total)} over {purchases.length} trip{purchases.length === 1 ? '' : 's'}
              {units !== purchases.length && ` · ${units} bought`}
            </p>

            <div className="flex items-baseline justify-between px-1 pb-2 pt-5.5">
              <h2 className="text-section">Every purchase</h2>
              <span className="text-meta text-ink-2">newest first</span>
            </div>

            <div className="overflow-hidden rounded-card">
              {purchases.map((p, i) => (
                <div
                  key={`${p.receiptId}-${i}`}
                  className="border-t border-hairline bg-surface first:border-t-0"
                >
                  <button
                    onClick={() => navigate(`/receipts/${p.receiptId}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-canvas"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-row">{shortDate(p.date)}</span>
                      <span className="mt-[3px] block truncate text-[12px] leading-tight text-ink-2">
                        {p.storeName ?? 'Unknown store'}
                        {p.quantity !== 1 && ` · ${p.quantity} @ ${money(p.unitPrice)}`}
                      </span>
                    </span>
                    <span className="text-amount tabular-nums">{money(p.totalPrice)}</span>
                    <span aria-hidden className="text-nav text-ink-4">›</span>
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-3 px-1 text-label leading-normal text-ink-2">
              Tap a purchase to open its receipt.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
