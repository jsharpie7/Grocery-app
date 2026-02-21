import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useHouseholdStore } from '../store/householdStore'
import { useListItems } from '../hooks/useListItems'
import { useTrips } from '../hooks/useTrips'
import { useSmartOrder } from '../hooks/useSmartOrder'
import Stopwatch from '../components/shop/Stopwatch'
import TripSummary from '../components/shop/TripSummary'
import type { ListItem } from '../lib/supabase'

export default function Shop() {
  const navigate = useNavigate()
  const { stores } = useHouseholdStore()
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'store-select' | 'shopping' | 'done'>('store-select')
  const [sortedItems, setSortedItems] = useState<ListItem[]>([])
  const [checkedItems, setCheckedItems] = useState<ListItem[]>([])
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  const { listItems, checkItem, clearStore } = useListItems(selectedStoreId || undefined)
  const { startTrip, endTrip, currentTrip } = useTrips()
  const { sortByShoppingPath } = useSmartOrder(selectedStoreId || '')

  const activeItems = listItems.filter(i => !i.is_checked && i.store_id === selectedStoreId)

  async function handleSelectStore(storeId: string) {
    setSelectedStoreId(storeId)
    setPhase('shopping')
    setStartTime(new Date())
    await startTrip(storeId)
  }

  useEffect(() => {
    if (selectedStoreId && activeItems.length > 0) {
      sortByShoppingPath(activeItems).then(setSortedItems)
    } else {
      setSortedItems(activeItems)
    }
  }, [listItems, selectedStoreId])

  async function handleCheckItem(item: ListItem) {
    await checkItem(item.id, true)
    setCheckedItems(prev => [...prev, { ...item, is_checked: true }])

    if (activeItems.length <= 1) {
      setPhase('done')
      setShowSummary(true)
    }
  }

  async function handleFinishTrip(totalSpent?: number, receiptUrl?: string) {
    if (currentTrip) {
      await endTrip(currentTrip.id, checkedItems, totalSpent, receiptUrl)
    }
    if (selectedStoreId) {
      await clearStore(selectedStoreId)
    }
    navigate('/')
  }

  // Group items by category
  const grouped = sortedItems.reduce<Record<string, ListItem[]>>((acc, item) => {
    const cat = item.item?.category?.name || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-white shadow-sm">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl"
        >
          ←
        </motion.button>

        {phase === 'shopping' && selectedStoreId && (
          <div className="flex items-center gap-3">
            <Stopwatch startTime={startTime} running={phase === 'shopping'} />
            <div
              className="px-3 py-1 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: stores.find(s => s.id === selectedStoreId)?.color || '#6366f1' }}
            >
              {stores.find(s => s.id === selectedStoreId)?.name}
            </div>
          </div>
        )}

        {phase === 'shopping' && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setPhase('done'); setShowSummary(true) }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-semibold"
          >
            Done
          </motion.button>
        )}

        {phase === 'store-select' && (
          <h2 className="text-xl font-bold text-gray-900">Shop</h2>
        )}
      </div>

      {/* Store Select */}
      {phase === 'store-select' && (
        <div className="flex-1 flex flex-wrap items-center justify-center gap-6 p-6 bubbles-container">
          {stores.length === 0 ? (
            <div className="text-center text-gray-400">
              <p>No stores yet. Add some in Settings.</p>
            </div>
          ) : (
            stores.map((store, i) => {
              const count = listItems.filter(l => l.store_id === store.id && !l.is_checked).length
              return (
                <motion.button
                  key={store.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.06, type: 'spring' }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleSelectStore(store.id)}
                  className="relative w-36 h-36 rounded-full shadow-lg flex flex-col items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: store.color }}
                >
                  <span className="text-3xl mb-1">🏪</span>
                  <span className="text-sm">{store.name}</span>
                  {count > 0 && (
                    <span className="absolute top-2 right-2 bg-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center" style={{ color: store.color }}>
                      {count}
                    </span>
                  )}
                </motion.button>
              )
            })
          )}
        </div>
      )}

      {/* Shopping mode */}
      {phase === 'shopping' && (
        <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
          {sortedItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
              <p className="text-lg">No items on list!</p>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setPhase('done'); setShowSummary(true) }}
                className="mt-4 px-6 py-3 bg-emerald-500 text-white rounded-full font-semibold"
              >
                Finish Trip
              </motion.button>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-gray-100 sticky top-0 z-10">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {items[0]?.item?.category?.icon || '🛒'} {category}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 p-4 bubbles-container">
                  <AnimatePresence>
                    {items.map(item => (
                      <motion.button
                        key={item.id}
                        layout
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.15, opacity: 0, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleCheckItem(item)}
                        className="relative w-24 h-24 rounded-full shadow-md flex flex-col items-center justify-center overflow-hidden bg-white"
                      >
                        {item.item?.photo_url ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${item.item.photo_url})` }}
                          />
                        ) : (
                          <span className="text-3xl">{item.item?.category?.icon || '🛒'}</span>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/30 px-1 py-0.5">
                          <p className="text-white text-xs text-center font-medium truncate">
                            {item.item?.name}
                          </p>
                        </div>
                        {item.quantity > 1 && (
                          <span className="absolute top-1 right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {item.quantity}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Trip summary sheet */}
      {showSummary && (
        <TripSummary
          startTime={startTime}
          checkedCount={checkedItems.length}
          storeName={stores.find(s => s.id === selectedStoreId)?.name || ''}
          tripId={currentTrip?.id || null}
          onFinish={handleFinishTrip}
        />
      )}
    </div>
  )
}
