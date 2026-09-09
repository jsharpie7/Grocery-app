import { useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

type Tab = 'signin' | 'signup'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (!supabaseConfigured) {
        setError('App is not connected to a database. Check Vercel environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
        return
      }
      if (tab === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) {
          if (err.message.toLowerCase().includes('already registered') || err.message.toLowerCase().includes('already exists')) {
            setError('An account with this email already exists. Sign in instead.')
          } else if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
            setError('Could not reach the server. Check your internet connection, or the Supabase URL may be misconfigured in Vercel.')
          } else {
            setError(err.message)
          }
          return
        }
        setSuccess('Check your email to confirm your account.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) {
          if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
            setError('Could not reach the server. Check your internet connection, or the Supabase URL may be misconfigured in Vercel.')
          } else {
            setError(err.message)
          }
          return
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center overflow-y-auto bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🧾</div>
          <h1 className="text-2xl font-bold text-ink">Grocery Spend</h1>
          <p className="text-ink-2 text-sm mt-1">Track your household grocery spending</p>
        </div>

        <div className="bg-surface rounded-card shadow-sm border border-border p-6">
          <div className="flex rounded-input bg-track p-1 mb-5">
            <button
              onClick={() => { setTab('signin'); setError(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'signin' ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'signup' ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              Sign Up
            </button>
          </div>

          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {success && (
            <div className="mb-4 rounded-input bg-accent/5 border border-accent/25 px-4 py-3 text-sm text-accent">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-input border border-border px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                className="w-full rounded-input border border-border px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-input bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-pressed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Spinner size="sm" />}
              {tab === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {tab === 'signin' && error?.includes('already exists') && (
            <p className="mt-3 text-center text-sm text-ink-2">
              <button onClick={() => setTab('signin')} className="text-accent underline">
                Sign in instead?
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
