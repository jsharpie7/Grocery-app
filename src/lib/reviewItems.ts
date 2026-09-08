import { deriveFlag, type ReviewFlag } from './reviewFlags'
import type { PendingLineItem } from '../hooks/useReceipts'

/**
 * A line item while it is being corrected on the review screen.
 *
 * The three money/count fields are held as **strings**, not numbers. A number
 * cannot represent "4." or "" — the states a field passes through while
 * someone is typing into it — so coercing on every keystroke either fights the
 * caret or silently rewrites what was typed. They convert once, on save.
 *
 * `flag` is stored rather than derived per render. It is a record of what the
 * scan was unsure about, and the design has it clear when the matching field is
 * edited and never come back on its own; recomputing it while someone types
 * would make it flicker back the moment a half-typed number stopped balancing.
 */
export interface ReviewItem {
  /** Stable across delete and reorder, so React keys and input ids never
   *  re-target a different row mid-edit. */
  id: string
  name: string
  /** What the register printed. Null for a row added by hand. */
  ocr: string | null
  qty: string
  /** Price per unit, as typed. Distinct from `measure`, the unit of sale. */
  unitPrice: string
  total: string
  cat: string
  flag: ReviewFlag
  /** Carried through to the save untouched — not editable on this screen. */
  item_number: string | null
  matchedItemId: string | null
  measure: string
}

let nextId = 0
const makeId = () => `review-${nextId++}`

/** Money as typed back out: 2dp, or empty when there is nothing to show. */
function moneyString(value: number | null): string {
  return value == null ? '' : value.toFixed(2)
}

export function toReviewItems(items: PendingLineItem[]): ReviewItem[] {
  return items.map((it) => ({
    id: makeId(),
    name: it.item_name,
    ocr: it.ocr_name,
    qty: String(it.quantity),
    unitPrice: moneyString(it.unit_price),
    total: moneyString(it.total_price),
    cat: it.category,
    flag: deriveFlag(it),
    item_number: it.item_number,
    matchedItemId: it.matchedItemId ?? null,
    measure: it.unit,
  }))
}

export function emptyReviewItem(defaultCategory: string): ReviewItem {
  return {
    id: makeId(),
    name: '',
    ocr: null,
    qty: '1',
    unitPrice: '',
    total: '',
    cat: defaultCategory,
    // Added by hand, so there is no scan to be unsure about.
    flag: null,
    item_number: null,
    matchedItemId: null,
    measure: 'ea',
  }
}

/** Parse a typed field. Blank and half-typed values become null, not zero. */
export function parseField(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function toPendingItems(items: ReviewItem[]): PendingLineItem[] {
  return items.map((it) => ({
    item_number: it.item_number,
    ocr_name: it.ocr,
    item_name: it.name.trim(),
    quantity: parseField(it.qty) ?? 1,
    unit: it.measure,
    unit_price: parseField(it.unitPrice),
    total_price: parseField(it.total),
    category: it.cat,
    matchedItemId: it.matchedItemId,
    prevAvgPrice: null,
  }))
}

/**
 * Total implied by the other two fields.
 *
 * Returns null when either operand is blank, and the caller then leaves the
 * total alone. Zeroing a correct total the moment someone clears the unit
 * price to retype it would destroy the number this screen exists to get right.
 */
function impliedTotal(qty: string, unitPrice: string): string | null {
  const q = parseField(qty)
  const u = parseField(unitPrice)
  if (q == null || u == null) return null
  return (Math.round(u * q * 100) / 100).toFixed(2)
}

export function editName(item: ReviewItem, name: string): ReviewItem {
  return { ...item, name, flag: item.flag === 'name' ? null : item.flag }
}

export function editQty(item: ReviewItem, qty: string): ReviewItem {
  return { ...item, qty, total: impliedTotal(qty, item.unitPrice) ?? item.total }
}

export function editUnitPrice(item: ReviewItem, unitPrice: string): ReviewItem {
  return {
    ...item,
    unitPrice,
    total: impliedTotal(item.qty, unitPrice) ?? item.total,
    flag: item.flag === 'price' ? null : item.flag,
  }
}

/**
 * A hand-entered total is the authority: it overrides the arithmetic and
 * deliberately does not back-solve the unit price.
 */
export function editTotal(item: ReviewItem, total: string): ReviewItem {
  return { ...item, total, flag: item.flag === 'price' ? null : item.flag }
}

export function editCategory(item: ReviewItem, cat: string): ReviewItem {
  return { ...item, cat }
}
