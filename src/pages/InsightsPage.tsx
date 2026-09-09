import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useInsights } from '../hooks/useInsights'
import { MIN_MONTHS_FOR_RATE, monthsCovered, priceTrend } from '../lib/itemTrends'
import PageShell from '../components/layout/PageShell'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

type Sort = 'spend' | 'price'

const SORTS: [Sort, string][] = [
  ['spend', 'Most spent'],
  ['price', 'Price up'],
]

/** How far back the item figures look. */
const MONTHS = 12

const money = (n: number) => `$${n.toFixed(2)}`

/**
 * "22 bought over 13 trips", or just "13 buys" when they are the same number.
 *
 * These are different questions and used to be conflated: the old count was
 * receipt lines, so two rotisserie chickens on one receipt read as one buy.
 */
function boughtLabel(units: number, trips: number): string {
  const rounded = Math.round(units * 100) / 100
  if (rounded === trips) return `${trips} buy${trips === 1 ? '' : 's'}`
  return `${rounded} bought over ${trips} trip${trips === 1 ? '' : 's'}`
}

/**
 * One row: a name and a figure, over metadata and a trend.
 *
 * What the figure and the trend *mean* changes with the segment, so the row
 * takes them already decided rather than working them out.
 */
function ItemRow({ groupKey, name, figure, meta, trend, tone }: {
  groupKey: string
  name: string
  figure: string
  meta: string
  trend: string
  tone: 'up' | 'down' | 'flat'
}) {
  const trendColor = tone === 'up' ? 'text-danger' : tone === 'down' ? 'text-accent' : 'text-ink-2'
  return (
    <Link
      to={`/items/${encodeURIComponent(groupKey)}`}
      className="block border-t border-hairline bg-surface px-4 py-3.5 first:border-t-0 active:bg-canvas"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-row">{name}</span>
        <span className="text-[16px] font-semibold leading-none tabular-nums">{figure}</span>
      </div>
      <div className="mt-[5px] flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-[12px] leading-none text-ink-2">{meta}</span>
        <span className={`text-[12px] font-semibold leading-none ${trendColor}`}>{trend}</span>
      </div>
    </Link>
  )
}

export default function InsightsPage() {
  const [sort, setSort] = useState<Sort>('spend')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const { topItems, monthlyData, error, loading, fetchTopItems, fetchMonthlySpend } = useInsights()

  // Debounced so a query goes out per pause, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // A search looks across everything, so it lifts the top-25 cap that makes
  // sense for a leaderboard but would hide most matches.
  useEffect(() => {
    fetchTopItems(query.trim() ? 200 : 25, MONTHS, query)
  }, [query])

  useEffect(() => {
    // Not for a chart — this is how the screen learns how long the household
    // has actually been tracking, which is the divisor for every /mo figure.
    fetchMonthlySpend(MONTHS)
  }, [])

  // `monthlyData` only contains months that have receipts, oldest first, so
  // its first row is the start of the record.
  const monthsTracked = monthlyData.length ? monthsCovered(monthlyData[0].month, new Date()) : 0
  const showRate = monthsTracked >= MIN_MONTHS_FOR_RATE

  /** The headline figure: a monthly rate once that means something, else the plain total. */
  const figureFor = (totalSpend: number) =>
    showRate ? `${money(totalSpend / monthsTracked)}/mo` : money(totalSpend)

  // "Price up" reorders the same items by how far the price moved, so both
  // segments read from one fetch rather than two.
  const priced = topItems
    .map((t) => ({ item: t, trend: priceTrend(t.recentPrices) }))
    .filter((r) => r.trend.oldest != null && r.trend.latest != null && r.trend.direction !== 'flat')
    .sort((a, b) => b.trend.percent - a.trend.percent)

  const isEmpty = !loading && (sort === 'price' ? priced.length : topItems.length) === 0

  return (
    <PageShell title="Items">
      <div className="px-4">
        <ErrorBanner message={error} />

        <div className="relative mb-3">
          <Search
            size={17}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items"
            aria-label="Search items"
            className="w-full rounded-input border border-border bg-surface py-2.5 pl-9 pr-9 text-field"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-ink-3"
            >
              <X size={17} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>

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
            {query.trim()
              ? `Nothing matching “${query.trim()}” in the last ${MONTHS} months.`
              : sort === 'price'
              ? 'No price movement yet. Prices show up here once an item has been bought more than once.'
                : 'No item spend yet. Scan a receipt to start tracking.'}
          </p>
        ) : (
          <>
            {!showRate && (
              <p className="mb-2 px-1 text-label leading-normal text-ink-2">
                Showing totals. A monthly average needs at least{' '}
                {MIN_MONTHS_FOR_RATE} months of receipts.
              </p>
            )}
            <div className="overflow-hidden rounded-card">
            {sort === 'spend' && topItems.map((t) => {
              const trend = priceTrend(t.recentPrices)
              return (
                <ItemRow
                  key={t.groupKey}
                  groupKey={t.groupKey}
                  name={t.displayName}
                  figure={figureFor(t.totalSpend)}
                  meta={`${t.category} · ${boughtLabel(t.unitCount, t.purchaseCount)}${
                    showRate ? ` · ${money(t.totalSpend)} in ${monthsTracked} mo` : ' · total so far'
                  }`}
                  trend={trend.direction === 'flat' ? 'flat' : `${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.percent)}%`}
                  tone={trend.direction}
                />
              )
            })}

            {sort === 'price' && priced.map(({ item, trend }) => (
              <ItemRow
                key={item.groupKey}
                groupKey={item.groupKey}
                name={item.displayName}
                figure={figureFor(item.totalSpend)}
                meta={`${item.category} · was ${money(trend.oldest!)}, now ${money(trend.latest!)}`}
                trend={`${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.percent)}%`}
                tone={trend.direction}
              />
            ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
