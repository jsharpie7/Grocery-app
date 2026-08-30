import type { PendingLineItem } from '../../hooks/useReceipts'
import { expectedLineTotal, hasMathMismatch, priceDelta } from '../../lib/lineItem'

interface ItemCardProps {
  item: PendingLineItem
  index: number
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}

function money(n: number | null) {
  return n == null ? '—' : `$${n.toFixed(2)}`
}

/** Quantities are numeric, so 2 renders as "2" and 1.37 renders as "1.37". */
function qty(n: number) {
  return String(Math.round(n * 1000) / 1000)
}

/**
 * One line item, collapsed to a single readable row: name and line total on top,
 * the arithmetic behind it underneath. Everything editable lives behind a tap,
 * which is what lets the whole list fit the phone's width instead of scrolling
 * sideways past a row of cramped inputs.
 */
export default function ItemCard({ item, index, onEdit, onRemove }: ItemCardProps) {
  const flagged = hasMathMismatch(item)
  const untitled = !item.item_name.trim()
  const delta = priceDelta(item)
  const name = item.item_name.trim() || 'Untitled item'

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border ${
        flagged
          ? 'border-orange-300 bg-orange-50'
          : untitled
            ? 'border-amber-300 bg-amber-50'
            : 'border-gray-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => onEdit(index)}
        className="min-w-0 flex-1 px-3 py-2.5 text-left active:bg-black/5"
      >
        <div className="flex items-baseline gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-[15px] font-medium ${
              untitled ? 'italic text-amber-700' : 'text-gray-900'
            }`}
          >
            {name}
          </span>
          {item.matchedItemId && (
            <span title="In your catalog" className="shrink-0 text-xs text-indigo-400">🏷</span>
          )}
          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-gray-900">
            {money(item.total_price)}
          </span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
          <span className="tabular-nums">
            {qty(item.quantity)} {item.unit}
            {item.unit_price != null && ` × ${money(item.unit_price)}`}
          </span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{item.category}</span>
          {delta && (
            <span className={delta.up ? 'text-red-500' : 'text-green-600'}>
              {delta.up ? '↑' : '↓'}{delta.pct}% vs avg
            </span>
          )}
        </div>

        {flagged && (
          <div className="mt-1 text-xs font-medium text-orange-700">
            ⚠ {qty(item.quantity)} × {money(item.unit_price)} = {money(expectedLineTotal(item))} — tap to fix
          </div>
        )}
        {untitled && !flagged && (
          <div className="mt-1 text-xs font-medium text-amber-700">
            Needs a name — tap to add, or it won't be saved
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label={`Remove ${name}`}
        className="flex shrink-0 items-center px-3 text-xl leading-none text-gray-300 active:bg-black/5 hover:text-red-500"
      >
        ×
      </button>
    </div>
  )
}
