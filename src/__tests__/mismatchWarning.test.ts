import { describe, it, expect } from 'vitest'

// Logic extracted from TotalMismatchWarning
function shouldShowMismatch(itemSum: number, taxAmount: number, totalAmount: number): boolean {
  const diff = Math.abs(itemSum + taxAmount - totalAmount)
  return diff > 0.01
}

describe('mismatchWarning', () => {
  it('no warning when sum + tax equals total exactly', () => {
    expect(shouldShowMismatch(50.00, 4.50, 54.50)).toBe(false)
  })

  it('no warning when diff is exactly 0.01 (boundary)', () => {
    expect(shouldShowMismatch(50.00, 4.50, 54.51)).toBe(false)
  })

  it('shows warning when diff is 0.02', () => {
    expect(shouldShowMismatch(50.00, 4.50, 54.52)).toBe(true)
  })

  it('shows warning when items sum is too high', () => {
    expect(shouldShowMismatch(55.00, 4.50, 54.50)).toBe(true)
  })

  it('no warning with zero tax when sum matches total', () => {
    expect(shouldShowMismatch(42.00, 0, 42.00)).toBe(false)
  })

  it('shows warning when tax is excluded from comparison', () => {
    // If we forget to add tax: 50 + 0 vs 54.50 → diff 4.50 → show warning
    expect(shouldShowMismatch(50.00, 0, 54.50)).toBe(true)
  })

  it('no warning on floating point near-equality', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(shouldShowMismatch(0.1, 0.2, 0.3)).toBe(false)
  })
})
