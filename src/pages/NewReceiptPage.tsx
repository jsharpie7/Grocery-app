import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Images } from 'lucide-react'
import { REQUEST_TIMEOUT_MS, type ExtractedReceiptData } from '../lib/gemini'
import { normalizeStoreName } from '../lib/itemMatcher'
import { useReceipts } from '../hooks/useReceipts'
import { useStores } from '../hooks/useStores'
import { useHouseholdStore } from '../store/householdStore'
import { useScanStore } from '../store/scanStore'
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

interface State {
  /** 'idle' means no receipt is being reviewed — capture or scanning is showing. */
  step: 'idle' | 'review' | 'saving'
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
}

type Action =
  | { type: 'EXTRACT_SUCCESS'; storeName: string; receiptDate: string; totalAmount: string; taxAmount: string; items: ReviewItem[] }
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
  | { type: 'SET_GEMINI_KEY_INPUT'; value: string }
  | { type: 'GEMINI_KEY_SET' }

function today() {
  return new Date().toISOString().split('T')[0]
}

const initial: State = {
  step: 'idle',
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
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
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
      }
    }
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
      return { ...state, items: state.items.filter((_, i) => i !== action.index), expanded: null }
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
    case 'SET_GEMINI_KEY_INPUT':
      return { ...state, geminiKeyInput: action.value }
    case 'GEMINI_KEY_SET':
      return { ...state, geminiKeyInput: '' }
    default:
      return state
  }
}

const money = (n: number) => `$${n.toFixed(2)}`

/**
 * How far along the scan is, 0–1.
 *
 * Measured against the request's own 45s timeout rather than against the
 * model's output, because the request is not streamed and reports nothing
 * until it returns — there is no token-level progress to read. Elapsed time
 * against the deadline is the one real quantity available, so the bar answers
 * "how much of the budget is spent", which is what the 45s copy beside it is
 * about. It stops short of full: a filled bar on a scan still running would be
 * a lie.
 */
function scanFraction(startedAt: number | null, now: number): number {
  if (!startedAt) return 0
  return Math.min((now - startedAt) / REQUEST_TIMEOUT_MS, 0.95)
}

export default function NewReceiptPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, dispatch] = useReducer(reducer, initial)
  const { createReceipt, resolveStoreId, resolveAliasesForReview } = useReceipts()
  const { createStore } = useStores()
  const { geminiKey, geminiModel, setGeminiKey, categories, flagLowConfidence, stores } = useHouseholdStore()
  const scan = useScanStore()

  // ─── SCAN ────────────────────────────────────────────────────────────────

  function startScan(file: File) {
    const key = geminiKey.trim()
    if (!key) return
    scan.start(file, key, geminiModel)
  }

  // Folds a finished scan into the review screen. Runs whenever a result is
  // waiting, which is either the moment it lands or the moment the user comes
  // back to this screen having left mid-scan.
  const foldedResult = useRef<ExtractedReceiptData | null>(null)
  useEffect(() => {
    const result = scan.result
    if (scan.status !== 'done' || !result || foldedResult.current === result) return
    foldedResult.current = result

    let abandoned = false
    void (async () => {
      const allStores = useHouseholdStore.getState().stores
      let matchedStoreId: string | null = null
      if (result.store_name) {
        const norm = normalizeStoreName(result.store_name)
        matchedStoreId = allStores.find((s) => normalizeStoreName(s.name) === norm)?.id ?? null
      }

      // A date the model invented can fail to parse; today is a better guess
      // than a crash.
      let parsedDate = today()
      if (result.receipt_date && !isNaN(new Date(`${result.receipt_date}T12:00:00`).getTime())) {
        parsedDate = result.receipt_date
      }

      const pendingItems = await resolveAliasesForReview(result.items, matchedStoreId)
      if (abandoned) return

      dispatch({
        type: 'EXTRACT_SUCCESS',
        storeName: result.store_name,
        receiptDate: parsedDate,
        totalAmount: result.total_amount != null ? String(result.total_amount) : '',
        taxAmount: result.tax_amount != null ? String(result.tax_amount) : '',
        items: toReviewItems(pendingItems),
      })

      const matched = allStores.find((s) => s.id === matchedStoreId)
      if (matched) dispatch({ type: 'SET_STORE', storeId: matched.id, storeName: matched.name })

      useScanStore.getState().consume()
    })()

    return () => { abandoned = true }
  }, [scan.status, scan.result, resolveAliasesForReview])

  // ─── SAVE ────────────────────────────────────────────────────────────────

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
      if (!storeId && state.storeName.trim()) storeId = await resolveStoreId(state.storeName)

      const { imageUploadFailed } = await createReceipt({
        storeId,
        receiptDate: state.receiptDate,
        totalAmount: total,
        taxAmount: isNaN(tax) ? 0 : tax,
        items: toPendingItems(state.items).filter((i) => i.item_name.trim()),
        imageFile: scan.file,
      })

      useScanStore.getState().reset()
      // The design confirms with a toast on the Receipts tab rather than a
      // success screen, so the save ends by landing there.
      navigate('/receipts', { replace: true, state: { savedTotal: money(total), imageUploadFailed } })
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
    const key = state.geminiKeyInput.trim()
    setGeminiKey(key)
    dispatch({ type: 'GEMINI_KEY_SET' })
    if (scan.file && key) scan.start(scan.file, key, geminiModel)
  }

  function cancel() {
    // A *running* scan is deliberately left alone: the scanning screen promises
    // it keeps going, and Cancel means "put this away", not "abort". Anything
    // already finished or failed is cleared, or its photo and error would
    // still be sitting there the next time this screen opened.
    if (useScanStore.getState().status !== 'running') useScanStore.getState().reset()
    navigate('/receipts')
  }

  // ─── SCANNING ────────────────────────────────────────────────────────────

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (scan.status !== 'running') return
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(tick)
  }, [scan.status])

  if (scan.status === 'running') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4.5 bg-canvas px-10 text-center">
        <div className="h-[68px] w-[54px] rounded-lg border border-border bg-[repeating-linear-gradient(180deg,#E4E4E8_0_4px,#F4F4F7_4px_8px)]" />
        <p className="text-[19px] font-semibold leading-snug">Reading the receipt…</p>
        <p className="text-[14px] leading-normal text-ink-2">
          Large receipts can take up to 45 seconds. You can leave this screen — it keeps going.
        </p>
        <div
          className="h-1 w-[180px] overflow-hidden rounded-sm bg-track"
          role="progressbar"
          aria-label="Scanning receipt"
        >
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${scanFraction(scan.startedAt, now) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  // ─── CAPTURE ─────────────────────────────────────────────────────────────

  if (state.step === 'idle') {
    const needsKey = !geminiKey.trim()
    const blocked = needsKey || !!scan.error

    return (
      <div className="flex h-full flex-col bg-[#1A1A1C] text-white">
        <div className="flex flex-none items-center justify-between px-4.5 pb-3.5 pt-2">
          <button onClick={cancel} className="text-nav text-white">Cancel</button>
          <span className="text-nav font-semibold">New receipt</span>
          <span className="w-[52px]" />
        </div>

        <div className="relative flex-1 overflow-hidden bg-[#232326]">
          {scan.preview ? (
            <img src={scan.preview} alt="Receipt" className="h-full w-full object-contain" />
          ) : (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center">
              <Images size={40} strokeWidth={1.25} aria-hidden className="mx-auto text-white/40" />
              <p className="mt-4 text-[17px] font-semibold">Pick your receipt photo</p>
              <p className="mt-2 text-[14px] leading-normal text-white/60">
                Works best when the receipt fills the frame and the text is in focus.
              </p>
            </div>
          )}

          {blocked && (
            <div className="absolute inset-x-3 bottom-3 max-h-[60%] overflow-y-auto rounded-card bg-surface p-4 text-ink">
              {scan.error && (
                <>
                  <ErrorBanner message={scan.error} onDismiss={() => scan.reset()} />
                  <ScanDetails diagnostics={scan.diagnostics} />
                  {scan.file && !needsKey && (
                    <button
                      onClick={() => startScan(scan.file!)}
                      className="mt-3 w-full rounded-button bg-accent py-3 text-nav font-semibold text-white"
                    >
                      Retry scan
                    </button>
                  )}
                </>
              )}

              {needsKey && (
                <div className={scan.error ? 'mt-4' : ''}>
                  <p className="mb-1 text-section">Gemini API key required</p>
                  <p className="mb-3 text-meta text-ink-2">
                    Get a free key at <span className="font-medium">aistudio.google.com/app/apikey</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="AIza..."
                      value={state.geminiKeyInput}
                      onChange={(e) => dispatch({ type: 'SET_GEMINI_KEY_INPUT', value: e.target.value })}
                      className="min-w-0 flex-1 rounded-input border border-border px-3 py-2.5 text-field"
                    />
                    <button
                      onClick={saveGeminiKey}
                      disabled={!state.geminiKeyInput.trim()}
                      className="flex-none rounded-input bg-accent px-4 text-nav font-semibold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Choosing an existing photo is the primary action, not the
              fallback. The design drew a camera shutter as the hero control,
              but the app has no viewfinder to put behind it — receipts get
              photographed in the phone's own camera app and picked up here.
              Taking one now stays available, one tap away. */}
          <div className="absolute inset-x-4 bottom-[56px]">
            <button
              onClick={() => {
                fileInputRef.current!.removeAttribute('capture')
                fileInputRef.current!.click()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-button bg-accent py-4 text-nav font-semibold text-white active:bg-accent-pressed"
            >
              <Images size={20} strokeWidth={1.75} aria-hidden />
              Choose photo
            </button>
            <button
              onClick={() => {
                fileInputRef.current!.setAttribute('capture', 'environment')
                fileInputRef.current!.click()
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-nav text-white/70"
            >
              <Camera size={18} strokeWidth={1.5} aria-hidden />
              Take a photo instead
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) startScan(f)
            e.target.value = ''
          }}
        />
      </div>
    )
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

  // ─── REVIEW ──────────────────────────────────────────────────────────────
  // Three fixed regions: nav bar, scrolling body, footer. Only the body
  // scrolls, and only vertically.

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <div className="flex flex-none items-center justify-between border-b border-border bg-surface px-4 pb-3 pt-2">
        <button onClick={cancel} className="text-nav text-accent">Cancel</button>
        <span className="text-nav font-semibold">Review</span>
        <button onClick={() => handleSave(false)} className="text-nav font-semibold text-accent">Save</button>
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
          {scan.preview ? (
            <img src={scan.preview} alt="Receipt" className="h-[68px] w-[52px] flex-none rounded-lg border border-hairline object-cover" />
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
          <div className="mt-3">
            <label className="mb-1.5 block text-label text-ink-2" htmlFor="receipt-date">Date</label>
            <input
              id="receipt-date"
              type="date"
              value={state.receiptDate}
              onChange={(e) => dispatch({ type: 'SET_DATE', date: e.target.value })}
              className="w-full rounded-input border border-border px-3 py-3 text-field"
            />
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
