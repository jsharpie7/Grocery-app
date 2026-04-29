import type { PendingLineItem } from '../../hooks/useReceipts'
import { CATEGORIES } from '../../lib/supabase'

interface LineItemRowProps {
  item: PendingLineItem
  index: number
  onChange: (index: number, updates: Partial<PendingLineItem>) => void
  onRemove: (index: number) => void
}

export default function LineItemRow({ item, index, onChange, onRemove }: LineItemRowProps) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-2">
        <div>
          <input
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
            value={item.item_name}
            onChange={(e) => onChange(index, { item_name: e.target.value })}
          />
          {item.prevAvgPrice != null && (
            <div className="text-xs text-gray-400 mt-0.5">
              avg ${item.prevAvgPrice.toFixed(2)}
              {item.unit_price != null && (
                <span className={item.unit_price > item.prevAvgPrice ? ' text-red-400' : ' text-green-500'}>
                  {' '}
                  {item.unit_price > item.prevAvgPrice
                    ? `↑${Math.round(((item.unit_price - item.prevAvgPrice) / item.prevAvgPrice) * 100)}%`
                    : `↓${Math.round(((item.prevAvgPrice - item.unit_price) / item.prevAvgPrice) * 100)}%`}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="py-2 pr-2 w-16">
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-right"
          value={item.unit_price ?? ''}
          placeholder="—"
          onChange={(e) => onChange(index, { unit_price: e.target.value ? Number(e.target.value) : null })}
        />
      </td>
      <td className="py-2 pr-2 w-20">
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-right"
          value={item.total_price ?? ''}
          placeholder="—"
          onChange={(e) => onChange(index, { total_price: e.target.value ? Number(e.target.value) : null })}
        />
      </td>
      <td className="py-2 pr-2 w-28">
        <select
          className="w-full rounded border border-gray-200 px-1 py-1 text-xs"
          value={item.category}
          onChange={(e) => onChange(index, { category: e.target.value })}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-2 w-8 text-center">
        <button
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 text-lg leading-none"
          aria-label="Remove item"
        >
          ×
        </button>
      </td>
    </tr>
  )
}
