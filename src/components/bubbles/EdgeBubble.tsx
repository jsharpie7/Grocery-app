import { motion } from 'framer-motion'
import type { Store } from '../../lib/supabase'

interface Props {
  store: Store
  itemCount: number
  onSelect: () => void
}

export default function EdgeBubble({ store, itemCount, onSelect }: Props) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onSelect}
      className="relative w-14 h-14 rounded-full shadow-md flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: store.color }}
    >
      {store.logo_url ? (
        <img src={store.logo_url} alt={store.name} className="w-10 h-10 object-contain rounded-full" />
      ) : (
        <span className="text-xl">🏪</span>
      )}
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow" style={{ color: store.color }}>
          {itemCount}
        </span>
      )}
    </motion.button>
  )
}
