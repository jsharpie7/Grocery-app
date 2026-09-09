import { useState, useEffect } from 'react'
import { useHouseholdStore, DEFAULT_CATEGORIES } from '../store/householdStore'
import { useStores } from '../hooks/useStores'
import { useAuth } from '../hooks/useAuth'
import { validateGeminiKey, MODEL_CHOICES, getLastScanDiagnostics } from '../lib/gemini'
import { supabase } from '../lib/supabase'
import PageShell from '../components/layout/PageShell'
import SettingsGroup from '../components/settings/SettingsGroup'
import SettingsRow from '../components/settings/SettingsRow'
import ErrorBanner from '../components/ui/ErrorBanner'
import ScanDetails from '../components/receipts/ScanDetails'
import StoreBadge from '../components/ui/StoreBadge'
import Toggle from '../components/ui/Toggle'

/** Palette offered for a store's badge. Accent leads; the rest are distinct hues. */
const COLORS = ['#1D7A47', '#0071CE', '#E31837', '#FF6600', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#64748b']

/** Which disclosure row is open. One at a time, as on the review screen. */
type Panel = 'key' | 'model' | 'diagnostics' | 'addStore' | 'addCategory' | null

const inputClass = 'w-full rounded-input border border-border px-3 py-2.5 text-field'
const buttonClass = 'flex-none rounded-input bg-accent px-4 py-2.5 text-nav font-semibold text-white disabled:opacity-50'

export default function SettingsPage() {
  const {
    geminiKey, setGeminiKey, geminiModel, setGeminiModel,
    householdId, householdName, categories, setCategories,
    flagLowConfidence, setFlagLowConfidence,
  } = useHouseholdStore()
  const { stores, error: storesError, fetchStores, createStore, updateStore, deleteStore } = useStores()
  const { user, signOut } = useAuth()

  const [panel, setPanel] = useState<Panel>(null)
  const [keyInput, setKeyInput] = useState(geminiKey)
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreColor, setNewStoreColor] = useState(COLORS[0])
  const [newCategory, setNewCategory] = useState('')
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(COLORS[0])

  // One screen now, so everything loads once rather than per tab.
  useEffect(() => {
    fetchStores()
    if (householdId) {
      supabase.from('households').select('invite_code').eq('id', householdId).single()
        .then(({ data }) => { if (data) setInviteCode(data.invite_code) })
    }
  }, [householdId])

  function toggle(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next))
  }

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
    if (!result) {
      // Surface the hook's specific reason (e.g. the duplicate-name message)
      // rather than a generic failure string that hides what went wrong.
      setStoreError(storesError ?? 'Failed to create store')
      return
    }
    setNewStoreName('')
    setNewStoreColor(COLORS[0])
    setPanel(null)
  }

  async function saveStoreEdit(id: string) {
    if (!editName.trim()) return
    setStoreError(null)
    const ok = await updateStore(id, { name: editName, color: editColor })
    if (!ok) { setStoreError(storesError ?? 'Failed to update store'); return }
    setEditingStoreId(null)
  }

  function addCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed || categories.includes(trimmed)) return
    setCategories([...categories, trimmed])
    setNewCategory('')
  }

  const lastScan = getLastScanDiagnostics()

  return (
    <PageShell title="Settings">
      <div className="px-4 pb-2">
        <ErrorBanner message={storeError} onDismiss={() => setStoreError(null)} />

        <SettingsGroup title="Household">
          <SettingsRow label="Household" value={householdName || '—'} />
          <SettingsRow
            label="Invite code"
            value={<span className="font-mono tracking-widest">{inviteCode ?? '—'}</span>}
          />
        </SettingsGroup>

        <SettingsGroup title="Stores">
          {stores.map((store) => (
            <div key={store.id} className="border-t border-hairline first:border-t-0">
              <div className="flex items-center gap-3 px-4 py-3">
                <StoreBadge name={store.name} color={store.color} className="h-[26px] w-[26px] text-[10px]" />
                <span className="min-w-0 flex-1 truncate text-row">{store.name}</span>
                <button
                  onClick={() => {
                    setStoreError(null)
                    setEditingStoreId(editingStoreId === store.id ? null : store.id)
                    setEditName(store.name)
                    setEditColor(store.color)
                  }}
                  className="flex-none text-chip-label font-normal text-ink-3"
                >
                  {editingStoreId === store.id ? 'Done' : 'Edit'}
                </button>
              </div>

              {editingStoreId === store.id && (
                <div className="px-4 pb-4">
                  <input
                    className={inputClass}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Store name"
                  />
                  <ColorRow value={editColor} onChange={setEditColor} />
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => saveStoreEdit(store.id)} className={buttonClass}>Save</button>
                    <button
                      onClick={() => { deleteStore(store.id); setEditingStoreId(null) }}
                      className="ml-auto text-chip-label text-danger"
                    >
                      Delete store
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <SettingsRow
            label={<span className="text-accent">Add store</span>}
            onClick={() => toggle('addStore')}
            expanded={panel === 'addStore'}
          >
            <input
              className={inputClass}
              placeholder="Store name"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
              aria-label="New store name"
            />
            <ColorRow value={newStoreColor} onChange={setNewStoreColor} />
            <button onClick={handleAddStore} disabled={!newStoreName.trim()} className={`${buttonClass} mt-3`}>
              Add store
            </button>
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Scanning">
          <SettingsRow
            label="Gemini key"
            value={<span className="text-accent">{geminiKey ? 'Saved · Replace' : 'Add key'}</span>}
            onClick={() => toggle('key')}
            expanded={panel === 'key'}
          >
            <div className="flex gap-2">
              <input
                className={`${inputClass} font-mono`}
                placeholder="AIza..."
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setKeyStatus('idle') }}
                aria-label="Gemini API key"
              />
              <button onClick={handleValidateKey} disabled={!keyInput.trim() || keyStatus === 'validating'} className={buttonClass}>
                {keyStatus === 'validating' ? '…' : 'Save'}
              </button>
            </div>
            <p className="mt-2 text-label leading-normal text-ink-2">
              Get a free key at <span className="font-medium">aistudio.google.com/app/apikey</span>
            </p>
            {keyStatus === 'ok' && <p className="mt-2 text-meta font-semibold text-accent">Key verified and saved.</p>}
            {keyStatus === 'error' && <p className="mt-2 text-meta text-danger">{keyError}</p>}
          </SettingsRow>

          <SettingsRow
            label="Model"
            value={geminiModel.replace(/^gemini-/, '')}
            onClick={() => toggle('model')}
            expanded={panel === 'model'}
          >
            <div className="flex flex-wrap gap-[7px]">
              {MODEL_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => setGeminiModel(choice.id)}
                  aria-pressed={geminiModel === choice.id}
                  className={`rounded-chip border px-[13px] py-[7px] text-chip-label ${
                    geminiModel === choice.id
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-ink'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow
            label="Flag low-confidence rows"
            value={
              <Toggle
                checked={flagLowConfidence}
                onChange={setFlagLowConfidence}
                label="Flag low-confidence rows"
              />
            }
          />

          <SettingsRow
            label="Scan diagnostics"
            value={<span className="text-ink-3">{lastScan ? 'View last scan' : 'No scans yet'}</span>}
            onClick={() => toggle('diagnostics')}
            expanded={panel === 'diagnostics'}
          >
            {lastScan
              ? <ScanDetails diagnostics={lastScan} />
              : <p className="text-meta text-ink-2">Nothing to show until a receipt has been scanned.</p>}
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Categories">
          <div className="flex flex-wrap gap-[7px] px-4 py-3.5">
            {categories.map((cat) => (
              <span key={cat} className="flex items-center gap-1.5 rounded-[13px] bg-chip py-2 pl-3 pr-2 text-chip-label">
                {cat}
                {/* Not in the design, which draws plain chips — but categories
                    are editable here and a chip you cannot remove would strand
                    every mistyped one. */}
                <button
                  onClick={() => setCategories(categories.filter((c) => c !== cat))}
                  aria-label={`Remove ${cat}`}
                  className="text-[15px] leading-none text-ink-3"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              onClick={() => toggle('addCategory')}
              className="rounded-[13px] border border-dashed border-border-strong px-3 py-2 text-chip-label text-accent"
            >
              + Add
            </button>
          </div>

          {panel === 'addCategory' && (
            <div className="border-t border-hairline px-4 py-3.5">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="New category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  aria-label="New category"
                />
                <button
                  onClick={addCategory}
                  disabled={!newCategory.trim() || categories.includes(newCategory.trim())}
                  className={buttonClass}
                >
                  Add
                </button>
              </div>
              <button
                onClick={() => setCategories(DEFAULT_CATEGORIES)}
                className="mt-3 text-chip-label text-ink-2"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </SettingsGroup>

        {/* Not in the design, which has no account section. Sign-out has to
            live somewhere, and this is the screen it belongs on. */}
        <SettingsGroup title="Account">
          <SettingsRow label="Email" value={user?.email ?? '—'} />
          <SettingsRow label={<span className="text-danger">Sign out</span>} onClick={signOut} chevron={false} />
        </SettingsGroup>
      </div>
    </PageShell>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
          aria-pressed={value === c}
          className={`h-7 w-7 rounded-full ${value === c ? 'ring-2 ring-ink ring-offset-2' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
