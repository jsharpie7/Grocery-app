/**
 * Derived figures for the Items tab.
 *
 * Both segments reorder the same items *and* change what the two right-hand
 * values mean, so each one's numbers are computed here rather than in the
 * markup: the row renders whatever it is handed.
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

