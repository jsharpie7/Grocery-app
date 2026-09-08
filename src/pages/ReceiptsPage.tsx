import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReceipts } from '../hooks/useReceipts'
import PageShell from '../components/layout/PageShell'
import ReceiptCard from '../components/receipts/ReceiptCard'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import Toast from '../components/ui/Toast'
import type { Receipt } from '../lib/supabase'

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

function formatMonthHeader(m: string) {
  return new Date(m + '-01T12:00:00').toLocaleString('default', { month: 'long', year: 'numeric' })
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
      <ErrorBanner message={error} />

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">No receipts yet</h2>
          <p className="text-gray-500 text-sm mb-6">Upload a receipt to start tracking your spending</p>
          <button
            onClick={() => navigate('/receipts/new')}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Upload Receipt
          </button>
        </div>
      ) : (
        <div>
          {grouped.map(([month, items]) => (
            <div key={month}>
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                {formatMonthHeader(month)}
                <span className="float-right font-normal normal-case">
                  ${items.reduce((s, r) => s + Number(r.total_amount), 0).toFixed(2)}
                </span>
              </div>
              <div className="divide-y divide-gray-100 bg-white">
                {items.map((r) => <ReceiptCard key={r.id} receipt={r} />)}
              </div>
            </div>
          ))}
        </div>
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
