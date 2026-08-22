import { describe, it, expect } from 'vitest'
import { computeMtdComparison } from '../hooks/useInsights'
import type { MonthlySpend } from '../lib/supabase'

// get_monthly_spend returns rows sorted ascending by month, and only for months
// that actually have receipts (no zero-filling).
function months(...rows: [string, number][]): MonthlySpend[] {
  return rows.map(([month, total]) => ({ month, total }))
}

const JUNE_15 = new Date('2026-06-15T12:00:00')

describe('computeMtdComparison', () => {
  it('averages only complete prior months, excluding current and oldest', () => {
    // Oldest (2026-01) is dropped as structurally partial, current (2026-06) is
    // dropped as in-progress. Average is over Feb/Mar/Apr/May only.
    const data = months(
      ['2026-01', 999], // oldest — partial, must not skew the average
      ['2026-02', 100],
      ['2026-03', 200],
      ['2026-04', 300],
      ['2026-05', 400],
      ['2026-06', 42],  // current month so far
    )
    const { currentTotal, typicalMonth } = computeMtdComparison(data, JUNE_15)

    expect(currentTotal).toBe(42)
    expect(typicalMonth).toBe(250) // (100+200+300+400)/4
  })

  // REGRESSION: the previous implementation used monthlyData.slice(0, -1),
  // assuming the last row was always the current month. In any month with no
  // receipts yet that assumption drops the most recent *complete* month instead.
  it('excludes the oldest month even when the current month has no receipts yet', () => {
    const data = months(
      ['2026-01', 999], // oldest — partial
      ['2026-02', 100],
      ['2026-03', 200],
      // no 2026-06 row at all: nothing bought yet this month
    )
    const { currentTotal, typicalMonth } = computeMtdComparison(data, JUNE_15)

    expect(currentTotal).toBe(0)
    expect(typicalMonth).toBe(150) // (100+200)/2 — May-equivalent rows both kept
  })

  it('returns null typicalMonth when no complete prior months remain', () => {
    // Only the structurally-partial oldest month plus the current month.
    const data = months(['2026-01', 999], ['2026-06', 42])
    expect(computeMtdComparison(data, JUNE_15).typicalMonth).toBeNull()
  })

  it('returns null typicalMonth for a brand-new household with no data', () => {
    const { currentTotal, typicalMonth } = computeMtdComparison([], JUNE_15)
    expect(currentTotal).toBe(0)
    expect(typicalMonth).toBeNull()
  })

  it('returns null typicalMonth when the only row is the current month', () => {
    const { currentTotal, typicalMonth } = computeMtdComparison(months(['2026-06', 42]), JUNE_15)
    expect(currentTotal).toBe(42)
    expect(typicalMonth).toBeNull()
  })

  it('coerces string totals from the RPC (numeric comes back as text)', () => {
    // supabase-js returns Postgres numeric as a string; Number() coercion in the
    // implementation is what keeps this from becoming string concatenation.
    const data = [
      { month: '2026-01', total: '999' },
      { month: '2026-02', total: '100' },
      { month: '2026-03', total: '200' },
      { month: '2026-06', total: '42' },
    ] as unknown as MonthlySpend[]
    const { currentTotal, typicalMonth } = computeMtdComparison(data, JUNE_15)

    expect(currentTotal).toBe(42)
    expect(typicalMonth).toBe(150)
  })

  it('pads single-digit months when matching the current month key', () => {
    // '2026-6' would not match, so the padStart in the implementation matters.
    const data = months(['2025-12', 999], ['2026-01', 100], ['2026-06', 7])
    expect(computeMtdComparison(data, JUNE_15).currentTotal).toBe(7)
  })
})
