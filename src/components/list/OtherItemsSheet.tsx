import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import type { Item } from '../../lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  allItems: Item[]
  addedItemIds: string[]
  onAdd: (itemId: string, quantity: number, unit: string) => Promise<void>
  storeId: string
  householdId: string
}

export default function OtherItemsSheet({
  isOpen, onClose, allItems, addedItemIds, onAdd, storeId, householdId
}: Props) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [showNewItem, setShowNewItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = allItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) &&
    !addedItemIds.includes(item.id)
  )

  async function handleAdd(item: Item) {
    setAdding(item.id)
    await onAdd(item.id, 1, 'ea')
    setAdding(null)
  }

  async function handleCreateAndAdd() {
    if (!newItemName.trim()) return
    setCreating(true)

    // Create item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .insert({ household_id: householdId, name: newItemName.trim() })
      .select()
      .single()

    if (itemError || !item) {
      setCreating(false)
      return
    }

    // Create store_item entry
    await supabase.from('store_items').upsert({
      store_id: storeId,
      item_id: item.id,
      typical_quantity: 1,
      unit: 'ea',
    }, { onConflict: 'store_id,item_id' })

    await onAdd(item.id, 1, 'ea')
    setNewItemName('')
    setShowNewItem(false)
    setCreating(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 z-30"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-40 max-h-[75vh] flex flex-col"
          >
            <div className="p-4 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full py-2.5 pl-4 pr-10 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {/* Add new item */}
              <button
                onClick={() => setShowNewItem(!showNewItem)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-indigo-600 font-medium text-sm"
              >
                <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500">+</span>
                Add new item
              </button>

              {showNewItem && (
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex gap-2">
                  <input
                    type="text"
                    placeholder="Item name..."
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
                    className="flex-1 py-2 px-3 rounded-lg text-sm focus:outline-none border border-indigo-200 bg-white"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateAndAdd}
                    disabled={creating || !newItemName.trim()}
                    className="px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {creating ? '...' : 'Add'}
                  </button>
                </div>
              )}

              {/* Item list */}
              {filtered.length === 0 && !showNewItem && (
                <div className="text-center py-10 text-gray-400 text-sm">
                  {search ? `No items matching "${search}"` : 'No items found'}
                </div>
              )}

              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleAdd(item)}
                  disabled={adding === item.id}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">{item.category?.icon || '🛒'}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                    {item.category && (
                      <p className="text-xs text-gray-400">{item.category.name}</p>
                    )}
                  </div>
                  <span className="text-indigo-500 text-sm font-medium">
                    {adding === item.id ? '✓' : '+'}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
