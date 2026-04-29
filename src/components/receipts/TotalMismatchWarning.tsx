interface TotalMismatchWarningProps {
  itemSum: number
  taxAmount: number
  totalAmount: number
}

export default function TotalMismatchWarning({ itemSum, taxAmount, totalAmount }: TotalMismatchWarningProps) {
  const diff = Math.abs(itemSum + taxAmount - totalAmount)
  if (diff <= 0.01) return null

  return (
    <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
      Item total ({(itemSum + taxAmount).toFixed(2)}) doesn't match receipt total ({totalAmount.toFixed(2)}).
      Difference: ${diff.toFixed(2)}
    </div>
  )
}
