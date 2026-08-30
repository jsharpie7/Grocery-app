import { useEffect, useRef, useState } from 'react'
import type { PendingLineItem } from '../../hooks/useReceipts'
import { useHouseholdStore } from '../../store/householdStore'
import { selectAllOnFocus } from '../../lib/selectOnFocus'
import { expectedLineTotal, hasMathMismatch, parsePrice, parseQuantity, priceDelta, roundCents } from '../../lib/lineItem'

interface ItemEditSheetProps {
  item: PendingLineItem
  index: number
  /** Item indices in the order they appear on screen, so ‹ › walks the list
   *  the user is actually looking at (all items, or just the flagged ones). */
  order: number[]
  onChange: (index: number, updates: Partial<PendingLineItem>) => void
  onRemove: (index: number) => void
  onNavigate: (index: number) => void
  onClose: () => void
}

type DraftField = 'quantity' | 'unit_price' | 'total_price'

/** Matches a number the user is part-way through typing ("", "1", "1.", "1.24").
 *  Keystrokes that don't match are dropped, which is what a numeric field needs
 *  now that these are text inputs — `type="number"` was silently discarding a
 *  trailing decimal point, so "1." came back as "" and ate the keystroke. */
const PARTIAL_NUMBER = /^\d*\.?\d*$/

const FIELD = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'
const LABEL = 'mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500'

/**
 * Full-width editor for a single line item, opened by tapping its card.
 *
 * Editing one item at a time is what buys the room the inline table never had:
 * every field is full size, the scanned name is visible next to the cleaned-up
 * one, and ‹ › walk the list so a whole receipt can be corrected without
 * closing and reopening anything.
 */
export default function ItemEditSheet({
  item, index, order, onChange, onRemove, onNavigate, onClose,
}: ItemEditSheetProps) {
  const categories = useHouseholdStore((s) => s.categories)
  const nameRef = useRef<HTMLInputElement>(null)

  // Only one field is focused at a time, so a single draft slot is enough. It
  // holds the raw string while typing so half-finished input ("1.", "") isn't
  // parsed to a number and written back under the caret.
  const [draft, setDraft] = useState<{ field: DraftField; value: string } | null>(null)
  useEffect(() => setDraft(null), [index])

  const position = order.indexOf(index)
  const prev = position > 0 ? order[position - 1] : null
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : null

  const expected = expectedLineTotal(item)
  const mismatch = hasMathMismatch(item)
  const delta = priceDelta(item)
  const showsOcrName =
    item.ocr_name && item.ocr_name.trim().toLowerCase() !== item.item_name.trim().toLowerCase()

  // A brand-new row has nothing to read, so open straight into typing its name.
  useEffect(() => {
    if (!item.item_name.trim()) nameRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** The raw string while this field is being typed, otherwise the model value.
   *  Prices settle back to two decimals once you leave the field, so a total
   *  reads "84.70" at rest without fighting the caret at "84.7" mid-edit. */
  function shown(field: DraftField, value: number | null) {
    if (draft?.field === field) return draft.value
    if (value == null) return ''
    return field === 'quantity' ? String(value) : value.toFixed(2)
  }

  function setQuantity(next: number) {
    const quantity = Math.max(0.001, Math.round(next * 1000) / 1000)
    onChange(index, {
      quantity,
      // Keep the line total in step with the quantity, which is the whole point
      // of editing quantity on a receipt; an explicitly-typed total still wins
      // because that edit runs after this one.
      total_price: item.unit_price != null ? roundCents(item.unit_price * quantity) : item.total_price,
    })
  }

  function handleQuantityInput(raw: string) {
    if (!PARTIAL_NUMBER.test(raw)) return
    setDraft({ field: 'quantity', value: raw })
    const parsed = parseQuantity(raw)
    if (parsed != null) setQuantity(parsed)
  }

  function handleUnitPriceInput(raw: string) {
    if (!PARTIAL_NUMBER.test(raw)) return
    setDraft({ field: 'unit_price', value: raw })
    const parsed = parsePrice(raw)
    if (parsed === undefined) return
    onChange(index, {
      unit_price: parsed,
      total_price: parsed != null ? roundCents(parsed * item.quantity) : item.total_price,
    })
  }

  function handleTotalPriceInput(raw: string) {
    if (!PARTIAL_NUMBER.test(raw)) return
    setDraft({ field: 'total_price', value: raw })
    const parsed = parsePrice(raw)
    if (parsed === undefined) return
    onChange(index, { total_price: parsed })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 animate-fade-in bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit item"
        className="relative flex max-h-[88svh] animate-sheet-in flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        <div className="shrink-0 rounded-t-3xl border-b border-gray-100 bg-white">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
          <div className="flex items-center gap-1 px-2 py-2">
            <button
              type="button"
              onClick={() => prev != null && onNavigate(prev)}
              disabled={prev == null}
              aria-label="Previous item"
              className="h-11 w-11 rounded-full text-lg text-gray-500 disabled:opacity-25"
            >
              ‹
            </button>
            <div className="flex-1 text-center text-sm font-medium text-gray-500">
              Item {position + 1} of {order.length}
            </div>
            <button
              type="button"
              onClick={() => next != null && onNavigate(next)}
              disabled={next == null}
              aria-label="Next item"
              className="h-11 w-11 rounded-full text-lg text-gray-500 disabled:opacity-25"
            >
              ›
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-full px-4 text-sm font-semibold text-indigo-600"
            >
              Done
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-4">
          <div>
            <label className={LABEL} htmlFor="item-name">Item name</label>
            <input
              id="item-name"
              ref={nameRef}
              className={`${FIELD} text-base font-medium`}
              value={item.item_name}
              placeholder="e.g. Bananas"
              autoComplete="off"
              enterKeyHint={next != null ? 'next' : 'done'}
              onFocus={selectAllOnFocus}
              onChange={(e) => onChange(index, { item_name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (next != null) onNavigate(next)
                else onClose()
              }}
            />
            {showsOcrName && (
              <p className="mt-1 text-xs text-gray-400">Scanned as “{item.ocr_name}”</p>
            )}
            {item.matchedItemId && (
              <p className="mt-1 text-xs text-indigo-500">🏷 Matched to an item in your catalog</p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={LABEL} htmlFor="item-qty">Quantity</label>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity(Math.max(1, Math.floor(item.quantity) - 1))}
                  className="w-11 shrink-0 rounded-xl border border-gray-300 text-xl text-gray-600 active:bg-gray-100"
                >
                  −
                </button>
                <input
                  id="item-qty"
                  type="text"
                  inputMode="decimal"
                  className={`${FIELD} text-center tabular-nums`}
                  value={shown('quantity', item.quantity)}
                  onFocus={selectAllOnFocus}
                  onBlur={() => setDraft(null)}
                  onChange={(e) => handleQuantityInput(e.target.value)}
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity(Math.floor(item.quantity) + 1)}
                  className="w-11 shrink-0 rounded-xl border border-gray-300 text-xl text-gray-600 active:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>
            <div className="w-20 shrink-0">
              <label className={LABEL} htmlFor="item-unit">Unit</label>
              <input
                id="item-unit"
                className={`${FIELD} text-center`}
                value={item.unit}
                placeholder="ea"
                autoComplete="off"
                onFocus={selectAllOnFocus}
                onChange={(e) => onChange(index, { unit: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="item-unit-price">Unit price ($)</label>
              <input
                id="item-unit-price"
                type="text"
                inputMode="decimal"
                placeholder="—"
                className={`${FIELD} text-right tabular-nums`}
                value={shown('unit_price', item.unit_price)}
                onFocus={selectAllOnFocus}
                onBlur={() => setDraft(null)}
                onChange={(e) => handleUnitPriceInput(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="item-total-price">Line total ($)</label>
              <input
                id="item-total-price"
                type="text"
                inputMode="decimal"
                placeholder="—"
                className={`${FIELD} text-right tabular-nums ${mismatch ? 'border-orange-300 bg-orange-50' : ''}`}
                value={shown('total_price', item.total_price)}
                onFocus={selectAllOnFocus}
                onBlur={() => setDraft(null)}
                onChange={(e) => handleTotalPriceInput(e.target.value)}
              />
            </div>
          </div>

          {mismatch && expected != null && (
            <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
              <span className="flex-1">
                Doesn’t add up — {item.quantity} × ${item.unit_price?.toFixed(2)} is ${expected.toFixed(2)}.
              </span>
              <button
                type="button"
                onClick={() => onChange(index, { total_price: expected })}
                className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Use ${expected.toFixed(2)}
              </button>
            </div>
          )}

          {delta && item.prevAvgPrice != null && (
            <p className="text-xs text-gray-500">
              You usually pay ${item.prevAvgPrice.toFixed(2)} —{' '}
              <span className={delta.up ? 'text-red-500' : 'text-green-600'}>
                {delta.up ? `up ${delta.pct}%` : `down ${delta.pct}%`}
              </span>{' '}
              this time.
            </p>
          )}

          <div>
            <span className={LABEL}>Category</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(index, { category: c })}
                  className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                    item.category === c
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRemove(index)}
            className="w-full rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 active:bg-red-50"
          >
            Remove this item
          </button>
        </div>

        <div className="pb-safe" />
      </div>
    </div>
  )
}
