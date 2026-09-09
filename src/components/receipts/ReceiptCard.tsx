import { useNavigate } from 'react-router-dom'
import StoreBadge from '../ui/StoreBadge'
import { shortDate } from '../../lib/dates'
import type { Receipt } from '../../lib/supabase'

interface ReceiptCardProps {
  receipt: Receipt
  /** Receipts list rows disclose; dashboard rows don't. */
  showChevron?: boolean
}

/**
 * One receipt in a grouped list.
 *
 * The inline receipt thumbnail this used to carry is gone: at 40px it showed
 * nothing legible, and the photo has a proper place on the detail screen.
 */
export default function ReceiptCard({ receipt, showChevron = false }: ReceiptCardProps) {
  const navigate = useNavigate()
  const name = receipt.store?.name ?? 'Unknown store'
  const count = receipt.item_count

  return (
    <button
      onClick={() => navigate(`/receipts/${receipt.id}`)}
      className="flex w-full items-center gap-3 border-t border-hairline bg-surface px-4 py-3 text-left first:border-t-0 active:bg-canvas"
    >
      <StoreBadge
        name={name}
        color={receipt.store?.color ?? '#8A8A8E'}
        className="h-[34px] w-[34px] text-xs"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-row">{name}</span>
        <span className="mt-0.5 block text-meta text-ink-2">
          {shortDate(receipt.receipt_date)}
          {count != null && ` · ${count} item${count === 1 ? '' : 's'}`}
        </span>
      </span>
      <span className="text-amount tabular-nums">${Number(receipt.total_amount).toFixed(2)}</span>
      {showChevron && <span aria-hidden className="text-nav text-ink-4">›</span>}
    </button>
  )
}
