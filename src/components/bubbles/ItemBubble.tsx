import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StoreItem } from '../../lib/supabase'

const LONG_PRESS_MS = 500

interface Props {
  storeItem: StoreItem
  index: number
  onAdd: (itemId: string, quantity: number, unit: string) => Promise<void>
}

export default function ItemBubble({ storeItem, index, onAdd }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [quantity, setQuantity] = useState(storeItem.typical_quantity || 1)
  const [adding, setAdding] = useState(false)
  const item = storeItem.item
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  if (!item) return null

  async function handleShortPress() {
    if (adding) return
    setAdding(true)
    await onAdd(storeItem.item_id, quantity, storeItem.unit)
    setAdding(false)
  }

  async function handleConfirm() {
    setExpanded(false)
    await onAdd(storeItem.item_id, quantity, storeItem.unit)
  }

  const handlePressStart = useCallback(() => {
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      setExpanded(true)
    }, LONG_PRESS_MS)
  }, [])

  const handlePressEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!didLongPress.current) {
      handleShortPress()
    }
  }, [])

  const handlePressCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    didLongPress.current = false
  }, [])

  return (
    <motion.div
      layout
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0, y: 60 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 280 }}
    >
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            className="w-28 h-28 rounded-2xl bg-white shadow-lg flex flex-col items-center justify-center gap-1 p-2"
          >
            <p className="text-xs font-medium text-gray-700 text-center leading-tight truncate w-full text-center">
              {item.name}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(q => Math.max(0.5, q - (q > 1 ? 1 : 0.5)))}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg"
              >
                −
              </button>
              <span className="text-sm font-semibold text-gray-800 w-8 text-center">
                {quantity % 1 === 0 ? quantity : quantity.toFixed(1)}
              </span>
              <button
                onClick={() => setQuantity(q => q + (q >= 1 ? 1 : 0.5))}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg"
              >
                +
              </button>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setExpanded(false)}
                className="px-2 py-1 rounded-full bg-gray-200 text-gray-600 text-xs"
              >
                ✕
              </button>
              <button
                onClick={handleConfirm}
                className="px-2 py-1 rounded-full bg-indigo-500 text-white text-xs font-semibold"
              >
                Add
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            whileTap={{ scale: 0.9 }}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressCancel}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressCancel}
            onContextMenu={e => { e.preventDefault(); setExpanded(true) }}
            className={`relative w-24 h-24 rounded-full shadow-md flex flex-col items-center justify-center overflow-hidden bg-white ${adding ? 'opacity-50' : ''}`}
          >
            {item.photo_url ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${item.photo_url})` }}
              />
            ) : (
              <span className="text-3xl">{item.category?.icon || '🛒'}</span>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-1 py-1">
              <p className="text-white text-xs text-center font-medium leading-tight truncate">
                {item.name}
              </p>
            </div>
            {storeItem.typical_quantity > 1 && (
              <span className="absolute top-1 right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {storeItem.typical_quantity}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
