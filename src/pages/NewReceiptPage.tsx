import { useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractReceiptFromImage, getLastScanDiagnostics, type ScanDiagnostics, type ScanError } from '../lib/gemini'
import { normalizeStoreName } from '../lib/itemMatcher'
import { useReceipts } from '../hooks/useReceipts'
import { useStores } from '../hooks/useStores'
import { useHouseholdStore } from '../store/householdStore'
import {
  editCategory,
  editName,
  editQty,
  editTotal,
  editUnitPrice,
  emptyReviewItem,
  parseField,
  toPendingItems,
  toReviewItems,
  type ReviewItem,
} from '../lib/reviewItems'
import { flaggedLabel, nextFlaggedIndex, reconcile, type ReviewFlag } from '../lib/reviewFlags'
import { shortDate } from '../lib/dates'
import StorePicker from '../components/receipts/StorePicker'
import StoreBadge from '../components/ui/StoreBadge'
import ReviewItemCard from '../components/receipts/ReviewItemCard'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import ScanDetails from '../components/receipts/ScanDetails'

type Step = 'capture' | 'extracting' | 'review' | 'saving'

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
  items: ReviewItem[]
  /** Index of the one open row. The design allows exactly one at a time. */
  expanded: number | null
  geminiKeyInput: string
  scanDiagnostics: ScanDiagnostics | null
}

type Action =
  | { type: 'SET_FILE'; file: File; preview: string }
  | { type: 'EXTRACT_START' }
  | { type: 'EXTRACT_SUCCESS'; storeName: string; receiptDate: string; totalAmount: string; taxAmount: string; items: ReviewItem[] }
  | { type: 'EXTRACT_ERROR'; error: string; diagnostics: ScanDiagnostics | null }
  | { type: 'RETRY_EXTRACT' }
  | { type: 'SET_STORE'; storeId: string | null; storeName: string }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_TOTAL'; total: string }
  | { type: 'SET_TAX'; tax: string }
  | { type: 'TOGGLE_ROW'; index: number }
  | { type: 'EXPAND_ROW'; index: number | null }
  | { type: 'EDIT_ITEM'; index: number; apply: (item: ReviewItem) => ReviewItem }
  | { type: 'REMOVE_ITEM'; index: number }
  | { type: 'ADD_ITEM'; category: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_ERROR'; error: string; isDuplicate?: boolean }
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
  expanded: null,
  geminiKeyInput: '',
  scanDiagnostics: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FILE':
      return { ...state, imageFile: action.file, imagePreview: action.preview }
    case 'EXTRACT_START':
      return { ...state, step: 'extracting', extractError: null, scanDiagnostics: null }
    case 'EXTRACT_SUCCESS': {
      // Land on the first thing needing attention rather than at the top of a
      // list the user would otherwise have to scan themselves.
      const firstFlagged = action.items.findIndex((it) => it.flag)
      return {
        ...state,
        step: 'review',
        storeName: action.storeName,
        receiptDate: action.receiptDate || today(),
        totalAmount: action.totalAmount,
        taxAmount: action.taxAmount,
        items: action.items,
        expanded: firstFlagged < 0 ? null : firstFlagged,
        extractError: null,
        scanDiagnostics: null,
      }
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
    case 'TOGGLE_ROW':
      return { ...state, expanded: state.expanded === action.index ? null : action.index }
    case 'EXPAND_ROW':
      return { ...state, expanded: action.index }
    case 'EDIT_ITEM':
      return {
        ...state,
        items: state.items.map((it, i) => (i === action.index ? action.apply(it) : it)),
      }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((_, i) => i !== action.index),
        expanded: null,
      }
    case 'ADD_ITEM':
      // Opens immediately: an empty row is only useful once you can type in it.
      return {
        ...state,
        items: [...state.items, emptyReviewItem(action.category)],
        expanded: state.items.length,
      }
    case 'SAVE_START':
      return { ...state, step: 'saving', saveError: null, isDuplicate: false }
    case 'SAVE_ERROR':
      return { ...state, step: 'review', saveError: action.error, isDuplicate: !!action.isDuplicate }
    case 'FORCE_SAVE':
      return { ...state, isDuplicate: false, saveError: null }
    case 'SET_GEMINI_KEY_INPUT':
      return { ...state, geminiKeyInput: action.value }
    case 'GEMINI_KEY_SET':
      return { ...state, geminiKeyInput: '' }
    default:
      return state
  }
}

const money = (n: number) => `$${n.toFixed(2)}`

export default function NewReceiptPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, dispatch] = useReducer(reducer, initial)
  const { createReceipt, resolveStoreId, resolveAliasesForReview } = useReceipts()
  const { createStore } = useStores()
  const { geminiKey, geminiModel, setGeminiKey, categories, flagLowConfidence, stores } = useHouseholdStore()

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
      const data = await extractReceiptFromImage(file, key, geminiModel)

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
        items: toReviewItems(pendingItems),
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
        items: toPendingItems(state.items).filter((i) => i.item_name.trim()),
        imageFile: state.imageFile,
      })

      // The design confirms with a toast on the Receipts tab rather than a
      // success screen, so the save ends by landing there.
      navigate('/receipts', {
        replace: true,
        state: { savedTotal: money(total), imageUploadFailed },
      })
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

  // ─── DERIVED ─────────────────────────────────────────────────────────────
  // Recomputed every render, never stored: the reconciliation verdict moves on
  // every keystroke, and a stored copy would be one keystroke behind.

  // Unresolved stores (free text straight off the scan) get a neutral badge
  // rather than a made-up brand colour.
  const selectedStore = stores.find((s) => s.id === state.storeId)
  const flags: ReviewFlag[] = state.items.map((it) => (flagLowConfidence ? it.flag : null))
  const flaggedCount = flags.filter(Boolean).length
  const { itemSum, balanced, delta } = reconcile(
    state.items.map((it) => parseField(it.total)),
    parseField(state.taxAmount) ?? 0,
    parseField(state.totalAmount),
  )

  // ─── RENDER ──────────────────────────────────────────────────────────────

  if (state.step === 'extracting') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-ink-2">Scanning with Gemini…</p>
        <p className="text-xs text-ink-3">Large receipts can take up to 45 seconds</p>
      </div>
    )
  }

  if (state.step === 'capture') {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-canvas">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pb-3 pt-2">
          <button onClick={() => navigate('/receipts')} className="text-nav text-accent">
            Cancel
          </button>
          <h1 className="flex-1 text-nav font-semibold">New receipt</h1>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <ErrorBanner message={state.extractError} onDismiss={() => dispatch({ type: 'RETRY_EXTRACT' })} />
          {state.extractError && <ScanDetails diagnostics={state.scanDiagnostics} />}

          {!geminiKey.trim() && (
            <div className="rounded-card border border-warn/40 bg-warn-bg p-4">
              <p className="mb-2 text-sm font-medium text-warn-ink">Gemini API key required</p>
              <p className="mb-3 text-xs text-ink-2">
                Get a free key at <span className="font-medium">aistudio.google.com/app/apikey</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="AIza..."
                  value={state.geminiKeyInput}
                  onChange={(e) => dispatch({ type: 'SET_GEMINI_KEY_INPUT', value: e.target.value })}
                  className="flex-1 rounded-input border border-border px-3 py-2"
                />
                <button
                  onClick={saveGeminiKey}
                  disabled={!state.geminiKeyInput.trim()}
                  className="rounded-input bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {state.imagePreview && (
            <div className="relative">
              <img src={state.imagePreview} alt="Receipt preview" className="max-h-48 w-full rounded-card object-contain" />
              {state.imageFile && state.extractError && (
                <button
                  onClick={() => startExtract(state.imageFile!)}
                  className="absolute inset-0 flex items-center justify-center gap-2 rounded-card bg-black/40 text-sm font-semibold text-white"
                >
                  <span>↺</span> Retry scan
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { fileInputRef.current!.accept = 'image/*'; fileInputRef.current!.capture = 'environment'; fileInputRef.current!.click() }}
              className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-accent/40 p-8 text-accent"
            >
              <span className="text-3xl">📷</span>
              <span className="text-sm font-medium">Camera</span>
            </button>
            <button
              onClick={() => { fileInputRef.current!.removeAttribute('capture'); fileInputRef.current!.accept = 'image/*'; fileInputRef.current!.click() }}
              className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-strong p-8 text-ink-2"
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
      </div>
    )
  }

  // ─── REVIEW ──────────────────────────────────────────────────────────────
  // Three fixed regions: nav bar, scrolling body, footer. Only the body
  // scrolls, and only vertically.

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <div className="flex flex-none items-center justify-between border-b border-border bg-surface px-4 pb-3 pt-2">
        <button onClick={() => navigate('/receipts')} className="text-nav text-accent">
          Cancel
        </button>
        <span className="text-nav font-semibold">Review</span>
        <button onClick={() => handleSave(false)} className="text-nav font-semibold text-accent">
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-3.5">
        <ErrorBanner message={state.saveError} onDismiss={() => dispatch({ type: 'SAVE_ERROR', error: '' })} />

        {state.isDuplicate && (
          <div className="mb-3.5 rounded-card border border-warn/40 bg-warn-bg px-4 py-3 text-sm text-warn-ink">
            <p className="mb-1 font-medium">Possible duplicate receipt</p>
            <p className="mb-3">A receipt with this date and total may already exist.</p>
            <button onClick={() => handleSave(true)} className="rounded-input bg-warn px-4 py-1.5 text-sm font-medium text-white">
              Save anyway
            </button>
          </div>
        )}

        {/* Summary: the photo, what it is, and whether the numbers close. */}
        <div className="flex items-center gap-3.5 rounded-card bg-surface px-4 py-3.5">
          {state.imagePreview ? (
            <img
              src={state.imagePreview}
              alt="Receipt"
              className="h-[68px] w-[52px] flex-none rounded-lg border border-hairline object-cover"
            />
          ) : (
            <div className="h-[68px] w-[52px] flex-none rounded-lg border border-hairline bg-canvas" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StoreBadge
                name={state.storeName || '?'}
                color={selectedStore?.color ?? '#8A8A8E'}
                className="h-[22px] w-[22px] text-[9px]"
              />
              <span className="truncate text-nav font-semibold">{state.storeName || 'Unknown store'}</span>
              <span className="flex-none text-meta text-ink-2">· {shortDate(state.receiptDate)}</span>
            </div>
            <p className="mt-1.5 text-meta text-ink-2">
              Items {money(itemSum)} + tax {money(parseField(state.taxAmount) ?? 0)}
            </p>
            {/* Stated in place and quietly, resolving to green as lines are
                corrected — no alert box to dismiss. */}
            <p className={`text-meta font-semibold ${balanced === false ? 'text-warn-ink' : 'text-accent'}`}>
              {balanced == null
                ? 'Enter the receipt total to check'
                : balanced
                  ? `Matches receipt total ${money(parseField(state.totalAmount)!)}`
                  : `Off by ${money(delta!)} vs ${money(parseField(state.totalAmount)!)}`}
            </p>
          </div>
        </div>

        {/* Not in the design, which assumed these already known. The scan can
            get the store wrong and the totals drive the verdict above, so they
            have to stay reachable. */}
        <div className="mt-3.5 rounded-card bg-surface px-4 py-3.5">
          <StorePicker
            storeId={state.storeId}
            storeName={state.storeName}
            onChange={(id, name) => dispatch({ type: 'SET_STORE', storeId: id, storeName: name })}
            onCreateStore={async (name) => createStore(name, '#1D7A47')}
          />
          <div className="mt-3 flex gap-2.5">
            <div className="flex-1">
              <label className="mb-1.5 block text-label text-ink-2" htmlFor="receipt-date">Date</label>
              <input
                id="receipt-date"
                type="date"
                value={state.receiptDate}
                onChange={(e) => dispatch({ type: 'SET_DATE', date: e.target.value })}
                className="w-full rounded-input border border-border px-3 py-3 text-field"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2.5">
            <div className="flex-1">
              <label className="mb-1.5 block text-label text-ink-2" htmlFor="receipt-total">Receipt total</label>
              <input
                id="receipt-total"
                inputMode="decimal"
                value={state.totalAmount}
                onChange={(e) => dispatch({ type: 'SET_TOTAL', total: e.target.value })}
                className="w-full rounded-input border-2 border-accent px-[11px] py-[11px] text-right text-field font-medium tabular-nums"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-label text-ink-2" htmlFor="receipt-tax">Tax / fees</label>
              <input
                id="receipt-tax"
                inputMode="decimal"
                value={state.taxAmount}
                onChange={(e) => dispatch({ type: 'SET_TAX', tax: e.target.value })}
                className="w-full rounded-input border border-border px-3 py-3 text-right text-field tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between px-1 pb-2 pt-5">
          <span className="text-section">{state.items.length} items</span>
          <span
            className={`text-meta ${
              !flagLowConfidence ? 'text-ink-2' : flaggedCount === 0 ? 'text-accent' : 'text-warn-ink'
            }`}
          >
            {flaggedLabel(flaggedCount, flagLowConfidence)}
          </span>
        </div>

        <div className="overflow-hidden rounded-card">
          {state.items.map((item, i) => (
            <ReviewItemCard
              key={item.id}
              item={item}
              flag={flags[i]}
              expanded={state.expanded === i}
              onToggle={() => dispatch({ type: 'TOGGLE_ROW', index: i })}
              onName={(v) => dispatch({ type: 'EDIT_ITEM', index: i, apply: (it) => editName(it, v) })}
              onQty={(v) => dispatch({ type: 'EDIT_ITEM', index: i, apply: (it) => editQty(it, v) })}
              onUnitPrice={(v) => dispatch({ type: 'EDIT_ITEM', index: i, apply: (it) => editUnitPrice(it, v) })}
              onTotal={(v) => dispatch({ type: 'EDIT_ITEM', index: i, apply: (it) => editTotal(it, v) })}
              onCategory={(v) => dispatch({ type: 'EDIT_ITEM', index: i, apply: (it) => editCategory(it, v) })}
              onRemove={() => dispatch({ type: 'REMOVE_ITEM', index: i })}
              onNext={() => dispatch({ type: 'EXPAND_ROW', index: nextFlaggedIndex(flags, i) })}
              hasNextFlagged={nextFlaggedIndex(flags, i) !== null}
            />
          ))}
          <button
            onClick={() => dispatch({ type: 'ADD_ITEM', category: categories[categories.length - 1] ?? 'Other' })}
            className="w-full border-t border-hairline bg-surface px-4 py-3.5 text-left text-row text-accent"
          >
            Add item
          </button>
        </div>
      </div>

      <div className="chrome-blur flex-none border-t border-border px-4 pb-7.5 pt-3">
        <button
          onClick={() => handleSave(false)}
          className="w-full rounded-button bg-accent py-[15px] text-nav font-semibold text-white active:bg-accent-pressed"
        >
          Save receipt
        </button>
      </div>

      {state.step === 'saving' && (
        <div className="fixed inset-0 flex items-center justify-center bg-surface/80">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-ink-2">Saving receipt…</p>
          </div>
        </div>
      )}
    </div>
  )
}
