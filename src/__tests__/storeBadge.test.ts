import { describe, it, expect } from 'vitest'
import { storeInitials, badgeTextColor } from '../lib/storeBadge'

describe('storeInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(storeInitials('Whole Foods')).toBe('WF')
    expect(storeInitials('Trader Joes Market')).toBe('TJ')
  })

  it('takes the first two characters of a single-word name', () => {
    expect(storeInitials('Costco')).toBe('CO')
    expect(storeInitials('Aldi')).toBe('AL')
  })

  it('falls back to "?" for an empty or whitespace-only name', () => {
    expect(storeInitials('')).toBe('?')
    expect(storeInitials('   ')).toBe('?')
  })

  it('keeps emoji intact instead of splitting a surrogate pair', () => {
    // '🛒'[0] would be half a surrogate pair and render as a replacement char.
    expect(storeInitials('🛒')).toBe('🛒')
    expect(storeInitials('🛒 Corner Store')).toBe('🛒C')
  })

  it('collapses extra whitespace between words', () => {
    expect(storeInitials('  Whole   Foods  ')).toBe('WF')
  })

  it('handles a single character name', () => {
    expect(storeInitials('H')).toBe('H')
  })
})

describe('badgeTextColor', () => {
  it('uses black text on light backgrounds', () => {
    expect(badgeTextColor('#ffffff')).toBe('#000000')
  })

  it('uses white text on dark backgrounds', () => {
    expect(badgeTextColor('#000000')).toBe('#ffffff')
    expect(badgeTextColor('#64748b')).toBe('#ffffff') // slate, the palette's darkest
  })

  it('picks black on mid-bright colours where white would fail contrast', () => {
    // A naive luminance>0.5 split hands these to white text. Amber scores only
    // 2.2:1 against white (fails WCAG AA) but 9.8:1 against black.
    expect(badgeTextColor('#f59e0b')).toBe('#000000') // amber
    expect(badgeTextColor('#10b981')).toBe('#000000') // emerald
    expect(badgeTextColor('#f97316')).toBe('#000000') // orange
  })

  it('accepts shorthand hex and a missing leading hash', () => {
    expect(badgeTextColor('#fff')).toBe('#000000')
    expect(badgeTextColor('000')).toBe('#ffffff')
    expect(badgeTextColor('ffffff')).toBe('#000000')
  })

  it('falls back to white on an unparseable colour', () => {
    expect(badgeTextColor('')).toBe('#ffffff')
    expect(badgeTextColor('not-a-color')).toBe('#ffffff')
  })

  it('weights green over blue, per relative luminance', () => {
    // Pure green is perceptually bright enough for black text; pure blue is not,
    // even though both are a single fully-saturated channel.
    expect(badgeTextColor('#00ff00')).toBe('#000000')
    expect(badgeTextColor('#0000ff')).toBe('#ffffff')
  })
})
