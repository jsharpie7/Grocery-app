import { useState } from 'react'
import { useHousehold } from '../hooks/useHousehold'
import { useAuth } from '../hooks/useAuth'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

type Tab = 'create' | 'join'

export default function SetupPage() {
  const [tab, setTab] = useState<Tab>('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const { createHousehold, joinHousehold, error, loading } = useHousehold()
  const { signOut } = useAuth()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createHousehold(householdName || 'My Household')
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    await joinHousehold(inviteCode)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900">Set Up Your Household</h1>
          <p className="text-gray-500 text-sm mt-1">Create or join a household to start tracking</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
            <button
              onClick={() => setTab('create')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Create New
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'join' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Join Existing
            </button>
          </div>

          <ErrorBanner message={error} />

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Household Name</label>
                <input
                  type="text"
                  placeholder="My Household"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Spinner size="sm" />}
                Create Household
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
                <input
                  type="text"
                  required
                  placeholder="ABC123"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm uppercase tracking-widest focus:border-indigo-500 focus:outline-none"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Spinner size="sm" />}
                Join Household
              </button>
            </form>
          )}
        </div>

        <button onClick={signOut} className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600">
          Sign out
        </button>
      </div>
    </div>
  )
}
