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
    <div className="flex min-h-full flex-col items-center justify-center overflow-y-auto bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-ink">Set Up Your Household</h1>
          <p className="text-ink-2 text-sm mt-1">Create or join a household to start tracking</p>
        </div>

        <div className="bg-surface rounded-card shadow-sm border border-border p-6">
          <div className="flex rounded-input bg-track p-1 mb-5">
            <button
              onClick={() => setTab('create')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'create' ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              Create New
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'join' ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              Join Existing
            </button>
          </div>

          <ErrorBanner message={error} />

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Household Name</label>
                <input
                  type="text"
                  placeholder="My Household"
                  className="w-full rounded-input border border-border px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-input bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-pressed disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Spinner size="sm" />}
                Create Household
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Invite Code</label>
                <input
                  type="text"
                  required
                  placeholder="ABC123"
                  className="w-full rounded-input border border-border px-3 py-2.5 text-sm uppercase tracking-widest focus:border-accent focus:outline-none"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full rounded-input bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-pressed disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Spinner size="sm" />}
                Join Household
              </button>
            </form>
          )}
        </div>

        <button onClick={signOut} className="mt-4 w-full text-center text-sm text-ink-3 hover:text-ink-2">
          Sign out
        </button>
      </div>
    </div>
  )
}
