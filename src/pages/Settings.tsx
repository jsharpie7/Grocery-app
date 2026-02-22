import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import StoreManager from '../components/settings/StoreManager'
import ItemManager from '../components/settings/ItemManager'
import ImportCSV from '../components/settings/ImportCSV'
import PhotoImport from '../components/settings/PhotoImport'
import HouseholdCode from '../components/settings/HouseholdCode'

type Tab = 'stores' | 'items' | 'import' | 'household'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stores', label: 'Stores', icon: '🏪' },
  { id: 'items', label: 'Items', icon: '🛍️' },
  { id: 'import', label: 'Import', icon: '📥' },
  { id: 'household', label: 'Household', icon: '🏠' },
]

export default function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('stores')
  const [importMode, setImportMode] = useState<'csv' | 'photos'>('csv')

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-3 bg-white shadow-sm">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl mr-3"
        >
          ←
        </motion.button>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white border-b border-gray-100 px-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-600 border-b-2 border-indigo-500'
                : 'text-gray-500'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'stores' && <StoreManager />}
            {activeTab === 'items' && <ItemManager />}
            {activeTab === 'import' && (
              <div>
                {/* CSV / Photos sub-toggle */}
                <div className="px-4 pt-4 pb-2">
                  <div className="bg-gray-100 rounded-xl p-1 flex">
                    <button
                      onClick={() => setImportMode('csv')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        importMode === 'csv' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      📄 CSV
                    </button>
                    <button
                      onClick={() => setImportMode('photos')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        importMode === 'photos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      📷 Photos
                    </button>
                  </div>
                </div>
                {importMode === 'csv' ? <ImportCSV /> : <PhotoImport />}
              </div>
            )}
            {activeTab === 'household' && <HouseholdCode />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
