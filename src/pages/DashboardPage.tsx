import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useInsights, computeMtdComparison } from '../hooks/useInsights'
import { useReceipts } from '../hooks/useReceipts'
import PageShell from '../components/layout/PageShell'
import ReceiptCard from '../components/receipts/ReceiptCard'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

function formatMonth(m: string) {
  return new Date(m + 'T12:00:00').toLocaleString('default', { month: 'short' })
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { monthlyData, error: insightsError, loading: insightsLoading, fetchMonthlySpend } = useInsights()
  const { receipts, error: receiptsError, loading: receiptsLoading, fetchReceipts } = useReceipts()

  useEffect(() => {
    fetchMonthlySpend(12)
    fetchReceipts(5)
  }, [])

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // One baseline, shared by the headline stat and the chart's reference line,
  // so the two can never disagree about what a "typical month" is.
  const { currentTotal, typicalMonth } = computeMtdComparison(monthlyData, now)

  const isEmpty = monthlyData.length === 0 && !insightsLoading

  return (
    <PageShell title="Dashboard">
      <ErrorBanner message={insightsError ?? receiptsError} />

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">No spending data yet</h2>
          <p className="text-gray-500 text-sm mb-6">Upload your first receipt to see spending trends</p>
          <button
            onClick={() => navigate('/receipts/new')}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Upload Receipt →
          </button>
        </div>
      ) : (
        <>
          {/* This month stat */}
          <div className="mx-4 mt-4 rounded-2xl bg-indigo-600 p-5 text-white">
            <div className="text-sm opacity-80 mb-1">So far this month</div>
            <div className="text-3xl font-bold">${currentTotal.toFixed(2)}</div>
            {typicalMonth !== null && (
              <div className="text-sm mt-1 opacity-80">
                Typical month · ${typicalMonth.toFixed(2)}
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="mx-4 mt-4 rounded-2xl bg-white border border-gray-100 p-4">
            <h2 className="text-sm font-medium text-gray-600 mb-3">12-Month Spending</h2>
            {insightsLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, 'Spend']} labelFormatter={formatMonth} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} minPointSize={2}>
                    {monthlyData.map((d) => (
                      <Cell key={d.month} fill={d.month === currentMonth ? '#4f46e5' : '#a5b4fc'} />
                    ))}
                  </Bar>
                  {typicalMonth !== null && typicalMonth > 0 && (
                    <Line
                      type="monotone"
                      dataKey={() => typicalMonth}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent receipts */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-4 mb-2">
              <h2 className="text-sm font-medium text-gray-600">Recent Receipts</h2>
              <button onClick={() => navigate('/receipts')} className="text-xs text-indigo-600 font-medium">
                See all
              </button>
            </div>
            {receiptsLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : receipts.length === 0 ? (
              <p className="px-4 text-sm text-gray-400">No receipts yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {receipts.map((r) => <ReceiptCard key={r.id} receipt={r} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/receipts/new')}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-indigo-600 text-white text-2xl shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-transform"
        aria-label="Upload receipt"
      >
        +
      </button>
    </PageShell>
  )
}
