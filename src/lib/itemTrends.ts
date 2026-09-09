/**
 * Derived figures for the Items tab.
 *
 * The three segments reorder the same items *and* change what the two
 * right-hand values mean, so each one's numbers are computed here rather than
 * in the markup: the row renders whatever it is handed.
 */

export interface PriceTrend {
  direction: 'up' | 'down' | 'flat'
  /** Whole-percent change from the oldest observed price to the newest. */
  percent: number
  latest: number | null
  oldest: number | null
}

/**
 * Change across a price history, newest first.
 *
 * Compares the newest observation with the oldest in the window rather than
 * with the mean: "was $x, now $y" is the claim the row makes, and a mean is
 * neither of those numbers. A change that rounds to zero percent is flat —
 * "↑ 0%" says nothing worth a colour.
 */
export function priceTrend(recentPrices: number[]): PriceTrend {
  const prices = recentPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (prices.length < 2) {
    return { direction: 'flat', percent: 0, latest: prices[0] ?? null, oldest: prices[0] ?? null }
  }

  const latest = prices[0]
  const oldest = prices[prices.length - 1]
  const percent = Math.round(((latest - oldest) / oldest) * 100)

  return {
    direction: percent === 0 ? 'flat' : percent > 0 ? 'up' : 'down',
    percent,
    latest,
    oldest,
  }
}

export interface StorePrice {
  storeName: string
  unitPrice: number
}

export interface StoreComparison {
  cheapestStore: string
  cheapestPrice: number
  dearestStore: string
  dearestPrice: number
  /** Whole percent saved by buying at the cheapest rather than the dearest. */
  savingPercent: number
}

/**
 * Cheapest and dearest store for one item.
 *
 * Null unless the item has been seen at two or more stores at different
 * prices — with one store there is no comparison to draw, and with identical
 * prices there is no saving to claim.
 */
export function compareStores(prices: StorePrice[]): StoreComparison | null {
  const byStore = new Map<string, number>()
  for (const { storeName, unitPrice } of prices) {
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue
    const seen = byStore.get(storeName)
    // The best price a store has offered is the one worth comparing.
    if (seen == null || unitPrice < seen) byStore.set(storeName, unitPrice)
  }
  if (byStore.size < 2) return null

  const sorted = Array.from(byStore.entries()).sort((a, b) => a[1] - b[1])
  const [cheapestStore, cheapestPrice] = sorted[0]
  const [dearestStore, dearestPrice] = sorted[sorted.length - 1]

  const savingPercent = Math.round(((dearestPrice - cheapestPrice) / dearestPrice) * 100)
  if (savingPercent <= 0) return null

  return { cheapestStore, cheapestPrice, dearestStore, dearestPrice, savingPercent }
}
