import { useState } from 'react'
import { useHouseholdStore } from '../../store/householdStore'
import { normalizeStoreName } from '../../lib/itemMatcher'

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
      <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange(null, '')}
          className={`rounded-full px-3 py-1 text-sm border transition-colors ${
            !storeId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
          }`}
        >
          Unknown
        </button>
        {stores.map((store) => (
          <button
            key={store.id}
            onClick={() => onChange(store.id, store.name)}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${
              storeId === store.id
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-300'
            }`}
            style={storeId === store.id ? { backgroundColor: store.color, borderColor: store.color } : {}}
          >
            {store.name}
          </button>
        ))}
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-full px-3 py-1 text-sm border border-dashed border-gray-300 text-gray-500"
        >
          + New Store
        </button>
      </div>

      {storeName && !storeId && (
        <p className="mt-1 text-xs text-gray-500">
          From receipt: "{storeName}" — select a store above or add a new one
        </p>
      )}

      {showNew && (
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="Store name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {creating ? '…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}
