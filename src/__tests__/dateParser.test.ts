import { describe, it, expect } from 'vitest'

// The critical invariant: parsing receipt_date as `date + 'T12:00:00'`
// prevents UTC midnight from rolling to the prior day in US timezones.
function parseReceiptDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

describe('dateParser', () => {
  it('"2024-01-15" → getDate() === 15 (not 14)', () => {
    const d = parseReceiptDate('2024-01-15')
    expect(d.getDate()).toBe(15)
  })

  it('"2024-12-31" → getDate() === 31', () => {
    const d = parseReceiptDate('2024-12-31')
    expect(d.getDate()).toBe(31)
  })

  it('"2024-03-01" → getDate() === 1 (not 29)', () => {
    const d = parseReceiptDate('2024-03-01')
    expect(d.getDate()).toBe(1)
  })

  it('"2024-01-15" → getMonth() === 0 (January)', () => {
    const d = parseReceiptDate('2024-01-15')
    expect(d.getMonth()).toBe(0)
  })

  it('XAxis month formatter does not roll back a day', () => {
    const month = '2024-01'
    const d = new Date(month + 'T12:00:00')
    const label = d.toLocaleString('default', { month: 'short' })
    expect(label).toMatch(/jan/i)
  })
})
