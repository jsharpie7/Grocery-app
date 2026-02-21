import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useHouseholdStore } from '../store/householdStore'
import { useListItems } from '../hooks/useListItems'

export default function Home() {
  const navigate = useNavigate()
  const { stores } = useHouseholdStore()
  const { listItems } = useListItems()

  const totalItems = listItems.filter(i => !i.is_checked).length

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Grocery</h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-600"
        >
          ⚙️
        </motion.button>
      </div>

      {/* Bottom nav */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/insights')}
          className="px-6 py-3 rounded-full bg-white shadow-md text-gray-600 font-medium text-sm"
        >
          📊 Insights
        </motion.button>
      </div>

      {/* Main bubbles */}
      <div className="flex flex-col items-center gap-8 bubbles-container">
        {/* Add to List bubble */}
        <motion.button
          onClick={() => navigate('/add')}
          className="relative w-52 h-52 rounded-full bg-indigo-500 bubble-shadow flex flex-col items-center justify-center text-white"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-4xl mb-2">+</span>
          <span className="font-semibold text-lg">Add to List</span>
          {totalItems > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-4 right-4 bg-white text-indigo-500 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow"
            >
              {totalItems}
            </motion.span>
          )}
        </motion.button>

        {/* Shop bubble */}
        <motion.button
          onClick={() => navigate('/shop')}
          className="relative w-44 h-44 rounded-full bg-emerald-500 bubble-shadow flex flex-col items-center justify-center text-white"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-3xl mb-2">🛒</span>
          <span className="font-semibold text-lg">Shop</span>
        </motion.button>
      </div>

      {/* Store count chips */}
      {stores.length > 0 && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 px-4">
          {stores.map(store => {
            const count = listItems.filter(i => i.store_id === store.id && !i.is_checked).length
            if (count === 0) return null
            return (
              <motion.div
                key={store.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-md"
                style={{ backgroundColor: store.color }}
              >
                {store.name}: {count}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
