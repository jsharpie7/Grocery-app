import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { uploadReceiptPhoto } from '../../lib/storage'
import { useHouseholdStore } from '../../store/householdStore'

interface Props {
  startTime: Date | null
  checkedCount: number
  storeName: string
  tripId: string | null
  onFinish: (totalSpent?: number, receiptUrl?: string) => void
}

function formatDuration(start: Date | null) {
  if (!start) return '0:00'
  const ms = Date.now() - start.getTime()
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

export default function TripSummary({ startTime, checkedCount, storeName, tripId, onFinish }: Props) {
  const { householdId } = useHouseholdStore()
  const [total, setTotal] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !householdId || !tripId) return

    setUploading(true)
    const url = await uploadReceiptPhoto(householdId, tripId, file)
    setReceiptUrl(url)
    setUploading(false)
  }

  function handleDone() {
    const spent = total ? parseFloat(total) : undefined
    onFinish(spent, receiptUrl || undefined)
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 pb-10 shadow-2xl"
    >
      <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />

      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">Trip Complete!</h2>
        <p className="text-gray-500 mt-1">{storeName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-indigo-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-indigo-600">{checkedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Items</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatDuration(startTime)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Duration</p>
        </div>
      </div>

      {/* Total spent */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Total spent (optional)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={total}
            onChange={e => setTotal(e.target.value)}
            className="w-full py-3 pl-7 pr-4 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>
      </div>

      {/* Receipt photo */}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium mb-5 flex items-center justify-center gap-2"
      >
        {uploading ? (
          <span>Uploading...</span>
        ) : receiptUrl ? (
          <span className="text-emerald-600">📷 Receipt attached ✓</span>
        ) : (
          <>
            <span>📷</span>
            <span>Attach receipt photo</span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleDone}
        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-semibold text-lg shadow-lg"
      >
        Save Trip
      </motion.button>
    </motion.div>
  )
}
