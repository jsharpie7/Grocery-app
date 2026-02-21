import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useHouseholdStore } from '../store/householdStore'
import { useListItems } from '../hooks/useListItems'
import { useSmartOrder } from '../hooks/useSmartOrder'
import ItemBubble from '../components/bubbles/ItemBubble'
import EdgeBubble from '../components/bubbles/EdgeBubble'
import OtherItemsSheet from '../components/list/OtherItemsSheet'
import ListStrip from '../components/list/ListStrip'

export default function AddToList() {
  const navigate = useNavigate()
  const { stores, householdId } = useHouseholdStore()
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'store-select' | 'item-select'>('store-select')
  const [showOtherSheet, setShowOtherSheet] = useState(false)

  const { listItems, addItem, removeItem } = useListItems()
  const activeStoreListItems = listItems.filter(
    i => i.store_id === selectedStoreId && !i.is_checked
  )
  const addedItemIds = activeStoreListItems.map(i => i.item_id)

  const { commonItems, fetchCommonItems, getAllItemsForStore } = useSmartOrder(selectedStoreId || '')
  const [allItems, setAllItems] = useState<any[]>([])

  useEffect(() => {
    if (selectedStoreId) {
      fetchCommonItems(addedItemIds)
    }
  }, [selectedStoreId])

  async function handleSelectStore(storeId: string) {
    setSelectedStoreId(storeId)
    setPhase('item-select')
    await fetchCommonItems(addedItemIds)
    const items = await getAllItemsForStore()
    setAllItems(items)
  }

  async function handleAddItem(itemId: string, quantity = 1, unit = 'ea') {
    if (!selectedStoreId) return
    await addItem(selectedStoreId, itemId, quantity, unit)
    await fetchCommonItems([...addedItemIds, itemId])
  }

  const edgeStores = stores.filter(s => s.id !== selectedStoreId)

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-3 z-20">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => phase === 'item-select' ? setPhase('store-select') : navigate('/')}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-600 text-xl mr-3"
        >
          ←
        </motion.button>
        <h2 className="text-xl font-bold text-gray-900">
          {phase === 'store-select'
            ? 'Which store?'
            : stores.find(s => s.id === selectedStoreId)?.name || 'Add Items'}
        </h2>
      </div>

      {/* Store Select Phase */}
      {phase === 'store-select' && (
        <div className="flex-1 flex flex-wrap items-center justify-center gap-6 p-6 bubbles-container">
          {stores.length === 0 ? (
            <div className="text-center text-gray-400">
              <p className="text-lg">No stores yet</p>
              <p className="text-sm mt-1">Add stores in Settings</p>
            </div>
          ) : (
            stores.map((store, i) => (
              <motion.button
                key={store.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleSelectStore(store.id)}
                className="relative w-36 h-36 rounded-full shadow-lg flex flex-col items-center justify-center text-white font-semibold"
                style={{ backgroundColor: store.color }}
              >
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="w-16 h-16 object-contain rounded-full mb-1" />
                ) : (
                  <span className="text-3xl mb-1">🏪</span>
                )}
                <span className="text-sm px-2 text-center leading-tight">{store.name}</span>
                {(() => {
                  const count = listItems.filter(i => i.store_id === store.id && !i.is_checked).length
                  return count > 0 ? (
                    <span className="absolute top-2 right-2 bg-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center" style={{ color: store.color }}>
                      {count}
                    </span>
                  ) : null
                })()}
              </motion.button>
            ))
          )}
        </div>
      )}

      {/* Item Select Phase */}
      {phase === 'item-select' && selectedStoreId && (
        <div className="flex-1 flex relative overflow-hidden">
          {/* Edge store bubbles (left/right) */}
          <div className="absolute left-2 top-0 bottom-24 flex flex-col justify-center gap-3 z-10">
            {edgeStores.slice(0, Math.ceil(edgeStores.length / 2)).map(store => (
              <EdgeBubble
                key={store.id}
                store={store}
                itemCount={listItems.filter(i => i.store_id === store.id && !i.is_checked).length}
                onSelect={() => handleSelectStore(store.id)}
              />
            ))}
          </div>
          <div className="absolute right-2 top-0 bottom-24 flex flex-col justify-center gap-3 z-10">
            {edgeStores.slice(Math.ceil(edgeStores.length / 2)).map(store => (
              <EdgeBubble
                key={store.id}
                store={store}
                itemCount={listItems.filter(i => i.store_id === store.id && !i.is_checked).length}
                onSelect={() => handleSelectStore(store.id)}
              />
            ))}
          </div>

          {/* Item bubbles grid */}
          <div className="flex-1 mx-20 flex flex-wrap content-start items-start justify-center gap-4 pt-4 pb-32 overflow-y-auto no-scrollbar bubbles-container">
            <AnimatePresence>
              {commonItems.map((si, i) => (
                <ItemBubble
                  key={si.item_id}
                  storeItem={si}
                  index={i}
                  onAdd={handleAddItem}
                />
              ))}
            </AnimatePresence>

            {/* "Other" bubble */}
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: (commonItems.length) * 0.05, type: 'spring' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowOtherSheet(true)}
              className="w-24 h-24 rounded-full bg-gray-200 flex flex-col items-center justify-center shadow-md"
            >
              <span className="text-2xl">📋</span>
              <span className="text-xs text-gray-600 mt-1 font-medium">Other</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* List strip at bottom */}
      {phase === 'item-select' && activeStoreListItems.length > 0 && (
        <ListStrip
          items={activeStoreListItems}
          onRemove={removeItem}
        />
      )}

      {/* Other items bottom sheet */}
      <OtherItemsSheet
        isOpen={showOtherSheet}
        onClose={() => setShowOtherSheet(false)}
        allItems={allItems}
        addedItemIds={addedItemIds}
        onAdd={handleAddItem}
        storeId={selectedStoreId || ''}
        householdId={householdId || ''}
      />
    </div>
  )
}
