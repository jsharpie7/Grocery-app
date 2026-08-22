import type { PendingLineItem } from '../../hooks/useReceipts'
import { useHouseholdStore } from '../../store/householdStore'

interface LineItemRowProps {
  item: PendingLineItem
  index: number
  onChange: (index: number, updates: Partial<PendingLineItem>) => void
  onRemove: (index: number) => void
}

export default function LineItemRow({ item, index, onChange, onRemove }: LineItemRowProps) {
  const categories = useHouseholdStore((s) => s.categories)
  const expectedTotal = item.unit_price != null
    ? Math.round(item.unit_price * item.quantity * 100) / 100
    : null
  const mathMismatch = expectedTotal != null && item.total_price != null
    && Math.abs(item.total_price - expectedTotal) > 0.01

  function handleUnitPriceChange(raw: string) {
    const newPrice = raw ? Number(raw) : null
    const newTotal = newPrice != null ? Math.round(newPrice * item.quantity * 100) / 100 : item.total_price
    onChange(index, { unit_price: newPrice, total_price: newTotal })
  }

  function handleQuantityChange(raw: string) {
    const newQty = Math.max(1, Number(raw) || 1)
    const newTotal = item.unit_price != null ? Math.round(item.unit_price * newQty * 100) / 100 : item.total_price
    onChange(index, { quantity: newQty, total_price: newTotal })
  }

  return (
    <tr className={`border-b border-gray-100 ${mathMismatch ? 'bg-orange-50' : ''}`}>
      <td className="py-2 pr-2">
        <div>
          <div className="flex items-center gap-1">
            <input
              className="w-full min-h-[44px] rounded border border-gray-200 px-2 py-2"
              value={item.item_name}
              onChange={(e) => onChange(index, { item_name: e.target.value })}
            />
            {item.matchedItemId && (
              <span title="In your catalog" className="text-indigo-400 text-sm shrink-0">🏷</span>
            )}
            {mathMismatch && (
              <span title={`Expected $${expectedTotal?.toFixed(2)} (${item.unit_price} × ${item.quantity})`} className="text-orange-400 text-sm shrink-0">⚠</span>
            )}
          </div>
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
          min="1"
          step="1"
          className="w-full min-h-[44px] rounded border border-gray-200 px-2 py-2 text-right"
          value={item.quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
        />
      </td>
      <td className="py-2 pr-2 w-24">
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full min-h-[44px] rounded border border-gray-200 px-2 py-2 text-right"
          value={item.unit_price ?? ''}
          placeholder="—"
          onChange={(e) => handleUnitPriceChange(e.target.value)}
        />
      </td>
      <td className="py-2 pr-2 w-24">
        <input
          type="number"
          min="0"
          step="0.01"
          className={`w-full min-h-[44px] rounded border px-2 py-2 text-right ${mathMismatch ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
          value={item.total_price ?? ''}
          placeholder="—"
          onChange={(e) => onChange(index, { total_price: e.target.value ? Number(e.target.value) : null })}
        />
      </td>
      <td className="py-2 pr-2 w-32">
        <select
          className="w-full min-h-[44px] rounded border border-gray-200 px-1 py-2"
          value={item.category}
          onChange={(e) => onChange(index, { category: e.target.value })}
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-2 w-10 text-center">
        <button
          onClick={() => onRemove(index)}
          className="min-h-[44px] min-w-[36px] text-gray-400 hover:text-red-500 text-xl leading-none"
          aria-label="Remove item"
        >
          ×
        </button>
      </td>
    </tr>
  )
}
