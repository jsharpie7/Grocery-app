import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { useInsights } from '../hooks/useInsights'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function formatMonth(m: string) {
  const [year, month] = m.split('-')
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short' })
}

function formatCurrency(n: number) {
  return `$${n.toFixed(2)}`
}

export default function Insights() {
  const navigate = useNavigate()
  const { data, loading, fetchInsights } = useInsights()

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <div className="flex items-center px-4 pt-12 pb-4 bg-white shadow-sm">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl mr-3"
        >
          ←
        </motion.button>
        <h1 className="text-xl font-bold text-gray-900">Insights</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="text-gray-400">Loading...</div>
          </div>
        )}

        {!loading && !data && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-lg font-medium">No data yet</p>
            <p className="text-sm mt-1">Complete some shopping trips first</p>
          </div>
        )}

        {data && (
          <div className="space-y-4 p-4">
            {/* Monthly Spend */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Monthly Spend</h2>
              {data.monthlySpend.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.monthlySpend}>
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatMonth} />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No spending data</p>
              )}
            </div>

            {/* Top 5 Items */}
            {data.topItems.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">Top Items This Month</h2>
                <div className="space-y-2">
                  {data.topItems.map((item, i) => (
                    <div key={item.item_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 w-4">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800">{item.item_name}</span>
                      </div>
                      <span className="text-sm font-semibold text-indigo-600">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {data.categorySpend.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">By Category</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.categorySpend}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.categorySpend.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-Store Spend */}
            {data.storeSpend.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">Per-Store Spend</h2>
                {data.storeSpend.map(store => (
                  <div key={store.store_id} className="mb-4">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">{store.store_name}</h3>
                    {store.monthly.length > 0 ? (
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={store.monthly}>
                          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="total" fill="#10b981" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* Shopping Times */}
            {data.tripTimes.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">Shopping Time</h2>
                <div className="space-y-3">
                  {data.tripTimes.map(tt => (
                    <div key={tt.store_id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-800">{tt.store_name}</span>
                        <span className="text-gray-500">{tt.trip_count} trips</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total: {tt.total_minutes} min</span>
                        <span className="text-indigo-600 font-semibold">Avg: {tt.avg_minutes} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
