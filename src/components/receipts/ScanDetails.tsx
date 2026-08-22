import { formatDiagnostics, type ScanDiagnostics } from '../../lib/gemini'

interface ScanDetailsProps {
  diagnostics: ScanDiagnostics | null
}

/**
 * Collapsed-by-default breakdown of the last scan attempt. A timeout on its own says nothing
 * about where the time went — this shows whether the photo was prepared badly, whether the
 * request never came back, and what the model reported when it did.
 */
export default function ScanDetails({ diagnostics }: ScanDetailsProps) {
  if (!diagnostics) return null

  return (
    <details className="mx-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
      <summary className="cursor-pointer font-medium text-gray-700">Scan details</summary>
      <div className="mt-2 space-y-1 font-mono leading-relaxed">
        {formatDiagnostics(diagnostics).map((line) => (
          <div key={line} className="break-words">{line}</div>
        ))}
      </div>
    </details>
  )
}
