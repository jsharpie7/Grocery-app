import { describe, it, expect } from 'vitest'
import {
  deriveFlag,
  expectedTotal,
  flaggedLabel,
  looksUninterpreted,
  nextFlaggedIndex,
  reconcile,
  type FlaggableItem,
} from '../lib/reviewFlags'

function item(over: Partial<FlaggableItem> = {}): FlaggableItem {
  return {
    item_name: 'Sourdough loaf',
    quantity: 1,
    unit_price: 5.49,
    total_price: 5.49,
    matchedItemId: null,
    ...over,
  }
}

describe('expectedTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(expectedTotal(item({ quantity: 4, unit_price: 0.78 }))).toBe(3.12)
  })

  it('rounds to cents rather than trailing float error', () => {
    // 3 × 0.29 is 0.8699999999999999 in binary floating point.
    expect(expectedTotal(item({ quantity: 3, unit_price: 0.29 }))).toBe(0.87)
  })

  it('is null with no unit price to multiply', () => {
    expect(expectedTotal(item({ unit_price: null }))).toBeNull()
  })
})

describe('looksUninterpreted', () => {
  it('flags register shorthand', () => {
    expect(looksUninterpreted('SPRK WTR 12PK')).toBe(true)
  })

  it('accepts a name carrying lower case', () => {
    expect(looksUninterpreted('Sparkling water, 12pk')).toBe(false)
  })

  it('accepts a name that is only partly shouty', () => {
    expect(looksUninterpreted('KIND bar')).toBe(false)
  })

  it('flags an empty or blank name', () => {
    expect(looksUninterpreted('')).toBe(true)
    expect(looksUninterpreted('   ')).toBe(true)
  })

  it('flags a name with no letters at all', () => {
    expect(looksUninterpreted('12345')).toBe(true)
  })
})

describe('deriveFlag', () => {
  it('leaves a clean, interpreted row unflagged', () => {
    expect(deriveFlag(item())).toBeNull()
  })

  it('flags price when quantity times unit does not reach the total', () => {
    expect(deriveFlag(item({ quantity: 1, unit_price: 9.47, total_price: 12.1 }))).toBe('price')
  })

  it('tolerates a one cent rounding gap', () => {
    expect(deriveFlag(item({ quantity: 3, unit_price: 1.0, total_price: 3.01 }))).toBeNull()
  })

  it('flags price when there is no total at all', () => {
    expect(deriveFlag(item({ total_price: null }))).toBe('price')
  })

  it('does not flag a missing unit price on its own', () => {
    // Nothing to multiply is not a disagreement — a hand-entered total stands.
    expect(deriveFlag(item({ unit_price: null, total_price: 5.49 }))).toBeNull()
  })

  it('flags name when the row is still register shorthand', () => {
    expect(deriveFlag(item({ item_name: 'SPRK WTR 12PK' }))).toBe('name')
  })

  it('does not flag a shouty name that matched the catalog', () => {
    expect(deriveFlag(item({ item_name: 'SPRK WTR 12PK', matchedItemId: 'item-1' }))).toBeNull()
  })

  it('prefers the price flag when a row is wrong in both ways', () => {
    // Money first: a wrong number is wrong money, a wrong name is only untidy.
    expect(deriveFlag(item({ item_name: 'CHKN THGH FAM', total_price: 12.1 }))).toBe('price')
  })
})

describe('reconcile', () => {
  it('balances when items plus tax equal the receipt total', () => {
    expect(reconcile([50], 4.5, 54.5)).toEqual({ itemSum: 50, balanced: true, delta: 0 })
  })

  it('treats a one cent gap as balanced', () => {
    expect(reconcile([50], 4.5, 54.51).balanced).toBe(true)
  })

  it('reports two cents as off', () => {
    const { balanced, delta } = reconcile([50], 4.5, 54.52)
    expect(balanced).toBe(false)
    expect(delta).toBeCloseTo(0.02, 10)
  })

  it('reports the gap unsigned when the items overshoot', () => {
    const { balanced, delta } = reconcile([55], 4.5, 54.5)
    expect(balanced).toBe(false)
    expect(delta).toBeCloseTo(5, 10)
  })

  it('survives floating point near-equality', () => {
    // 0.1 + 0.2 is 0.30000000000000004.
    expect(reconcile([0.1], 0.2, 0.3).balanced).toBe(true)
  })

  it('counts a null line total as nothing rather than skipping the row', () => {
    expect(reconcile([10, null, 5], 0, 15).balanced).toBe(true)
  })

  it('withholds a verdict until a receipt total is entered', () => {
    expect(reconcile([10, 5], 1, null)).toEqual({ itemSum: 15, balanced: null, delta: null })
    expect(reconcile([10, 5], 1, 0).balanced).toBeNull()
  })
})

describe('nextFlaggedIndex', () => {
  it('finds the next flagged row after the current one', () => {
    expect(nextFlaggedIndex([null, 'price', null, 'name'], 1)).toBe(3)
  })

  it('skips the current row even when it is itself flagged', () => {
    expect(nextFlaggedIndex(['price', null, null], 0)).toBeNull()
  })

  it('returns null when nothing after the current row is flagged', () => {
    expect(nextFlaggedIndex(['price', null, null], 1)).toBeNull()
  })

  it('finds the first flagged row when starting before the list', () => {
    expect(nextFlaggedIndex([null, 'price'], -1)).toBe(1)
  })
})

describe('flaggedLabel', () => {
  it('says all clear with nothing flagged', () => {
    expect(flaggedLabel(0, true)).toBe('all clear')
  })

  it('uses the singular for one row', () => {
    expect(flaggedLabel(1, true)).toBe('1 needs a look')
  })

  it('uses the plural beyond one', () => {
    expect(flaggedLabel(3, true)).toBe('3 need a look')
  })

  it('says so when flagging is switched off, whatever the count', () => {
    expect(flaggedLabel(4, false)).toBe('flagging off')
  })
})
