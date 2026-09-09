import { describe, it, expect } from 'vitest'
import { monthsCovered, priceTrend } from '../lib/itemTrends'

describe('priceTrend', () => {
  it('reports a rise from the oldest price to the newest', () => {
    // Newest first: $9.47 now, $8.35 then.
    const t = priceTrend([9.47, 8.9, 8.35])
    expect(t.direction).toBe('up')
    expect(t.percent).toBe(13)
    expect(t.latest).toBe(9.47)
    expect(t.oldest).toBe(8.35)
  })

  it('reports a fall', () => {
    const t = priceTrend([9.65, 10.05])
    expect(t.direction).toBe('down')
    expect(t.percent).toBe(-4)
  })

  it('calls a change that rounds to zero flat', () => {
    expect(priceTrend([10.02, 10.0]).direction).toBe('flat')
  })

  it('is flat with a single observation', () => {
    const t = priceTrend([4.29])
    expect(t.direction).toBe('flat')
    expect(t.latest).toBe(4.29)
  })

  it('is flat with no observations', () => {
    expect(priceTrend([])).toEqual({ direction: 'flat', percent: 0, latest: null, oldest: null })
  })

  it('ignores zero and negative prices rather than dividing by them', () => {
    const t = priceTrend([5, 0, -1, 4])
    expect(t.oldest).toBe(4)
    expect(t.direction).toBe('up')
  })
})


describe('monthsCovered', () => {
  const sep2026 = new Date(2026, 8, 9) // 9 September 2026

  it('counts a single month of history as one', () => {
    expect(monthsCovered('2026-09', sep2026)).toBe(1)
  })

  it('counts inclusively across months', () => {
    expect(monthsCovered('2026-06', sep2026)).toBe(4)
  })

  it('counts across a year boundary', () => {
    expect(monthsCovered('2025-11', sep2026)).toBe(11)
  })

  it('never returns less than one, even for a future month', () => {
    expect(monthsCovered('2027-01', sep2026)).toBe(1)
  })

  it('falls back to one on an unparseable key', () => {
    expect(monthsCovered('nonsense', sep2026)).toBe(1)
  })

  it('divides spend by real history, not by the query window', () => {
    // The bug this exists to prevent: $84.12 over three months of tracking is
    // $28.04/mo, not the $7.01/mo that dividing by a 12-month window reports.
    const months = monthsCovered('2026-07', sep2026)
    expect(months).toBe(3)
    expect(84.12 / months).toBeCloseTo(28.04, 2)
  })
})
