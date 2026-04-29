import { useState } from 'react'
import { supabase } from '../lib/supabase'
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
      if (tab === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) {
          if (err.message.toLowerCase().includes('already registered') || err.message.toLowerCase().includes('already exists')) {
            setError('An account with this email already exists.')
          } else {
            setError(err.message)
          }
          return
        }
        setSuccess('Check your email to confirm your account.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) { setError(err.message); return }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🧾</div>
          <h1 className="text-2xl font-bold text-gray-900">Grocery Spend</h1>
          <p className="text-gray-500 text-sm mt-1">Track your household grocery spending</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
            <button
              onClick={() => { setTab('signin'); setError(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Sign Up
            </button>
          </div>

          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Spinner size="sm" />}
              {tab === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {tab === 'signin' && error?.includes('already exists') && (
            <p className="mt-3 text-center text-sm text-gray-500">
              <button onClick={() => setTab('signin')} className="text-indigo-600 underline">
                Sign in instead?
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
