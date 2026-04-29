import { describe, it, expect } from 'vitest'
import { normalizeStoreName } from '../lib/itemMatcher'

describe('normalizeStoreName', () => {
  it('strips trailing store number with #', () => {
    expect(normalizeStoreName('Walmart #1234')).toBe('walmart')
  })

  it('strips # number in the middle', () => {
    expect(normalizeStoreName('Target #42 Store')).toBe('target store')
  })

  it('lowercases', () => {
    expect(normalizeStoreName('COSTCO')).toBe('costco')
  })

  it('trims whitespace', () => {
    expect(normalizeStoreName('  Safeway  ')).toBe('safeway')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeStoreName('Whole  Foods')).toBe('whole foods')
  })

  it('handles store with no number', () => {
    expect(normalizeStoreName('Trader Joe\'s')).toBe('trader joe\'s')
  })
})
