import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useInsights } from '../hooks/useInsights'
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
  const currentMonthData = monthlyData.find((d) => d.month === currentMonth)
  const currentTotal = currentMonthData ? Number(currentMonthData.total) : 0

  const avg =
    monthlyData.length > 1
      ? monthlyData.slice(0, -1).reduce((s, d) => s + Number(d.total), 0) / (monthlyData.length - 1)
      : 0

  const pctDelta = avg > 0 ? Math.round(((currentTotal - avg) / avg) * 100) : null

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
            <div className="text-sm opacity-80 mb-1">This Month</div>
            <div className="text-3xl font-bold">${currentTotal.toFixed(2)}</div>
            {pctDelta !== null && (
              <div className={`text-sm mt-1 ${pctDelta > 0 ? 'text-red-200' : 'text-green-200'}`}>
                {pctDelta > 0 ? '↑' : '↓'}{Math.abs(pctDelta)}% vs avg ${avg.toFixed(2)}/mo
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
                  {avg > 0 && (
                    <Line
                      type="monotone"
                      dataKey={() => avg}
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
