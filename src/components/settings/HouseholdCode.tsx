import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHouseholdStore } from '../../store/householdStore'

export default function HouseholdCode() {
  const { householdName, joinCode, clearHousehold } = useHouseholdStore()
  const [copied, setCopied] = useState(false)
  const [showLeave, setShowLeave] = useState(false)

  function handleCopy() {
    if (joinCode) {
      navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleLeave() {
    clearHousehold()
    window.location.reload()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Household info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
        <div className="text-4xl mb-3">🏠</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{householdName}</h2>
        <p className="text-sm text-gray-400">Your household</p>
      </div>

      {/* Join code */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Join Code</h3>
        <p className="text-xs text-gray-400 mb-3">
          Share this code with family members to sync your grocery list across devices.
        </p>
        <div
          className="bg-gray-50 rounded-xl p-4 text-center cursor-pointer active:bg-gray-100"
          onClick={handleCopy}
        >
          <span className="text-4xl font-mono font-bold tracking-widest text-indigo-600 block">
            {joinCode || '------'}
          </span>
          <span className="text-xs text-gray-400 mt-2 block">
            {copied ? '✓ Copied!' : 'Tap to copy'}
          </span>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCopy}
          className="w-full mt-3 py-3 bg-indigo-500 text-white rounded-xl font-semibold text-sm"
        >
          {copied ? '✓ Copied!' : '📋 Copy Code'}
        </motion.button>
      </div>

      {/* How to join on another device */}
      <div className="bg-indigo-50 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-indigo-800 mb-2">How to join on another device</h3>
        <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
          <li>Open this app on the other device</li>
          <li>Tap "Join Existing Household"</li>
          <li>Enter the code above</li>
        </ol>
      </div>

      {/* Leave household */}
      <div className="pt-4">
        {!showLeave ? (
          <button
            onClick={() => setShowLeave(true)}
            className="w-full py-3 rounded-xl border border-red-200 text-red-400 font-medium text-sm"
          >
            Leave Household
          </button>
        ) : (
          <div className="bg-red-50 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-medium text-red-700 text-center">
              Are you sure? This device will be disconnected from the household.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeave(false)}
                className="flex-1 py-2.5 rounded-xl bg-white text-gray-600 font-medium text-sm border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm"
              >
                Leave
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
