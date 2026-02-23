import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useHouseholdStore } from '../../store/householdStore'
import { useStores } from '../../hooks/useStores'
import { extractItemsFromImage, type ExtractedItem } from '../../lib/gemini'

const CATEGORIES = [
  'Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry',
  'Beverages', 'Snacks', 'Household', 'Personal Care', 'Baby', 'Pet', 'Other',
]

export default function PhotoImport() {
  const { householdId, categories, geminiKey, setGeminiKey } = useHouseholdStore()
  const { stores, addStore } = useStores()

  const [photoType, setPhotoType] = useState<'shelf' | 'receipt'>('shelf')
  const [photos, setPhotos] = useState<File[]>([])
  const [extracting, setExtracting] = useState(false)
  const [rows, setRows] = useState<ExtractedItem[]>([])
  const [hasExtracted, setHasExtracted] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number; noStore: number } | null>(null)
  const [importErrorDetail, setImportErrorDetail] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [fallbackStore, setFallbackStore] = useState<string>('')

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  async function doExtract(photoList: File[]) {
    if (photoList.length === 0 || !geminiKey) return
    setExtracting(true)
    setError(null)
    setRows([])
    setHasExtracted(false)

    try {
      const results = await Promise.all(
        photoList.map(f => extractItemsFromImage(f, photoType, geminiKey))
      )
      const merged = results.flat()

      const seen = new Set<string>()
      const deduped = merged.filter(item => {
        const key = `${item.item_name.toLowerCase()}|${item.store_name.toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setRows(deduped)
      setHasExtracted(true)
    } catch (e) {
      console.error('[PhotoImport] Gemini error:', e)
      setError(e instanceof Error ? e.message : 'Extraction failed. Try again.')
      setHasExtracted(true)
    } finally {
      setExtracting(false)
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    const newList = [...photos, ...Array.from(files)]
    console.log('[PhotoImport] files received:', newList.map(f => `${f.name} (${(f.size / 1024).toFixed(0)} KB)`))
    setPhotos(newList)
    setResult(null)
    setRows([])
    setHasExtracted(false)
    setError(null)
    await doExtract(newList)
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setRows([])
    setHasExtracted(false)
    setError(null)
  }

  function applyStoreToAll(storeName: string) {
    setFallbackStore(storeName)
    setRows(prev => prev.map(row => ({ ...row, store_name: storeName })))
  }

  function updateRow(index: number, field: keyof ExtractedItem, value: string | number | null) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function removeRow(index: number) {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  async function handleImport() {
    if (!householdId || rows.length === 0) return
    setImporting(true)
    setResult(null)
    setImportErrorDetail('')

    let imported = 0
    let errors = 0
    let noStore = 0
    let firstError = ''

    const storeMap: Record<string, string> = {}
    for (const s of stores) storeMap[s.name.toLowerCase()] = s.id

    const categoryMap: Record<string, string> = {}
    for (const c of categories) categoryMap[c.name.toLowerCase()] = c.id

    for (const row of rows) {
      try {
        const storeKey = row.store_name.toLowerCase()
        if (!storeMap[storeKey] && row.store_name && row.store_name !== 'Unknown') {
          const newStore = await addStore(row.store_name, '#6366f1')
          if (newStore) storeMap[storeKey] = newStore.id
        }
        const storeId = storeMap[storeKey]

        const catId = categoryMap[row.category.toLowerCase()] || null

        // Find or create item (select-then-insert avoids needing a unique constraint)
        let { data: item, error: fetchErr } = await supabase
          .from('items')
          .select()
          .eq('household_id', householdId)
          .eq('name', row.item_name)
          .maybeSingle()

        if (fetchErr) {
          firstError = firstError || `Fetch: ${fetchErr.message}`
          console.error('[PhotoImport] item fetch error:', fetchErr, 'row:', row)
          errors++
          continue
        }

        if (!item) {
          const { data: newItem, error: insertErr } = await supabase
            .from('items')
            .insert({ household_id: householdId, name: row.item_name, category_id: catId })
            .select()
            .single()
          if (insertErr || !newItem) {
            firstError = firstError || `Insert: ${insertErr?.message ?? 'no data returned'}`
            console.error('[PhotoImport] item insert error:', insertErr, 'row:', row)
            errors++
            continue
          }
          item = newItem
        }

        if (storeId) {
          await supabase.from('store_items').upsert({
            store_id: storeId,
            item_id: item.id,
            unit: row.unit || 'ea',
            typical_quantity: row.typical_quantity || 1,
            typical_price: row.typical_price,
          }, { onConflict: 'store_id,item_id' })
        } else {
          console.warn('[PhotoImport] no store for item:', row.item_name, '— store_name was:', JSON.stringify(row.store_name))
          noStore++
        }

        imported++
      } catch (err) {
        firstError = firstError || String(err)
        console.error('[PhotoImport] unexpected error on row:', row, err)
        errors++
      }
    }

    setImporting(false)
    setImportErrorDetail(firstError)
    setResult({ imported, errors, noStore })
    setRows([])
    setPhotos([])
    setHasExtracted(false)
  }

  // API key setup screen
  if (!geminiKey) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Gemini API Key Required</h3>
            <p className="text-sm text-gray-500">
              Photo scanning uses Google Gemini AI. Get a free key at{' '}
              <span className="text-indigo-600 font-medium">aistudio.google.com/app/apikey</span>
            </p>
          </div>
          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="AIza..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setGeminiKey(apiKeyInput.trim())}
            disabled={!apiKeyInput.trim()}
            className="w-full py-3 bg-indigo-500 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Save Key
          </motion.button>
        </div>

        <div className="bg-indigo-50 rounded-2xl p-4 text-sm text-indigo-700 space-y-1">
          <p className="font-medium">How to get your key:</p>
          <p>1. Go to aistudio.google.com/app/apikey</p>
          <p>2. Sign in with your Google account</p>
          <p>3. Click "Create API key" → copy it</p>
          <p>4. Paste it above and tap Save</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* API key indicator */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>Gemini key: ····{geminiKey.slice(-4)}</span>
        <span className="text-gray-200 select-none">v8</span>
        <button onClick={() => setGeminiKey('')} className="text-red-400 font-medium">
          Remove key
        </button>
      </div>

      {/* Photo type toggle */}
      <div className="bg-white rounded-2xl p-1 shadow-sm flex">
        {(['shelf', 'receipt'] as const).map(type => (
          <button
            key={type}
            onClick={() => setPhotoType(type)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              photoType === type ? 'bg-indigo-500 text-white' : 'text-gray-500'
            }`}
          >
            {type === 'shelf' ? '🏷 Shelf Labels' : '🧾 Receipt'}
          </button>
        ))}
      </div>

      {/* Upload buttons — always visible */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={extracting}
          className="py-5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-medium flex flex-col items-center gap-1.5 active:bg-gray-50 disabled:opacity-40"
        >
          <span className="text-3xl">📷</span>
          <span className="text-xs">Take Photo</span>
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          disabled={extracting}
          className="py-5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-medium flex flex-col items-center gap-1.5 active:bg-gray-50 disabled:opacity-40"
        >
          <span className="text-3xl">🖼️</span>
          <span className="text-xs">Choose from Gallery</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={e => { addPhotos(e.target.files); e.target.value = '' }}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => { addPhotos(e.target.files); e.target.value = '' }}
        className="hidden"
      />

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((photo, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(photo)}
                alt=""
                className="w-20 h-20 object-cover rounded-xl"
              />
              {!extracting && (
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Scanning indicator */}
      {extracting && (
        <div className="bg-indigo-50 rounded-2xl px-4 py-5 flex items-center gap-3">
          <div className="text-2xl animate-pulse">✨</div>
          <div>
            <p className="text-sm font-medium text-indigo-700">Scanning with Gemini AI…</p>
            <p className="text-xs text-indigo-400 mt-0.5">This takes about 5–10 seconds</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 rounded-2xl p-4 text-red-600 text-sm space-y-2"
        >
          <p className="font-medium">{error}</p>
          {photos.length > 0 && (
            <button
              onClick={() => doExtract(photos)}
              className="text-red-500 underline text-xs"
            >
              Retry scan
            </button>
          )}
        </motion.div>
      )}

      {/* No items found */}
      {hasExtracted && !extracting && !error && rows.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 rounded-2xl p-4 text-amber-700 text-sm space-y-2"
        >
          <p className="font-medium">No items detected in this photo.</p>
          <p className="text-xs text-amber-600">Try a clearer, better-lit photo. Check browser DevTools → Console for details.</p>
          {photos.length > 0 && (
            <button
              onClick={() => doExtract(photos)}
              className="text-amber-600 underline text-xs"
            >
              Retry scan
            </button>
          )}
        </motion.div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{rows.length} items found</span>
              <button
                onClick={() => setRows(prev => [...prev, {
                  item_name: '', store_name: fallbackStore, category: 'Other',
                  typical_price: null, unit: 'ea', typical_quantity: 1,
                }])}
                className="text-indigo-500 text-sm font-medium"
              >
                + Add row
              </button>
            </div>
            {stores.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">Link all to:</span>
                <select
                  value={fallbackStore}
                  onChange={e => applyStoreToAll(e.target.value)}
                  className="flex-1 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                >
                  <option value="">— pick a store —</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-left">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <input
                        value={row.item_name}
                        onChange={e => updateRow(i, 'item_name', e.target.value)}
                        className="w-full min-w-[100px] text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.store_name}
                        onChange={e => updateRow(i, 'store_name', e.target.value)}
                        className="w-full min-w-[70px] text-gray-600 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category}
                        onChange={e => updateRow(i, 'category', e.target.value)}
                        className="text-gray-600 bg-transparent border-b border-transparent focus:outline-none py-0.5 text-xs max-w-[90px]"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.typical_price ?? ''}
                        onChange={e => updateRow(i, 'typical_price', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-14 text-gray-600 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.unit}
                        onChange={e => updateRow(i, 'unit', e.target.value)}
                        className="w-10 text-gray-600 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={row.typical_quantity}
                        onChange={e => updateRow(i, 'typical_quantity', parseInt(e.target.value) || 1)}
                        className="w-9 text-gray-600 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-red-400 text-lg leading-none"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scan more / Import buttons */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => { setRows([]); setPhotos([]); setHasExtracted(false); setFallbackStore('') }}
            className="w-full py-3 border-2 border-gray-200 text-gray-500 rounded-2xl font-medium text-sm"
          >
            Clear & Scan More Photos
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleImport}
            disabled={importing}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-semibold shadow-lg disabled:opacity-60"
          >
            {importing ? 'Importing…' : `Import ${rows.length} Items`}
          </motion.button>
        </div>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 rounded-2xl p-4 text-center space-y-1"
        >
          <p className="text-emerald-700 font-semibold text-lg">
            ✓ {result.imported} item{result.imported !== 1 ? 's' : ''} imported
          </p>
          {result.noStore > 0 && (
            <p className="text-amber-600 text-sm">
              ⚠ {result.noStore} item{result.noStore !== 1 ? 's' : ''} saved without a store — use "Link all to:" next time so they appear in AddToList.
            </p>
          )}
          {result.errors > 0 && (
            <div>
              <p className="text-red-500 text-sm">{result.errors} rows had errors</p>
              {importErrorDetail && (
                <p className="text-red-400 text-xs font-mono bg-red-50 rounded-lg p-2 mt-1 text-left break-all">
                  {importErrorDetail}
                </p>
              )}
            </div>
          )}
          {result.noStore === 0 && result.errors === 0 && (
            <p className="text-emerald-600 text-sm">
              They'll appear in AddToList under the correct store.
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}
