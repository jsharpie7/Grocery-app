import { describe, it, expect } from 'vitest'
import { priceTrend } from '../lib/itemTrends'

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

