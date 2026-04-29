import { useNavigate } from 'react-router-dom'
import type { Receipt } from '../../lib/supabase'

interface ReceiptCardProps {
  receipt: Receipt
}

export default function ReceiptCard({ receipt }: ReceiptCardProps) {
  const navigate = useNavigate()
  const color = receipt.store?.color ?? '#6366f1'
  const date = new Date(receipt.receipt_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <button
      onClick={() => navigate(`/receipts/${receipt.id}`)}
      className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100"
    >
      <div
        className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: color }}
      >
        {(receipt.store?.name ?? '?')[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 truncate">
          {receipt.store?.name ?? 'Unknown Store'}
        </div>
        <div className="text-sm text-gray-500">{date}</div>
      </div>
      {receipt.image_url && (
        <img
          src={receipt.image_url}
          alt="Receipt"
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      )}
      <div className="shrink-0 text-right">
        <div className="font-semibold text-gray-900">${Number(receipt.total_amount).toFixed(2)}</div>
      </div>
    </button>
  )
}
