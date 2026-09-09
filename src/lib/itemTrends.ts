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

/**
 * How many calendar months of history the household actually has, inclusive.
 *
 * `earliestMonthKey` is a `YYYY-MM` key — the oldest month with a receipt.
 * September to September is 1, June to September is 4.
 *
 * This is the honest denominator for a per-month figure. Dividing a year's
 * worth of spend by 12 when only three months have been tracked reports a
 * quarter of the real monthly cost, which is worse than showing nothing: the
 * number looks precise and is wrong in the reassuring direction.
 *
 * Household span rather than per-item span is deliberate. A month in which you
 * bought no chicken is still a real $0 chicken month, and should pull the
 * average down; measuring from each item's own first purchase would report a
 * once-bought item as if it were a monthly habit.
 */
export function monthsCovered(earliestMonthKey: string, today: Date): number {
  const [year, month] = earliestMonthKey.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 1

  const span =
    (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month) + 1

  return Math.max(1, span)
}

/**
 * Below this, a "per month" figure is being extrapolated from too little to
 * mean anything, and the screen shows plain totals instead.
 */
export const MIN_MONTHS_FOR_RATE = 2
