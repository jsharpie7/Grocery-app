import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStores } from '../../hooks/useStores'

const PRESET_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#0ea5e9', '#84cc16',
]

const PRESET_STORES = [
  { name: 'Aldi', color: '#FF6600' },
  { name: 'Publix', color: '#008C00' },
  { name: 'Walmart', color: '#0071CE' },
  { name: 'Costco', color: '#E31837' },
  { name: 'Target', color: '#CC0000' },
  { name: 'Kroger', color: '#003DA5' },
  { name: 'Whole Foods', color: '#1D7A3E' },
  { name: 'Trader Joe\'s', color: '#C8102E' },
]

export default function StoreManager() {
  const { stores, addStore, updateStore, deleteStore } = useStores()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setAdding(true)
    await addStore(name.trim(), color)
    setName('')
    setColor('#6366f1')
    setShowAdd(false)
    setAdding(false)
  }

  function handlePreset(preset: { name: string; color: string }) {
    setName(preset.name)
    setColor(preset.color)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Existing stores */}
      <div className="space-y-2">
        {stores.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">🏪</p>
            <p>No stores yet. Add your first store!</p>
          </div>
        ) : (
          stores.map(store => (
            <motion.div
              key={store.id}
              layout
              className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: store.color }}
              >
                {store.name[0]}
              </div>
              <span className="flex-1 font-medium text-gray-800">{store.name}</span>
              <button
                onClick={() => deleteStore(store.id)}
                className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-sm"
              >
                🗑
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Add store */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3 overflow-hidden"
          >
            {/* Preset quick-add */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_STORES.map(p => (
                  <button
                    key={p.name}
                    onClick={() => handlePreset(p)}
                    className="px-3 py-1.5 rounded-full text-white text-xs font-medium"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Store name</label>
              <input
                type="text"
                placeholder="e.g. Aldi"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-8 h-8 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#1f2937' : 'transparent',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-medium text-sm disabled:opacity-60"
              >
                {adding ? 'Adding...' : 'Add Store'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-medium flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Store
        </button>
      )}
    </div>
  )
}
