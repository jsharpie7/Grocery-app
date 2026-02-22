import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHousehold } from '../hooks/useHousehold'

function friendlyError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('relation') || m.includes('does not exist') || m.includes('table'))
    return 'Database not set up. Run the SQL migration in your Supabase project: open SQL Editor and paste the contents of supabase/migrations/001_initial_schema.sql.'
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch') || m.includes('placeholder'))
    return 'Cannot reach Supabase. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your Vercel environment variables, then redeploy.'
  if (m.includes('jwt') || m.includes('apikey') || m.includes('invalid api key') || m.includes('anon'))
    return 'Invalid Supabase API key. Double-check VITE_SUPABASE_ANON_KEY in Vercel — copy it from Supabase project → Settings → API.'
  return msg
}

export default function JoinScreen() {
  const { createHousehold, joinHousehold } = useHousehold()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [householdName, setHouseholdName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setLoading(true)
    setError('')
    const result = await createHousehold(householdName || 'My Household')
    setLoading(false)
    if (!result.success) {
      setError(friendlyError(result.error || 'Failed to create household.'))
    }
  }

  async function handleJoin() {
    if (joinCode.length !== 6) {
      setError('Enter the 6-character code')
      return
    }
    setLoading(true)
    setError('')
    const result = await joinHousehold(joinCode)
    setLoading(false)
    if (!result.success) {
      setError(friendlyError(result.error || 'Invalid code'))
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-3xl font-bold text-gray-900">Grocery</h1>
          <p className="text-gray-500 mt-2">Smart household shopping</p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-semibold text-lg shadow-lg"
            >
              Create New Household
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-2xl bg-white text-gray-800 font-semibold text-lg shadow border border-gray-200"
            >
              Join Existing Household
            </motion.button>
          </div>
        )}

        {mode === 'create' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Household Name (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. The Smiths"
                value={householdName}
                onChange={e => setHouseholdName(e.target.value)}
                className="w-full py-3 px-4 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                autoFocus
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-semibold text-lg shadow-lg disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Household'}
            </motion.button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={() => setMode('choose')}
              className="w-full py-2 text-gray-500"
            >
              Back
            </button>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                6-Character Join Code
              </label>
              <input
                type="text"
                placeholder="ABC123"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                className="w-full py-3 px-4 rounded-xl border border-gray-200 text-2xl tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white uppercase"
                maxLength={6}
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleJoin}
              disabled={loading || joinCode.length !== 6}
              className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-semibold text-lg shadow-lg disabled:opacity-60"
            >
              {loading ? 'Joining...' : 'Join Household'}
            </motion.button>
            <button
              onClick={() => setMode('choose')}
              className="w-full py-2 text-gray-500"
            >
              Back
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
