import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useInsights, computeMtdComparison } from '../hooks/useInsights'
import { useReceipts } from '../hooks/useReceipts'
import PageShell from '../components/layout/PageShell'
import ReceiptCard from '../components/receipts/ReceiptCard'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

const money = (n: number) => `$${n.toFixed(2)}`
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/**
 * Axis tick: one initial per month, the current one picked out in accent.
 *
 * Recharts has no way to style a single tick differently, so the tick is a
 * component. `payload.value` is the `YYYY-MM` key the bars are keyed on.
 */
function MonthInitial({ x, y, payload, currentMonth }: {
  x?: number
  y?: number
  payload?: { value: string }
  currentMonth: string
}) {
  const isCurrent = payload?.value === currentMonth
  const initial = new Date(`${payload?.value}-01T12:00:00`).toLocaleDateString('en-US', { month: 'narrow' })
  return (
    <text
      x={x}
      y={y}
      dy={10}
      textAnchor="middle"
      fontSize={11}
      fontWeight={isCurrent ? 600 : 400}
      fill={isCurrent ? '#1D7A47' : '#A9A9AE'}
    >
      {initial}
    </text>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { monthlyData, error: insightsError, loading: insightsLoading, fetchMonthlySpend } = useInsights()
  const { receipts, error: receiptsError, loading: receiptsLoading, fetchReceipts } = useReceipts()

  useEffect(() => {
    fetchMonthlySpend(12)
    fetchReceipts(3)
  }, [])

  const now = new Date()
  const currentMonth = monthKey(now)

  // One baseline, shared by the headline stat and the pace figure, so the two
  // can never disagree about what a "typical month" is.
  const { currentTotal, typicalMonth } = computeMtdComparison(monthlyData, now)

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Pace against the typical month, as a whole percentage either side of it.
  const pace = typicalMonth != null && typicalMonth > 0
    ? Math.round((1 - currentTotal / typicalMonth) * 100)
    : null
  const spentFraction = typicalMonth != null && typicalMonth > 0
    ? Math.min(currentTotal / typicalMonth, 1)
    : 0

  const isEmpty = monthlyData.length === 0 && !insightsLoading
  const monthName = now.toLocaleDateString('en-US', { month: 'long' })

  return (
    <PageShell title={monthName}>
      <div className="px-4"><ErrorBanner message={insightsError ?? receiptsError} /></div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <h2 className="mb-2 text-section">No spending data yet</h2>
          <p className="mb-6 text-meta text-ink-2">Scan your first receipt to see spending trends</p>
          <button
            onClick={() => navigate('/receipts/new')}
            className="rounded-button bg-accent px-6 py-3 text-nav font-semibold text-white active:bg-accent-pressed"
          >
            Scan a receipt
          </button>
        </div>
      ) : (
        <div className="px-4">
          {/* Am I over or under this month? */}
          <div className="rounded-card bg-surface p-4.5">
            <p className="text-meta leading-none text-ink-2">Spent so far</p>
            <p className="mt-1.5 text-hero tabular-nums">{money(currentTotal)}</p>
            {typicalMonth != null && (
              <>
                <p className="mt-2.5 flex items-center gap-1.5 text-meta leading-none">
                  {pace != null && (
                    <span className="font-semibold text-accent">
                      {Math.abs(pace)}% {pace >= 0 ? 'under' : 'over'}
                    </span>
                  )}
                  <span className="text-ink-2">a typical month ({money(typicalMonth)})</span>
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-[4px] bg-track">
                  <div className="h-full rounded-[4px] bg-accent" style={{ width: `${spentFraction * 100}%` }} />
                </div>
                <div className="mt-[7px] flex justify-between text-label text-ink-3">
                  <span>{monthStart}</span>
                  <span>day {now.getDate()} of {daysInMonth}</span>
                </div>
              </>
            )}
          </div>

          {/* Twelve months, current one picked out. */}
          <div className="mt-3.5 rounded-card bg-surface px-4.5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-section">Last 12 months</h2>
              {typicalMonth != null && (
                <span className="text-meta text-ink-2">avg ${Math.round(typicalMonth)}</span>
              )}
            </div>
            {insightsLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <div className="mt-4 h-[116px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={6}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={<MonthInitial currentMonth={currentMonth} />}
                    />
                    <Tooltip
                      cursor={false}
                      formatter={(v: number) => [money(Number(v)), 'Spend']}
                      labelFormatter={(m: string) =>
                        new Date(`${m}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      }
                      contentStyle={{ borderRadius: 10, border: '1px solid #EBEBF0', fontSize: 13 }}
                    />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} minPointSize={2} isAnimationActive={false}>
                      {monthlyData.map((d) => (
                        <Cell key={d.month} fill={d.month === currentMonth ? '#1D7A47' : '#DCDCE0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between px-1 pb-2 pt-5.5">
            <h2 className="text-section">Recent</h2>
            <button onClick={() => navigate('/receipts')} className="text-[15px] leading-none text-accent">
              See all
            </button>
          </div>

          {receiptsLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : receipts.length === 0 ? (
            <p className="px-1 text-meta text-ink-2">No receipts yet</p>
          ) : (
            <div className="overflow-hidden rounded-card">
              {receipts.map((r) => <ReceiptCard key={r.id} receipt={r} />)}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
