import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReceipts } from '../hooks/useReceipts'
import { monthYearLabel } from '../lib/dates'
import PageShell from '../components/layout/PageShell'
import ReceiptCard from '../components/receipts/ReceiptCard'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import type { Receipt } from '../lib/supabase'

/** Newest month first; receipts arrive already sorted by date descending. */
function groupByMonth(receipts: Receipt[]): [string, Receipt[]][] {
  const map = new Map<string, Receipt[]>()
  for (const r of receipts) {
    const month = r.receipt_date.slice(0, 7)
    const list = map.get(month) ?? []
    list.push(r)
    map.set(month, list)
  }
  return Array.from(map.entries())
}

interface SaveResult {
  savedTotal?: string
  imageUploadFailed?: boolean
}

export default function ReceiptsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { receipts, error, loading, fetchReceipts } = useReceipts()

  // A save lands here carrying its total, and confirms with a toast rather
  // than a success screen. Read once on mount; dismissing clears the history
  // entry so returning to this tab later does not replay it.
  const saved = location.state as SaveResult | null
  const [toast, setToast] = useState<SaveResult | null>(saved?.savedTotal ? saved : null)

  useEffect(() => { fetchReceipts(200) }, [])

  const grouped = groupByMonth(receipts)

  return (
    <PageShell title="Receipts">
      <div className="px-4"><ErrorBanner message={error} /></div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <h2 className="mb-2 text-section">No receipts yet</h2>
          <p className="mb-6 text-meta text-ink-2">Scan a receipt to start tracking your spending</p>
          <button
            onClick={() => navigate('/receipts/new')}
            className="rounded-button bg-accent px-6 py-3 text-nav font-semibold text-white active:bg-accent-pressed"
          >
            Scan a receipt
          </button>
        </div>
      ) : (
        grouped.map(([month, items]) => (
          <section key={month}>
            {/* A plain header floating over the canvas — the old full-bleed
                grey strip read as a divider between apps, not months. */}
            <div className="flex justify-between px-5 pb-2 pt-1.5">
              <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.3px] text-ink-muted">
                {monthYearLabel(month)}
              </span>
              <span className="text-meta tabular-nums text-ink-2">
                ${items.reduce((s, r) => s + Number(r.total_amount), 0).toFixed(2)}
              </span>
            </div>
            <div className="mx-4 mb-4.5 overflow-hidden rounded-card">
              {items.map((r) => <ReceiptCard key={r.id} receipt={r} showChevron />)}
            </div>
          </section>
        ))
      )}

      {toast && (
        <Toast
          message={toast.imageUploadFailed ? 'Saved without photo' : 'Receipt saved'}
          detail={toast.savedTotal}
          onDismiss={() => {
            setToast(null)
            navigate('/receipts', { replace: true, state: null })
          }}
        />
      )}
    </PageShell>
  )
}
