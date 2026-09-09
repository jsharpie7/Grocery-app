import { useState } from 'react'
import { useHouseholdStore } from '../../store/householdStore'
import { normalizeStoreName } from '../../lib/itemMatcher'
import StoreBadge from '../ui/StoreBadge'

interface StorePickerProps {
  storeId: string | null
  storeName: string
  onChange: (storeId: string | null, storeName: string) => void
  onCreateStore?: (name: string) => Promise<{ id: string } | null>
}

export default function StorePicker({ storeId, storeName, onChange, onCreateStore }: StorePickerProps) {
  const stores = useHouseholdStore((s) => s.stores)
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!newName.trim() || !onCreateStore) return
    setCreating(true)
    const result = await onCreateStore(newName.trim())
    if (result) {
      onChange(result.id, newName.trim())
      setNewName('')
      setShowNew(false)
    }
    setCreating(false)
  }

  return (
    <div>
      <label className="mb-1.5 block text-label text-ink-2">Store</label>
      {/* Pills follow the review screen's category chips: same radius, same
          selected treatment, so the two choosers read as one control. */}
      <div className="flex flex-wrap gap-[7px]">
        <button
          onClick={() => onChange(null, '')}
          aria-pressed={!storeId}
          className={`rounded-chip border px-[13px] py-[7px] text-chip-label ${
            !storeId ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-ink'
          }`}
        >
          Unknown
        </button>
        {stores.map((store) => (
          <button
            key={store.id}
            onClick={() => onChange(store.id, store.name)}
            aria-pressed={storeId === store.id}
            className={`flex items-center gap-1.5 rounded-chip border py-1 pl-1 pr-[13px] text-chip-label ${
              storeId === store.id
                ? 'border-transparent text-white'
                : 'border-border bg-surface text-ink'
            }`}
            style={storeId === store.id ? { backgroundColor: store.color, borderColor: store.color } : {}}
          >
            <StoreBadge name={store.name} color={store.color} className="h-6 w-6 text-[10px]" />
            {store.name}
          </button>
        ))}
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-chip border border-dashed border-border-strong px-[13px] py-[7px] text-chip-label text-accent"
        >
          + New store
        </button>
      </div>

      {storeName && !storeId && (
        <p className="mt-2 text-label leading-normal text-ink-2">
          On receipt: “{storeName}” — pick a store above or add a new one
        </p>
      )}

      {showNew && (
        <div className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-input border border-border px-3 py-2.5 text-field"
            placeholder="Store name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex-none rounded-input bg-accent px-4 text-nav font-semibold text-white disabled:opacity-50"
          >
            {creating ? '…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}
