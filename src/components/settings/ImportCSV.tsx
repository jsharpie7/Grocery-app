import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useHouseholdStore } from '../../store/householdStore'
import { useStores } from '../../hooks/useStores'

type ParsedRow = {
  item_name: string
  store_name: string
  category: string
  unit: string
  photo_filename: string
}

export default function ImportCSV() {
  const { householdId, categories } = useHouseholdStore()
  const { stores, addStore } = useStores()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    return lines.slice(1).map(line => {
      const parts = line.split(',').map(p => p.trim())
      return {
        item_name: parts[0] || '',
        store_name: parts[1] || '',
        category: parts[2] || '',
        unit: parts[3] || 'ea',
        photo_filename: parts[4] || '',
      }
    }).filter(r => r.item_name)
  }

  function handleCSVSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setResult(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string)
      setParsed(rows)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!householdId || parsed.length === 0) return
    setImporting(true)

    let imported = 0
    let errors = 0

    // Build lookup maps
    const storeMap: Record<string, string> = {}
    for (const s of stores) storeMap[s.name.toLowerCase()] = s.id

    const categoryMap: Record<string, string> = {}
    for (const c of categories) categoryMap[c.name.toLowerCase()] = c.id

    for (const row of parsed) {
      try {
        // Ensure store exists
        const storeKey = row.store_name.toLowerCase()
        if (!storeMap[storeKey] && row.store_name) {
          const newStore = await addStore(row.store_name, '#6366f1')
          if (newStore) storeMap[storeKey] = newStore.id
        }
        const storeId = storeMap[storeKey]

        // Find category
        const catId = categoryMap[row.category.toLowerCase()] || null

        // Upsert item
        const { data: item, error: itemError } = await supabase
          .from('items')
          .upsert({
            household_id: householdId,
            name: row.item_name,
            category_id: catId,
          }, { onConflict: 'household_id,name' } as any)
          .select()
          .single()

        if (itemError || !item) { errors++; continue }

        // Upsert store_item
        if (storeId) {
          await supabase.from('store_items').upsert({
            store_id: storeId,
            item_id: item.id,
            unit: row.unit || 'ea',
            typical_quantity: 1,
          }, { onConflict: 'store_id,item_id' })
        }

        imported++
      } catch {
        errors++
      }
    }

    setImporting(false)
    setResult({ imported, errors })
    setParsed([])
    setCsvFile(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2">CSV Format</h3>
        <pre className="text-xs bg-gray-50 rounded-lg p-3 text-gray-600 overflow-x-auto">
{`item_name, store_name, category, unit, photo_filename
Whole Milk, Aldi, Dairy & Eggs, gallon, whole_milk.jpg
Chicken Breast, Publix, Meat & Seafood, lb, chicken.jpg`}
        </pre>
        <p className="text-xs text-gray-400 mt-2">
          Headers required. Category must match exactly (e.g. "Dairy & Eggs").
        </p>
      </div>

      {/* File picker */}
      <button
        onClick={() => csvRef.current?.click()}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-medium flex flex-col items-center gap-1"
      >
        <span className="text-3xl">📄</span>
        <span className="text-sm">{csvFile ? csvFile.name : 'Choose CSV file'}</span>
      </button>
      <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleCSVSelect} className="hidden" />

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-600">{parsed.length} rows to import</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto no-scrollbar">
            {parsed.slice(0, 10).map((row, i) => (
              <div key={i} className="px-4 py-2 text-sm">
                <span className="font-medium text-gray-800">{row.item_name}</span>
                <span className="text-gray-400 mx-1">@</span>
                <span className="text-gray-600">{row.store_name}</span>
                {row.category && (
                  <span className="text-gray-400 ml-2 text-xs">({row.category})</span>
                )}
              </div>
            ))}
            {parsed.length > 10 && (
              <div className="px-4 py-2 text-xs text-gray-400">
                +{parsed.length - 10} more rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import button */}
      {parsed.length > 0 && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleImport}
          disabled={importing}
          className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-semibold shadow-lg disabled:opacity-60"
        >
          {importing ? 'Importing...' : `Import ${parsed.length} Items`}
        </motion.button>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 rounded-2xl p-4 text-center"
        >
          <p className="text-emerald-700 font-semibold">
            ✓ {result.imported} items imported
          </p>
          {result.errors > 0 && (
            <p className="text-red-500 text-sm mt-1">{result.errors} errors</p>
          )}
        </motion.div>
      )}
    </div>
  )
}
