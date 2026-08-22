import { useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractReceiptFromImage, getLastScanDiagnostics, type ScanDiagnostics, type ScanError } from '../lib/gemini'
import { normalizeStoreName } from '../lib/itemMatcher'
import { useReceipts, type PendingLineItem } from '../hooks/useReceipts'
import { useStores } from '../hooks/useStores'
import { useHouseholdStore } from '../store/householdStore'
import StorePicker from '../components/receipts/StorePicker'
import LineItemRow from '../components/receipts/LineItemRow'
import TotalMismatchWarning from '../components/receipts/TotalMismatchWarning'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import ScanDetails from '../components/receipts/ScanDetails'

type Step = 'capture' | 'extracting' | 'review' | 'saving' | 'done'

interface State {
  step: Step
  imageFile: File | null
  imagePreview: string | null
  extractError: string | null
  saveError: string | null
  isDuplicate: boolean
  storeId: string | null
  storeName: string
  receiptDate: string
  totalAmount: string
  taxAmount: string
  items: PendingLineItem[]
  imageUploadFailed: boolean
  geminiKeyMissing: boolean
  geminiKeyInput: string
  scanDiagnostics: ScanDiagnostics | null
}

type Action =
  | { type: 'SET_FILE'; file: File; preview: string }
  | { type: 'EXTRACT_START' }
  | { type: 'EXTRACT_SUCCESS'; storeName: string; receiptDate: string; totalAmount: string; taxAmount: string; items: PendingLineItem[] }
  | { type: 'EXTRACT_ERROR'; error: string; diagnostics: ScanDiagnostics | null }
  | { type: 'RETRY_EXTRACT' }
  | { type: 'SET_STORE'; storeId: string | null; storeName: string }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_TOTAL'; total: string }
  | { type: 'SET_TAX'; tax: string }
  | { type: 'UPDATE_ITEM'; index: number; updates: Partial<PendingLineItem> }
  | { type: 'REMOVE_ITEM'; index: number }
  | { type: 'ADD_ITEM' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_ERROR'; error: string; isDuplicate?: boolean }
  | { type: 'SAVE_SUCCESS'; imageUploadFailed: boolean }
  | { type: 'FORCE_SAVE' }
  | { type: 'SET_GEMINI_KEY_INPUT'; value: string }
  | { type: 'GEMINI_KEY_SET' }

function today() {
  return new Date().toISOString().split('T')[0]
}

const initial: State = {
  step: 'capture',
  imageFile: null,
  imagePreview: null,
  extractError: null,
  saveError: null,
  isDuplicate: false,
  storeId: null,
  storeName: '',
  receiptDate: today(),
  totalAmount: '',
  taxAmount: '',
  items: [],
  imageUploadFailed: false,
  geminiKeyMissing: false,
  geminiKeyInput: '',
  scanDiagnostics: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FILE':
      return { ...state, imageFile: action.file, imagePreview: action.preview }
    case 'EXTRACT_START':
      return { ...state, step: 'extracting', extractError: null, scanDiagnostics: null }
    case 'EXTRACT_SUCCESS':
      return {
        ...state, step: 'review',
        storeName: action.storeName,
        receiptDate: action.receiptDate || today(),
        totalAmount: action.totalAmount,
        taxAmount: action.taxAmount,
        items: action.items,
        extractError: null,
        scanDiagnostics: null,
      }
    case 'EXTRACT_ERROR':
      return { ...state, step: 'capture', extractError: action.error, scanDiagnostics: action.diagnostics }
    case 'RETRY_EXTRACT':
      return { ...state, step: 'capture', extractError: null, scanDiagnostics: null }
    case 'SET_STORE':
      return { ...state, storeId: action.storeId, storeName: action.storeName }
    case 'SET_DATE':
      return { ...state, receiptDate: action.date }
    case 'SET_TOTAL':
      return { ...state, totalAmount: action.total }
    case 'SET_TAX':
      return { ...state, taxAmount: action.tax }
    case 'UPDATE_ITEM':
      return { ...state, items: state.items.map((it, i) => i === action.index ? { ...it, ...action.updates } : it) }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, i) => i !== action.index) }
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, { item_number: null, ocr_name: null, item_name: '', quantity: 1, unit: 'ea', unit_price: null, total_price: null, category: 'Other', matchedItemId: null, prevAvgPrice: null }] }
    case 'SAVE_START':
      return { ...state, step: 'saving', saveError: null, isDuplicate: false }
    case 'SAVE_ERROR':
      return { ...state, step: 'review', saveError: action.error, isDuplicate: !!action.isDuplicate }
    case 'SAVE_SUCCESS':
      return { ...state, step: 'done', imageUploadFailed: action.imageUploadFailed }
    case 'FORCE_SAVE':
      return { ...state, isDuplicate: false, saveError: null }
    case 'SET_GEMINI_KEY_INPUT':
      return { ...state, geminiKeyInput: action.value }
    case 'GEMINI_KEY_SET':
      return { ...state, geminiKeyMissing: false, geminiKeyInput: '' }
    default:
      return state
  }
}

export default function NewReceiptPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, dispatch] = useReducer(reducer, initial)
  const { createReceipt, resolveStoreId, resolveAliasesForReview } = useReceipts()
  const { createStore } = useStores()
  const { geminiKey, setGeminiKey } = useHouseholdStore()

  function handleFileSelect(file: File) {
    const preview = URL.createObjectURL(file)
    dispatch({ type: 'SET_FILE', file, preview })
    startExtract(file)
  }

  async function startExtract(file: File) {
    const key = geminiKey.trim()
    if (!key) {
      dispatch({ type: 'EXTRACT_ERROR', error: 'Gemini API key required. Enter your key below.', diagnostics: null })
      return
    }
    dispatch({ type: 'EXTRACT_START' })
    try {
      const data = await extractReceiptFromImage(file, key)

      // Auto-match store
      const stores = useHouseholdStore.getState().stores
      let matchedStoreId: string | null = null
      if (data.store_name) {
        const norm = normalizeStoreName(data.store_name)
        const found = stores.find((s) => normalizeStoreName(s.name) === norm)
        if (found) matchedStoreId = found.id
      }

      // Safe date parse
      let parsedDate = today()
      if (data.receipt_date) {
        const d = new Date(data.receipt_date + 'T12:00:00')
        if (!isNaN(d.getTime())) parsedDate = data.receipt_date
      }

      const pendingItems = await resolveAliasesForReview(data.items, matchedStoreId)

      dispatch({
        type: 'EXTRACT_SUCCESS',
        storeName: data.store_name,
        receiptDate: parsedDate,
        totalAmount: data.total_amount != null ? String(data.total_amount) : '',
        taxAmount: data.tax_amount != null ? String(data.tax_amount) : '',
        items: pendingItems,
      })

      if (matchedStoreId) {
        const store = stores.find((s) => s.id === matchedStoreId)
        if (store) dispatch({ type: 'SET_STORE', storeId: matchedStoreId, storeName: store.name })
      }
    } catch (e) {
      dispatch({
        type: 'EXTRACT_ERROR',
        error: (e as Error).message,
        diagnostics: (e as ScanError).diagnostics ?? getLastScanDiagnostics(),
      })
    }
  }

  async function handleSave(force = false) {
    if (state.items.length === 0) {
      dispatch({ type: 'SAVE_ERROR', error: 'Receipt must have at least 1 item.' })
      return
    }

    // Client-side duplicate check
    if (!force && state.isDuplicate) return

    const total = parseFloat(state.totalAmount)
    const tax = parseFloat(state.taxAmount || '0')
    if (isNaN(total) || total <= 0) {
      dispatch({ type: 'SAVE_ERROR', error: 'Enter a valid receipt total.' })
      return
    }

    dispatch({ type: 'SAVE_START' })

    try {
      let storeId = state.storeId
      if (!storeId && state.storeName.trim()) {
        storeId = await resolveStoreId(state.storeName)
      }

      const { imageUploadFailed } = await createReceipt({
        storeId,
        receiptDate: state.receiptDate,
        totalAmount: total,
        taxAmount: isNaN(tax) ? 0 : tax,
        items: state.items.filter((i) => i.item_name.trim()),
        imageFile: state.imageFile,
      })

      dispatch({ type: 'SAVE_SUCCESS', imageUploadFailed })
      setTimeout(() => navigate('/receipts'), 1500)
    } catch (e) {
      const err = e as Error & { code?: string; isDuplicate?: boolean }
      const isDup = err.isDuplicate || err.code === '23505'
      dispatch({
        type: 'SAVE_ERROR',
        error: isDup
          ? 'A receipt with this date and total already exists. Edit the date or total to save it as a separate receipt.'
          : err.message,
        isDuplicate: isDup,
      })
    }
  }

  function saveGeminiKey() {
    setGeminiKey(state.geminiKeyInput.trim())
    dispatch({ type: 'GEMINI_KEY_SET' })
    if (state.imageFile) startExtract(state.imageFile)
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  if (state.step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-6xl mb-4">✅</div>
        <div className="text-xl font-semibold text-gray-800 mb-1">Receipt Saved!</div>
        {state.imageUploadFailed && (
          <p className="text-sm text-yellow-600 mt-2">Image upload failed — receipt saved without photo.</p>
        )}
      </div>
    )
  }

  if (state.step === 'extracting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Spinner size="lg" />
        <p className="text-gray-600 text-sm">Scanning with Gemini…</p>
        <p className="text-gray-400 text-xs">Large receipts can take up to 45 seconds</p>
      </div>
    )
  }

  const itemSum = state.items.reduce((s, i) => s + Number(i.total_price ?? i.unit_price ?? 0), 0)
  const taxAmt = parseFloat(state.taxAmount || '0') || 0
  const totalAmt = parseFloat(state.totalAmount || '0') || 0
  const suspectCount = state.items.filter(i => {
    if (i.unit_price == null || i.total_price == null) return false
    const expected = Math.round(i.unit_price * i.quantity * 100) / 100
    return Math.abs(i.total_price - expected) > 0.01
  }).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button onClick={() => navigate('/receipts')} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-lg font-semibold text-gray-900 flex-1">
          {state.step === 'capture' ? 'Upload Receipt' : 'Review Receipt'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Capture step */}
        {state.step === 'capture' && (
          <div className="p-4 space-y-4">
            <ErrorBanner message={state.extractError} onDismiss={() => dispatch({ type: 'RETRY_EXTRACT' })} />
            {state.extractError && <ScanDetails diagnostics={state.scanDiagnostics} />}

            {/* Gemini key entry inline if missing */}
            {!geminiKey.trim() && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">Gemini API Key Required</p>
                <p className="text-xs text-yellow-700 mb-3">
                  Get a free key at <span className="font-medium">aistudio.google.com/app/apikey</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="AIza..."
                    value={state.geminiKeyInput}
                    onChange={(e) => dispatch({ type: 'SET_GEMINI_KEY_INPUT', value: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={saveGeminiKey}
                    disabled={!state.geminiKeyInput.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {state.imagePreview && (
              <div className="relative">
                <img src={state.imagePreview} alt="Receipt preview" className="w-full rounded-xl object-contain max-h-48" />
                {state.imageFile && state.extractError && (
                  <button
                    onClick={() => startExtract(state.imageFile!)}
                    className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-white font-semibold text-sm gap-2"
                  >
                    <span>↺</span> Retry Scan
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { fileInputRef.current!.accept = 'image/*'; fileInputRef.current!.capture = 'environment'; fileInputRef.current!.click() }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 p-8 text-indigo-600 hover:bg-indigo-50"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-medium">Camera</span>
              </button>
              <button
                onClick={() => { fileInputRef.current!.removeAttribute('capture'); fileInputRef.current!.accept = 'image/*'; fileInputRef.current!.click() }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-gray-600 hover:bg-gray-50"
              >
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-medium">Gallery</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
          </div>
        )}

        {/* Review step */}
        {state.step === 'review' && (
          <div className="p-4 space-y-5">
            <ErrorBanner message={state.saveError} onDismiss={() => dispatch({ type: 'SAVE_ERROR', error: '' })} />

            {state.isDuplicate && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                <p className="font-medium mb-1">Possible duplicate receipt</p>
                <p className="mb-3">A receipt with this date and total may already exist.</p>
                <button
                  onClick={() => handleSave(true)}
                  className="rounded-lg bg-yellow-600 px-4 py-1.5 text-sm font-medium text-white"
                >
                  Save Anyway
                </button>
              </div>
            )}

            {state.imagePreview && (
              <img src={state.imagePreview} alt="Receipt" className="w-full max-h-32 rounded-xl object-contain" />
            )}

            <StorePicker
              storeId={state.storeId}
              storeName={state.storeName}
              onChange={(id, name) => dispatch({ type: 'SET_STORE', storeId: id, storeName: name })}
              onCreateStore={async (name) => {
                const store = await createStore(name, '#6366f1')
                return store
              }}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full"
                value={state.receiptDate}
                onChange={(e) => dispatch({ type: 'SET_DATE', date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Total ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full"
                  value={state.totalAmount}
                  onChange={(e) => dispatch({ type: 'SET_TOTAL', total: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax / Fees ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full"
                  value={state.taxAmount}
                  onChange={(e) => dispatch({ type: 'SET_TAX', tax: e.target.value })}
                />
              </div>
            </div>

            <TotalMismatchWarning itemSum={itemSum} taxAmount={taxAmt} totalAmount={totalAmt} suspectCount={suspectCount} />

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-gray-700">Items ({state.items.length})</h2>
                <button
                  onClick={() => dispatch({ type: 'ADD_ITEM' })}
                  className="text-xs text-indigo-600 font-medium"
                >
                  + Add Item
                </button>
              </div>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th className="text-left pb-1">Item</th>
                      <th className="text-right pb-1 pr-2 w-12">Qty</th>
                      <th className="text-right pb-1 pr-2 w-16">Unit $</th>
                      <th className="text-right pb-1 pr-2 w-20">Total</th>
                      <th className="text-left pb-1 pr-2 w-24">Category</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.items.map((item, i) => (
                      <LineItemRow
                        key={i}
                        item={item}
                        index={i}
                        onChange={(idx, updates) => dispatch({ type: 'UPDATE_ITEM', index: idx, updates })}
                        onRemove={(idx) => dispatch({ type: 'REMOVE_ITEM', index: idx })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions for review step */}
      {state.step === 'review' && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-3">
          <button
            onClick={() => navigate('/receipts')}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-600"
          >
            Discard
          </button>
          <button
            onClick={() => handleSave(false)}
            className="flex-2 flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Confirm
          </button>
        </div>
      )}

      {/* Saving overlay */}
      {state.step === 'saving' && (
        <div className="fixed inset-0 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-gray-600 text-sm">Saving receipt…</p>
          </div>
        </div>
      )}
    </div>
  )
}
