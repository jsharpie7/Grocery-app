import { describe, it, expect } from 'vitest'
import {
  expectedLineTotal, hasMathMismatch, parsePrice, parseQuantity, priceDelta, roundCents,
} from '../lib/lineItem'
import type { PendingLineItem } from '../hooks/useReceipts'

function item(overrides: Partial<PendingLineItem> = {}): PendingLineItem {
  return {
    item_number: null, ocr_name: null, item_name: 'Bananas', quantity: 1, unit: 'ea',
    unit_price: null, total_price: null, category: 'Produce',
    matchedItemId: null, prevAvgPrice: null, ...overrides,
  }
}

describe('roundCents', () => {
  it('kills float dust so a computed total compares equal to a typed one', () => {
    expect(roundCents(0.1 * 3)).toBe(0.3)
    expect(roundCents(1.2349)).toBe(1.23)
  })
})

describe('expectedLineTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(expectedLineTotal(item({ unit_price: 1.24, quantity: 2 }))).toBe(2.48)
  })

  it('handles fractional (weighed) quantities', () => {
    expect(expectedLineTotal(item({ unit_price: 0.69, quantity: 1.37 }))).toBe(0.95)
  })

  it('is null with no unit price — there is nothing to check against', () => {
    expect(expectedLineTotal(item({ unit_price: null, quantity: 3 }))).toBeNull()
  })
})

describe('hasMathMismatch', () => {
  it('flags a total that disagrees with unit x qty', () => {
    expect(hasMathMismatch(item({ unit_price: 1.24, quantity: 2, total_price: 12.4 }))).toBe(true)
  })

  it('tolerates a one-cent rounding difference', () => {
    expect(hasMathMismatch(item({ unit_price: 0.69, quantity: 1.37, total_price: 0.94 }))).toBe(false)
  })

  it('does not flag a line the scan gave no unit price or no total', () => {
    expect(hasMathMismatch(item({ unit_price: null, total_price: 5 }))).toBe(false)
    expect(hasMathMismatch(item({ unit_price: 5, total_price: null }))).toBe(false)
  })
})

describe('priceDelta', () => {
  it('reports the move against the historical average', () => {
    expect(priceDelta(item({ unit_price: 1.5, prevAvgPrice: 1 }))).toEqual({ up: true, pct: 50 })
    expect(priceDelta(item({ unit_price: 0.8, prevAvgPrice: 1 }))).toEqual({ up: false, pct: 20 })
  })

  it('is null with no usable baseline, or when the price has not moved', () => {
    expect(priceDelta(item({ unit_price: 1.5, prevAvgPrice: null }))).toBeNull()
    expect(priceDelta(item({ unit_price: 1.5, prevAvgPrice: 0 }))).toBeNull()
    expect(priceDelta(item({ unit_price: null, prevAvgPrice: 1 }))).toBeNull()
    expect(priceDelta(item({ unit_price: 1, prevAvgPrice: 1 }))).toBeNull()
  })
})

describe('parseQuantity', () => {
  it('accepts positive decimals', () => {
    expect(parseQuantity('2')).toBe(2)
    expect(parseQuantity('1.37')).toBe(1.37)
  })

  it('returns null for half-typed or invalid input so the model is left alone', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('0')).toBeNull()
    expect(parseQuantity('-1')).toBeNull()
    expect(parseQuantity('abc')).toBeNull()
  })
})

describe('parsePrice', () => {
  it('rounds to cents', () => {
    expect(parsePrice('1.239')).toBe(1.24)
  })

  it('treats an emptied field as an unknown price, not $0', () => {
    expect(parsePrice('')).toBeNull()
  })

  it('rejects junk with undefined so the caller keeps the current value', () => {
    expect(parsePrice('abc')).toBeUndefined()
    expect(parsePrice('-2')).toBeUndefined()
  })
})
