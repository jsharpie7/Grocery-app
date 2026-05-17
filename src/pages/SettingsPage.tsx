import { useState, useEffect } from 'react'
import { useHouseholdStore, DEFAULT_CATEGORIES } from '../store/householdStore'
import { useStores } from '../hooks/useStores'
import { useAuth } from '../hooks/useAuth'
import { validateGeminiKey } from '../lib/gemini'
import { supabase } from '../lib/supabase'
import PageShell from '../components/layout/PageShell'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'

type Tab = 'gemini' | 'household' | 'stores' | 'categories' | 'account'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#64748b']

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('gemini')
  const { geminiKey, setGeminiKey, householdId, householdName, categories, setCategories } = useHouseholdStore()
  const { stores, fetchStores, createStore, updateStore, deleteStore } = useStores()
  const { user, signOut } = useAuth()

  const [keyInput, setKeyInput] = useState(geminiKey)
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreColor, setNewStoreColor] = useState('#6366f1')
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (tab === 'stores') fetchStores()
    if (tab === 'household' && householdId) {
      supabase.from('households').select('invite_code').eq('id', householdId).single()
        .then(({ data }) => { if (data) setInviteCode(data.invite_code) })
    }
  }, [tab])

  async function handleValidateKey() {
    setKeyStatus('validating')
    setKeyError(null)
    try {
      await validateGeminiKey(keyInput.trim())
      setGeminiKey(keyInput.trim())
      setKeyStatus('ok')
    } catch (e) {
      setKeyError((e as Error).message)
      setKeyStatus('error')
    }
  }

  async function handleAddStore() {
    if (!newStoreName.trim()) return
    setStoreError(null)
    const result = await createStore(newStoreName.trim(), newStoreColor)
    if (!result) { setStoreError('Failed to create store'); return }
    setNewStoreName('')
    setNewStoreColor('#6366f1')
  }

  return (
    <PageShell title="Settings">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-white">
        {([['gemini', 'Gemini Key'], ['household', 'Household'], ['stores', 'Stores'], ['categories', 'Categories'], ['account', 'Account']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* ─── Gemini Key ─────────────────────── */}
        {tab === 'gemini' && (
          <>
            <p className="text-sm text-gray-500">
              Required for receipt scanning. Get a free key at{' '}
              <span className="font-medium text-indigo-600">aistudio.google.com/app/apikey</span>
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="AIza..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono"
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setKeyStatus('idle') }}
              />
              <button
                onClick={handleValidateKey}
                disabled={!keyInput.trim() || keyStatus === 'validating'}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {keyStatus === 'validating' && <Spinner size="sm" />}
                {keyStatus === 'validating' ? 'Validating…' : 'Validate & Save Key'}
              </button>
              {keyStatus === 'ok' && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
                  ✓ Key valid and saved
                </div>
              )}
              {keyStatus === 'error' && keyError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                  {keyError}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Household ─────────────────────── */}
        {tab === 'household' && (
          <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium text-gray-900">{householdName}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-500">Invite Code</span>
              {inviteCode ? (
                <button
                  onClick={() => navigator.clipboard.writeText(inviteCode)}
                  className="font-mono text-sm font-semibold text-indigo-600 tracking-widest"
                >
                  {inviteCode} 📋
                </button>
              ) : (
                <Spinner size="sm" />
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400">Share the invite code with a partner to join your household (max 2 members).</p>
            </div>
          </div>
        )}

        {/* ─── Stores ─────────────────────── */}
        {tab === 'stores' && (
          <>
            <ErrorBanner message={storeError} onDismiss={() => setStoreError(null)} />

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Store name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
                />
                <div className="flex gap-1">
                  {COLORS.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewStoreColor(c)}
                      className="h-8 w-8 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: newStoreColor === c ? '#1e293b' : 'transparent' }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAddStore}
                  disabled={!newStoreName.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
              {stores.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No stores yet. Add one above.</p>
              ) : stores.map((store) => (
                <div key={store.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded-full shrink-0" style={{ backgroundColor: store.color }} />
                  <span className="flex-1 text-sm font-medium text-gray-900">{store.name}</span>
                  <button
                    onClick={() => deleteStore(store.id)}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── Categories ─────────────────────── */}
        {tab === 'categories' && (
          <>
            <p className="text-sm text-gray-500">Customize the categories used when reviewing receipts.</p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New category name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategory.trim() && !categories.includes(newCategory.trim())) {
                    setCategories([...categories, newCategory.trim()])
                    setNewCategory('')
                  }
                }}
              />
              <button
                onClick={() => {
                  const trimmed = newCategory.trim()
                  if (trimmed && !categories.includes(trimmed)) {
                    setCategories([...categories, trimmed])
                    setNewCategory('')
                  }
                }}
                disabled={!newCategory.trim() || categories.includes(newCategory.trim())}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{cat}</span>
                  <button
                    onClick={() => setCategories(categories.filter((c) => c !== cat))}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCategories(DEFAULT_CATEGORIES)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Reset to defaults
            </button>
          </>
        )}

        {/* ─── Account ─────────────────────── */}
        {tab === 'account' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}
