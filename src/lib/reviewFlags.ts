/**
 * Which scanned rows need a human look, and whether the receipt reconciles.
 *
 * The design asks for rows marked "Low confidence · price" / "Low confidence ·
 * name". Gemini returns no confidence score — `ExtractedLineItem` has no such
 * field, and the design prototype hard-coded its flags — so confidence here is
 * inferred from the extraction itself. Two signals, both of which mean "the
 * scan produced something a person still has to settle":
 *
 *   price — the arithmetic does not close, or there is no price at all.
 *   name  — the name is still the register's own shorthand, uninterpreted.
 *
 * Price is checked first: a wrong number is wrong money, a wrong name is only
 * untidy.
 */

export type ReviewFlag = 'price' | 'name' | null

export interface FlaggableItem {
  item_name: string
  quantity: number
  unit_price: number | null
  total_price: number | null
  /** Set when the OCR name resolved to an item already in the catalog. */
  matchedItemId?: string | null
}

/** Cents of slack before two money figures count as disagreeing. */
const EPSILON = 0.01

/**
 * `quantity × unit_price`, rounded the way money is.
 *
 * Returns null when there is no unit price to multiply, which is not a
 * disagreement — just nothing to check.
 */
export function expectedTotal(item: FlaggableItem): number | null {
  if (item.unit_price == null) return null
  return Math.round(item.unit_price * item.quantity * 100) / 100
}

/**
 * True when a name still reads as register shorthand.
 *
 * Anything a person or the catalog has interpreted carries lower-case letters
 * ("Sparkling water, 12pk"); what the register printed does not ("SPRK WTR
 * 12PK"). An empty name counts, since a blank row plainly needs filling.
 *
 * Deliberately loose: it is a prompt for attention, not a verdict, and the
 * cost of a false positive is one extra glance.
 */
export function looksUninterpreted(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true
  return !/[a-z]/.test(trimmed)
}

export function deriveFlag(item: FlaggableItem): ReviewFlag {
  if (item.total_price == null) return 'price'

  const expected = expectedTotal(item)
  if (expected != null && Math.abs(item.total_price - expected) > EPSILON) {
    return 'price'
  }

  // A name that matched the catalog has been interpreted by definition, even
  // if the matched name itself is shouty.
  if (!item.matchedItemId && looksUninterpreted(item.item_name)) return 'name'

  return null
}

export interface Reconciliation {
  /** Sum of the line totals, before tax. */
  itemSum: number
  /** Null when no receipt total has been entered yet — nothing to check against. */
  balanced: boolean | null
  /** Absolute distance from the receipt total. Null for the same reason. */
  delta: number | null
}

/**
 * Does `items + tax` come to what the receipt says?
 *
 * Recomputed on every keystroke in the review screen, so it takes the numbers
 * rather than reading them, and stays pure.
 */
export function reconcile(
  itemTotals: (number | null)[],
  taxAmount: number,
  receiptTotal: number | null,
): Reconciliation {
  const itemSum = itemTotals.reduce<number>((sum, t) => sum + (t ?? 0), 0)

  if (receiptTotal == null || receiptTotal <= 0) {
    return { itemSum, balanced: null, delta: null }
  }

  const delta = itemSum + taxAmount - receiptTotal
  return { itemSum, balanced: Math.abs(delta) <= EPSILON, delta: Math.abs(delta) }
}

/**
 * The next flagged row strictly after `from`, or null when none remain.
 *
 * Strictly after, so the row you are already editing is never offered as the
 * next one — that is what makes "Next flagged" advance rather than stick.
 */
export function nextFlaggedIndex(flags: ReviewFlag[], from: number): number | null {
  for (let i = from + 1; i < flags.length; i++) {
    if (flags[i]) return i
  }
  return null
}

/** "all clear" / "1 needs a look" / "3 need a look" — note the singular. */
export function flaggedLabel(flaggedCount: number, flaggingOn: boolean): string {
  if (!flaggingOn) return 'flagging off'
  if (flaggedCount === 0) return 'all clear'
  if (flaggedCount === 1) return '1 needs a look'
  return `${flaggedCount} need a look`
}
