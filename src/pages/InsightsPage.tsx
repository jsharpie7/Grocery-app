import { useEffect, useState } from 'react'
import { useInsights } from '../hooks/useInsights'
import { priceTrend } from '../lib/itemTrends'
import PageShell from '../components/layout/PageShell'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

type Sort = 'spend' | 'price' | 'store'

const SORTS: [Sort, string][] = [
  ['spend', 'Most spent'],
  ['price', 'Price up'],
  ['store', 'By store'],
]

const money = (n: number) => `$${n.toFixed(2)}`

/**
 * One row: a name and a figure, over metadata and a trend.
 *
 * What the figure and the trend *mean* changes with the segment, so the row
 * takes them already decided rather than working them out.
 */
function ItemRow({ name, figure, meta, trend, tone }: {
  name: string
  figure: string
  meta: string
  trend: string
  tone: 'up' | 'down' | 'flat'
}) {
  const trendColor = tone === 'up' ? 'text-danger' : tone === 'down' ? 'text-accent' : 'text-ink-2'
  return (
    <div className="border-t border-hairline bg-surface px-4 py-3.5 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-row">{name}</span>
        <span className="text-[16px] font-semibold leading-none tabular-nums">{figure}</span>
      </div>
      <div className="mt-[5px] flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-[12px] leading-none text-ink-2">{meta}</span>
        <span className={`text-[12px] font-semibold leading-none ${trendColor}`}>{trend}</span>
      </div>
    </div>
  )
}

export default function InsightsPage() {
  const [sort, setSort] = useState<Sort>('spend')
  const {
    topItems, storePriceGaps, error, loading,
    fetchTopItems, fetchStorePriceGaps,
  } = useInsights()

  useEffect(() => {
    fetchTopItems(25)
    fetchStorePriceGaps(12)
  }, [])

  // "Price up" reorders the same items by how much their price moved, so both
  // segments read from one fetch rather than two.
  const priced = topItems
    .map((t) => ({ item: t, trend: priceTrend(t.recentPrices) }))
    .filter((r) => r.trend.oldest != null && r.trend.latest != null && r.trend.direction !== 'flat')
    .sort((a, b) => b.trend.percent - a.trend.percent)

  const rows = sort === 'store' ? storePriceGaps : sort === 'price' ? priced : topItems
  const isEmpty = !loading && rows.length === 0

  return (
    <PageShell title="Items">
      <div className="px-4">
        <ErrorBanner message={error} />

        <div className="mb-4 flex rounded-seg bg-track p-[3px]">
          {SORTS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              aria-pressed={sort === id}
              className={`flex-1 rounded-seg-thumb py-[7px] text-seg ${
                sort === id ? 'bg-surface text-ink' : 'text-ink-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : isEmpty ? (
          <p className="px-1 py-12 text-center text-meta text-ink-2">
            {sort === 'store'
              ? 'Nothing to compare yet — buy the same item at two different stores and its cheapest shop shows up here.'
              : sort === 'price'
                ? 'No price movement yet. Prices show up here once an item has been bought more than once.'
                : 'No item spend yet. Scan a receipt to start tracking.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-card">
            {sort === 'spend' && topItems.map((t) => {
              const trend = priceTrend(t.recentPrices)
              return (
                <ItemRow
                  key={t.groupKey}
                  name={t.displayName}
                  figure={money(t.totalSpend)}
                  meta={`${t.category} · ${t.purchaseCount} buy${t.purchaseCount === 1 ? '' : 's'} · avg ${money(t.totalSpend / t.purchaseCount)}`}
                  trend={trend.direction === 'flat' ? 'flat' : `${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.percent)}%`}
                  tone={trend.direction}
                />
              )
            })}

            {sort === 'price' && priced.map(({ item, trend }) => (
              <ItemRow
                key={item.groupKey}
                name={item.displayName}
                figure={money(item.totalSpend)}
                meta={`${item.category} · was ${money(trend.oldest!)}, now ${money(trend.latest!)}`}
                trend={`${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.percent)}%`}
                tone={trend.direction}
              />
            ))}

            {sort === 'store' && storePriceGaps.map((g) => (
              <ItemRow
                key={g.itemId}
                name={g.displayName}
                figure={money(g.cheapestPrice)}
                meta={`Cheapest at ${g.cheapestStore} · ${money(g.dearestPrice)} at ${g.dearestStore}`}
                trend={`save ${g.savingPercent}%`}
                tone="down"
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
