interface TotalMismatchWarningProps {
  itemSum: number
  taxAmount: number
  totalAmount: number
  suspectCount: number
}

export default function TotalMismatchWarning({ itemSum, taxAmount, totalAmount, suspectCount }: TotalMismatchWarningProps) {
  const computed = itemSum + taxAmount
  const diff = totalAmount > 0 ? computed - totalAmount : null
  const matches = diff !== null && Math.abs(diff) <= 0.01

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${matches ? 'bg-green-50 border-green-200' : diff !== null ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex justify-between text-gray-600 mb-1">
        <span>Items subtotal</span>
        <span>${itemSum.toFixed(2)}</span>
      </div>
      {taxAmount > 0 && (
        <div className="flex justify-between text-gray-600 mb-1">
          <span>Tax / Fees</span>
          <span>${taxAmount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t border-current/10 pt-1 mt-1">
        <span>Computed total</span>
        <span>${computed.toFixed(2)}</span>
      </div>
      {diff !== null && (
        <div className={`flex justify-between mt-1 font-medium ${matches ? 'text-green-700' : 'text-yellow-700'}`}>
          <span>{matches ? '✓ Matches receipt' : `⚠ Off by $${Math.abs(diff).toFixed(2)}`}</span>
          {!matches && <span>Receipt: ${totalAmount.toFixed(2)}</span>}
        </div>
      )}
      {!matches && suspectCount > 0 && (
        <div className="mt-2 text-xs text-orange-600 border-t border-orange-200 pt-2">
          {suspectCount} item{suspectCount > 1 ? 's' : ''} highlighted below — unit × qty doesn't match total, likely where the error is
        </div>
      )}
    </div>
  )
}
