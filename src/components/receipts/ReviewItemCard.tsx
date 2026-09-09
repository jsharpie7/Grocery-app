import { useHouseholdStore } from '../../store/householdStore'
import type { ReviewFlag } from '../../lib/reviewFlags'
import type { ReviewItem } from '../../lib/reviewItems'

interface ReviewItemCardProps {
  item: ReviewItem
  /** Null while flagging is switched off in Settings. */
  flag: ReviewFlag
  expanded: boolean
  onToggle: () => void
  onName: (value: string) => void
  onQty: (value: string) => void
  onUnitPrice: (value: string) => void
  onTotal: (value: string) => void
  onCategory: (value: string) => void
  onRemove: () => void
  onNext: () => void
  /** False once no flagged row remains after this one. */
  hasNextFlagged: boolean
}

function money(value: string): string {
  const n = Number(value.trim())
  return value.trim() && Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00'
}

const FLAG_LABEL: Record<Exclude<ReviewFlag, null>, string> = {
  price: 'Low confidence · price',
  name: 'Low confidence · name',
}

/**
 * One scanned line item: a row you tap, which opens into its own editor.
 *
 * This replaces a 620px-wide table that could not fit a 393px phone. Every
 * field here is stacked or shares a row at ratios that fit the narrowest
 * screen the app targets, so the review body scrolls vertically and only
 * vertically.
 *
 * The 3px left edge is drawn on every row, transparent when unflagged, so a
 * flagged row does not shift its text sideways relative to its neighbours.
 */
export default function ReviewItemCard({
  item,
  flag,
  expanded,
  onToggle,
  onName,
  onQty,
  onUnitPrice,
  onTotal,
  onCategory,
  onRemove,
  onNext,
  hasNextFlagged,
}: ReviewItemCardProps) {
  const categories = useHouseholdStore((s) => s.categories)

  return (
    <div
      className={`border-l-[3px] border-t border-t-hairline first:border-t-0 ${
        flag ? 'border-l-warn bg-warn-bg' : 'border-l-transparent bg-surface'
      }`}
    >
      {expanded ? (
        <div className="px-4 py-3.5">
          <div className="mb-3 flex items-center justify-between">
            <span className={`text-flag uppercase ${flag ? 'text-warn-ink' : 'text-ink-2'}`}>
              {flag ? FLAG_LABEL[flag] : 'Editing'}
            </span>
            <button onClick={onToggle} className="text-meta text-ink-2">
              Close
            </button>
          </div>

          <label className="mb-1.5 block text-label text-ink-2" htmlFor={`name-${item.id}`}>
            Name
          </label>
          <input
            id={`name-${item.id}`}
            value={item.name}
            onChange={(e) => onName(e.target.value)}
            className="w-full rounded-input border border-border bg-surface px-3 py-3 text-field text-ink"
          />
          {/* What the register actually printed, so a rename can be checked
              against the paper rather than against memory. */}
          <p className="mt-2 text-label leading-normal text-ink-2">
            {item.ocr ? `On receipt: “${item.ocr}”` : 'Added by hand'}
          </p>

          {/* 1 : 1.4 : 1.4 is what lets three number fields share a 393px
              screen without a horizontal scroll. */}
          <div className="mt-3 flex gap-2.5">
            <div className="flex-1">
              <label className="mb-1.5 block text-label text-ink-2" htmlFor={`qty-${item.id}`}>
                Qty
              </label>
              <input
                id={`qty-${item.id}`}
                inputMode="decimal"
                value={item.qty}
                onChange={(e) => onQty(e.target.value)}
                className="w-full rounded-input border border-border bg-surface px-1.5 py-3 text-center text-field tabular-nums text-ink"
              />
            </div>
            <div className="flex-[1.4]">
              <label className="mb-1.5 block text-label text-ink-2" htmlFor={`unit-${item.id}`}>
                Unit
              </label>
              <input
                id={`unit-${item.id}`}
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(e) => onUnitPrice(e.target.value)}
                className="w-full rounded-input border border-border bg-surface px-3 py-3 text-right text-field tabular-nums text-ink"
              />
            </div>
            <div className="flex-[1.4]">
              <label className="mb-1.5 block text-label text-ink-2" htmlFor={`total-${item.id}`}>
                Total
              </label>
              {/* Two-pixel accent border: this is the field that decides the
                  math, and the one the reconciliation line answers to. */}
              <input
                id={`total-${item.id}`}
                inputMode="decimal"
                value={item.total}
                onChange={(e) => onTotal(e.target.value)}
                className="w-full rounded-input border-2 border-accent bg-surface px-[11px] py-[11px] text-right text-field font-medium tabular-nums text-ink"
              />
            </div>
          </div>

          <p className="mb-1.5 mt-3 text-label text-ink-2">Category</p>
          {/* Every category visible at once. The dropdown this replaces cost a
              tap and hid the choices behind it. */}
          <div className="flex flex-wrap gap-[7px]">
            {categories.map((c) => {
              const selected = item.cat === c
              return (
                <button
                  key={c}
                  onClick={() => onCategory(c)}
                  aria-pressed={selected}
                  className={`rounded-chip border px-[13px] py-[7px] text-chip-label ${
                    selected
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-ink'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={onRemove} className="text-[14px] leading-none text-danger">
              Delete item
            </button>
            <button onClick={onNext} className="text-[14px] font-semibold leading-none text-accent">
              {hasNextFlagged ? 'Next flagged →' : 'Done →'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-row">{item.name || 'Untitled item'}</span>
            <span className="mt-[3px] block text-[12px] leading-tight text-ink-2">
              {item.cat || 'Uncategorized'} · {item.qty || '0'} @ {money(item.unitPrice)}
            </span>
          </span>
          <span className="text-amount tabular-nums">{money(item.total)}</span>
          <span aria-hidden className="text-nav text-ink-4">
            ›
          </span>
        </button>
      )}
    </div>
  )
}
