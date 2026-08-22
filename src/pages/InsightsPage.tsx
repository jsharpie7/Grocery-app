import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useInsights } from '../hooks/useInsights'
import PageShell from '../components/layout/PageShell'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

type Tab = 'spend' | 'items' | 'stores'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6']

function formatMonth(m: string) {
  return new Date(m + 'T12:00:00').toLocaleString('default', { month: 'short' })
}

export default function InsightsPage() {
  const [tab, setTab] = useState<Tab>('spend')
  const {
    monthlyData, storeMonthlyData, topItems, categoryData,
    error, loading,
    fetchMonthlySpend, fetchStoreMonthlySpend, fetchTopItems, fetchCategoryBreakdown,
  } = useInsights()

  useEffect(() => {
    fetchMonthlySpend(12)
    fetchStoreMonthlySpend(12)
    fetchTopItems(10)
    fetchCategoryBreakdown(12)
  }, [])

  const totalReceipts = monthlyData.length

  return (
    <PageShell title="Insights">
      <ErrorBanner message={error} />

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
        {([['spend', 'Spending'], ['items', 'Top Items'], ['stores', 'Stores']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : totalReceipts === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Not enough data yet</h2>
          <p className="text-gray-500 text-sm mb-4">Add 3+ receipts to see spending trends</p>
          <div className="w-48 bg-gray-100 rounded-full h-2 mb-1">
            <div className="bg-indigo-400 h-2 rounded-full" style={{ width: `${Math.min(100, (totalReceipts / 3) * 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400">{totalReceipts} of 3 receipts</p>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {tab === 'spend' && (
            <>
              <div className="rounded-2xl bg-white border border-gray-100 p-4">
                <h2 className="text-sm font-medium text-gray-600 mb-3">Monthly Spending</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, 'Spend']} labelFormatter={formatMonth} />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} minPointSize={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {categoryData.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-100 p-4">
                  <h2 className="text-sm font-medium text-gray-600 mb-3">By Category</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${Number(v).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {tab === 'items' && (
            <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
              {topItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No item spend data yet</p>
              ) : topItems.map((ti) => (
                <div key={ti.groupKey} className="px-4 py-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{ti.displayName}</div>
                      <div className="text-xs text-gray-400">
                        {ti.category} · {ti.purchaseCount} {ti.purchaseCount === 1 ? 'purchase' : 'purchases'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-gray-900">${ti.totalSpend.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">total</div>
                    </div>
                  </div>
                  {ti.recentPrices.length > 1 && (
                    <div className="mt-2 flex gap-1 overflow-x-auto">
                      {ti.recentPrices.map((p, i) => (
                        <div key={i} className="shrink-0 text-xs text-gray-400 bg-gray-50 rounded px-1.5 py-0.5">
                          ${p.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'stores' && (
            <div className="space-y-4">
              {storeMonthlyData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No store data yet</p>
              ) : (
                (() => {
                  // Group by store
                  const stores = new Map<string, { name: string; months: { month: string; total: number }[] }>()
                  for (const d of storeMonthlyData) {
                    const s = stores.get(d.store_id) ?? { name: d.store_name, months: [] }
                    s.months.push({ month: d.month, total: Number(d.total) })
                    stores.set(d.store_id, s)
                  }
                  return Array.from(stores.values()).map((store, si) => (
                    <div key={si} className="rounded-2xl bg-white border border-gray-100 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">{store.name}</h3>
                      <ResponsiveContainer width="100%" height={100}>
                        <ComposedChart data={store.months} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                          <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, 'Spend']} labelFormatter={formatMonth} />
                          <Bar dataKey="total" fill={COLORS[si % COLORS.length]} radius={[3, 3, 0, 0]} minPointSize={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ))
                })()
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
