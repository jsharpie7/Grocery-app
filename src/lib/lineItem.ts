import type { PendingLineItem } from '../hooks/useReceipts'

type PricedItem = Pick<PendingLineItem, 'unit_price' | 'quantity' | 'total_price'>

/** Round to cents the same way everywhere, so a value written by one field and
 *  re-read by another compares equal instead of drifting by float dust. */
export function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

/** What the line total should be, given unit price × quantity. Null when the
 *  scan gave us no unit price, in which case there is nothing to check against. */
export function expectedLineTotal(item: Pick<PendingLineItem, 'unit_price' | 'quantity'>): number | null {
  if (item.unit_price == null) return null
  return roundCents(item.unit_price * item.quantity)
}

/** True when unit × qty disagrees with the line total by more than a cent —
 *  the strongest signal that this is the line the OCR got wrong. */
export function hasMathMismatch(item: PricedItem): boolean {
  const expected = expectedLineTotal(item)
  if (expected == null || item.total_price == null) return false
  // Compared in whole cents on purpose: `Math.abs(0.95 - 0.94) > 0.01` is true
  // in floating point, so the direct comparison flags a line that is exactly
  // one cent of legitimate rounding out (0.69 × 1.37 lb, say).
  return Math.round(Math.abs(item.total_price - expected) * 100) > 1
}

/** Percent move against this item's historical average at the same store, or
 *  null when we have no history (or a zero average, which can't be a baseline). */
export function priceDelta(item: PendingLineItem): { up: boolean; pct: number } | null {
  const avg = item.prevAvgPrice
  if (avg == null || avg <= 0 || item.unit_price == null) return null
  const pct = Math.round(((item.unit_price - avg) / avg) * 100)
  if (pct === 0) return null
  return { up: pct > 0, pct: Math.abs(pct) }
}

/** Quantities are numeric in the DB (1.37 lb of bananas is a real line), so we
 *  accept any positive number and only reject junk. Null means "leave as-is". */
export function parseQuantity(raw: string): number | null {
  const n = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 1000) / 1000
}

/** Empty clears the price back to null (an unknown price, not a $0 one). */
export function parsePrice(raw: string): number | null | undefined {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined // undefined = reject, keep current
  return roundCents(n)
}
