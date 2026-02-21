import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ListItem } from '../../lib/supabase'

interface Props {
  items: ListItem[]
  onRemove: (id: string) => void
}

export default function ListStrip({ items, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="absolute bottom-0 left-0 right-0 z-20"
    >
      {/* Collapsed strip */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="w-full frosted border-t border-white/30 px-4 py-3 flex items-center gap-2"
      >
        <span className="text-sm font-semibold text-gray-700">
          {items.length} item{items.length !== 1 ? 's' : ''} added
        </span>
        <div className="flex-1 flex gap-1.5 overflow-hidden">
          {items.slice(0, 5).map(item => (
            <span
              key={item.id}
              className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium whitespace-nowrap"
            >
              {item.item?.name || '?'}
            </span>
          ))}
          {items.length > 5 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
              +{items.length - 5}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '↓' : '↑'}</span>
      </motion.button>

      {/* Expanded list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="frosted border-t border-white/20 overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto no-scrollbar divide-y divide-gray-100/50">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.item?.category?.icon || '🛒'}</span>
                    <span className="text-sm font-medium text-gray-800">{item.item?.name}</span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-gray-500">×{item.quantity}</span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
