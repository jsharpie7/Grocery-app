export interface ExtractedReceiptData {
  store_name: string
  receipt_date: string
  total_amount: number | null
  tax_amount: number | null
  items: ExtractedLineItem[]
}

export interface ExtractedLineItem {
  item_number: string | null
  item_name: string
  quantity: number
  unit: string
  unit_price: number | null
  total_price: number | null
  category: string
}

const VALID_CATEGORIES = [
  'Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry',
  'Beverages', 'Snacks', 'Household', 'Personal Care', 'Baby', 'Pet', 'Other',
]

interface ImagePayload {
  base64: string
  mimeType: string
  sourceWidth: number | null
  sourceHeight: number | null
  width: number | null
  height: number | null
  bytes: number
}

function approxBytesFromBase64(base64: string): number {
  return Math.round((base64.length * 3) / 4)
}

function fileToBase64(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, base64] = result.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
      resolve({
        base64,
        mimeType,
        sourceWidth: null,
        sourceHeight: null,
        width: null,
        height: null,
        bytes: approxBytesFromBase64(base64),
      })
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

// Receipts are tall and narrow. Whether Gemini can read one comes down to how many pixels span a
// single line of text — a function of WIDTH alone. Scaling by the longest edge shrinks a portrait
// 3024x4032 photo to 1200x1600, and since a long receipt only occupies part of the frame that can
// leave the printed text under 10px per character. An illegible image does not fail fast: the
// model grinds on it and the request hits the timeout, which is why even short receipts started
// timing out once downscaling shipped. Cap the width, let the height run.
const MAX_WIDTH = 1600
// Safety net so an unusually large or panoramic source can't produce a multi-megabyte payload.
const MAX_PIXELS = 6_000_000
// Receipt text is thin and high-contrast, exactly what aggressive JPEG quantisation smears.
// Legibility is worth more here than a few hundred KB of upload.
const JPEG_QUALITY = 0.92

// Exported for tests: the scale factor applied to a source image of the given dimensions.
export function computeScale(width: number, height: number): number {
  if (!width || !height) return 1
  const widthScale = Math.min(1, MAX_WIDTH / width)
  const pixelScale = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)))
  return Math.min(widthScale, pixelScale)
}

async function downscaleImage(file: File): Promise<ImagePayload> {
  let bitmap: ImageBitmap
  try {
    // imageOrientation must be explicit. Without it some mobile browsers ignore the EXIF rotation
    // the camera wrote and the canvas bakes in a sideways receipt. Sending the raw file (the old
    // path) preserved EXIF, so this only became a hazard once we started re-encoding.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Decode unsupported for this format — fall back to the original bytes rather than failing.
    return fileToBase64(file)
  }

  const sourceWidth = bitmap.width
  const sourceHeight = bitmap.height
  const scale = computeScale(sourceWidth, sourceHeight)

  if (scale === 1) {
    // No resize needed, so there is nothing to gain by re-encoding — send the original bytes
    // whatever the format. Gemini reads PNG directly, and app-generated receipts arrive as
    // crisp grayscale PNG: converting those to JPEG tripled the payload and added ringing
    // around the very text we need read. Skipping the canvas also preserves EXIF.
    bitmap.close()
    const payload = await fileToBase64(file)
    return { ...payload, sourceWidth, sourceHeight, width: sourceWidth, height: sourceHeight }
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    const payload = await fileToBase64(file)
    return { ...payload, sourceWidth, sourceHeight }
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const [, base64] = dataUrl.split(',')
  return {
    base64,
    mimeType: 'image/jpeg',
    sourceWidth,
    sourceHeight,
    width: canvas.width,
    height: canvas.height,
    bytes: approxBytesFromBase64(base64),
  }
}

const RECEIPT_PROMPT = `Analyze this grocery receipt image. Extract all purchased line items carefully.
Return ONLY a JSON object (no markdown, no explanation) with exactly these fields:
{
  "store_name": "store name from receipt header" (string),
  "receipt_date": "YYYY-MM-DD format date from receipt" (string),
  "total_amount": total amount paid as decimal number or null (number|null),
  "tax_amount": total tax amount as decimal number or null (number|null),
  "items": array of consolidated line items, each with:
    {
      "item_number": "store product/barcode code — digits only, no letters" (string or null),
      "item_name": "product name from receipt" (string, required),
      "quantity": number of units purchased (number, default 1),
      "unit": "ea" or "lb" or other unit (string),
      "unit_price": price per single unit as decimal or null (number|null),
      "total_price": quantity x unit_price as decimal or null (number|null),
      "category": one of exactly: Produce, Meat, Dairy, Bakery, Frozen, Pantry, Beverages, Snacks, Household, Personal Care, Baby, Pet, Other (string)
    }
}

STORE-SPECIFIC QUANTITY RULES — apply whichever matches the receipt format:

WALMART (format: "ITEM_NAME  123456789012  F  $PRICE"):
  - item_number = 12-digit barcode printed AFTER the item name
  - Multiple units = the same barcode appears on multiple consecutive lines at the same price
  - CONSOLIDATE into ONE row: "MILD TACO 085176900775 2.26" x2 lines → {item_number:"085176900775", quantity:2, unit_price:2.26, total_price:4.52}

PUBLIX (format: "ITEM_NAME  $PRICE  t  F"):
  - item_number = null (Publix prints no product codes)
  - Multiple units = same name + same price on consecutive lines — count EVERY line individually,
    even if they look identical. Three printed lines = quantity 3, not 2.
  - CONSOLIDATE: "ORG APPLES GR SM  4.99  t  F" appearing 3 times → {quantity:3, unit_price:4.99, total_price:14.97}
  - DISCOUNTS: "You Saved X.XX" lines appear below some items. The item price shown is ALREADY
    the final after-discount price. IGNORE all "You Saved" lines completely — do not include
    them as line items, do not subtract them. Skip past them and continue counting item lines.

ALDI (format: "123456  Item Name  $TOTAL  FB" then optional sub-line):
  - item_number = 6-digit code printed BEFORE the item name
  - Sub-line "N x UNIT_PRICE": quantity=N, unit_price=UNIT_PRICE, total_price=main line price
  - Sub-line "W lb x PRICE/lb": quantity=W, unit="lb", unit_price=PRICE, total_price=main line price
  - The main line price IS total_price (already multiplied); do NOT double-count
  - VARIABLE WEIGHT ITEMS: same item_number appearing multiple times at DIFFERENT prices
    means separate packages priced by weight. Consolidate into ONE row:
    quantity=1, unit_price=sum of all package prices, total_price=unit_price.
    Example: "385628 Org Chicken Breast 8.16" + "385628 Org Chicken Breast 7.64" + "385628 Org Chicken Breast 10.42"
    → {item_number:"385628", item_name:"Org Chicken Breast", quantity:1, unit_price:26.22, total_price:26.22}

COSTCO (two line formats):
  Regular items:  "E  1234567  ITEM_NAME  PRICE  E"
  BOB items (Bottom of Basket, no leading E/A): "1234567  ITEM_NAME  PRICE  A"
  - item_number = the 7-digit code; strip any leading "E" or "A" tax letter
  - Multiple units = same item number on consecutive lines → CONSOLIDATE
  - "E 1532925 CHOMPS STICK 18.99" ×4 lines → {item_number:"1532925", quantity:4, unit_price:18.99, total_price:75.96}

  COSTCO DISCOUNTS — critical, read carefully:
  Discount lines look like ONE of these:
    "XXXXXXXX / TARGET_ITEM_NUMBER  AMOUNT-A"   (BOB item discount)
    "E XXXXXXXX /TARGET_ITEM_NUMBER  AMOUNT-E"  (regular item discount)
  The discount code starts with many zeros (e.g. 0000379004 or 0000380582).
  The "/" followed by TARGET_ITEM_NUMBER identifies WHICH item the discount applies to.
  The amount has a MINUS SUFFIX — "40.00-A" means subtract $40.00, NOT add.
  SUBTRACT the discount from that item's total_price; recalculate unit_price = total_price / quantity.
  Do NOT include discount lines as separate items.

  Example 1 (BOB + discount):
    "1872183 CANOPY 155.99 A" + "0000379004 / 1872183  40.00-A"
    → {item_number:"1872183", item_name:"CANOPY", quantity:1, unit_price:115.99, total_price:115.99}

  Example 2 (regular item ×2, each with its own discount line):
    "E 1564814 ALMNDCRACKER 9.99 E"
    "E 0000380582 /1564814  3.00-E"
    "E 1564814 ALMNDCRACKER 9.99 E"
    "E 0000380582 /1564814  3.00-E"
    → {item_number:"1564814", item_name:"ALMNDCRACKER", quantity:2, unit_price:6.99, total_price:13.98}

After consolidation, sum of all total_price values should equal the receipt subtotal (before tax).
Return ONLY the JSON object, nothing else.`

function deduplicateItems(items: ExtractedLineItem[]): ExtractedLineItem[] {
  const byNumber = new Map<string, ExtractedLineItem>()
  const byNamePrice = new Map<string, ExtractedLineItem>()
  const result: ExtractedLineItem[] = []

  for (const item of items) {
    // Normalize barcode: digits only, minimum 5 digits to be a real product code
    const digits = item.item_number?.replace(/\D/g, '') ?? ''
    const numKey = digits.length >= 5 ? digits : null
    // Fallback key: name + price (handles Publix which has no barcodes)
    const nameKey = `${item.item_name.toLowerCase().trim()}|${item.unit_price ?? item.total_price ?? ''}`

    const mergeInto = numKey ? byNumber.get(numKey) : byNamePrice.get(nameKey)
    if (mergeInto) {
      const mergePrice = mergeInto.unit_price ?? mergeInto.total_price ?? 0
      const itemPrice = item.unit_price ?? item.total_price ?? 0

      if (Math.abs(mergePrice - itemPrice) <= 0.01) {
        // Same price = multiple units of same item → standard consolidation
        mergeInto.quantity = Math.round((mergeInto.quantity + item.quantity) * 1000) / 1000
        if (mergeInto.total_price != null && item.total_price != null) {
          mergeInto.total_price = Math.round((mergeInto.total_price + item.total_price) * 100) / 100
        } else if (mergeInto.unit_price != null) {
          mergeInto.total_price = Math.round(mergeInto.unit_price * mergeInto.quantity * 100) / 100
        }
      } else {
        // Different prices = variable weight packages → qty stays 1, sum into unit_price/total
        const newTotal = Math.round(((mergeInto.total_price ?? mergeInto.unit_price ?? 0) + (item.total_price ?? item.unit_price ?? 0)) * 100) / 100
        mergeInto.total_price = newTotal
        mergeInto.unit_price = newTotal
        mergeInto.quantity = 1
      }
      continue
    }

    // Update item_number to normalized digits for consistent storage
    const clone = { ...item, item_number: numKey }
    if (numKey) byNumber.set(numKey, clone)
    else byNamePrice.set(nameKey, clone)
    result.push(clone)
  }

  return result
}

export interface ScanDiagnostics {
  buildId: string
  sourceType: string
  sourceBytes: number
  sourceDimensions: string | null
  sentBytes: number | null
  sentDimensions: string | null
  prepareMs: number
  requestMs: number
  totalMs: number
  model: string
  modelVersion: string | null
  finishReason: string | null
  promptTokens: number | null
  thoughtTokens: number | null
  outputTokens: number | null
  itemCount: number | null
  error: string | null
}

export type ScanError = Error & { diagnostics?: ScanDiagnostics }

let lastDiagnostics: ScanDiagnostics | null = null

export function getLastScanDiagnostics(): ScanDiagnostics | null {
  return lastDiagnostics
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '?'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Renders the diagnostics as flat "label: value" lines so a failing scan can be read off the
// phone screen (or pasted into a bug report) without a debugger attached.
export function formatDiagnostics(d: ScanDiagnostics): string[] {
  const lines = [
    `photo: ${d.sourceDimensions ?? '?'} ${d.sourceType} (${formatBytes(d.sourceBytes)})`,
    `sent: ${d.sentDimensions ?? '?'} (${formatBytes(d.sentBytes)})`,
    `prepare: ${(d.prepareMs / 1000).toFixed(1)}s · request: ${(d.requestMs / 1000).toFixed(1)}s · total: ${(d.totalMs / 1000).toFixed(1)}s`,
    `model: ${d.modelVersion ?? d.model}`,
    `build: ${d.buildId}`,
  ]
  if (d.finishReason) lines.push(`finish: ${d.finishReason}`)
  if (d.promptTokens != null || d.outputTokens != null || d.thoughtTokens != null) {
    lines.push(`tokens in/out/thinking: ${d.promptTokens ?? '?'} / ${d.outputTokens ?? '?'} / ${d.thoughtTokens ?? 0}`)
  }
  if (d.itemCount != null) lines.push(`items parsed: ${d.itemCount}`)
  if (d.error) lines.push(`error: ${d.error}`)
  return lines
}

// Receipt extraction is OCR plus bookkeeping — it wants speed and exact structure, not
// reasoning. Google's thinking docs list flash-lite as the one family with thinking OFF by
// default, which is what we want, and it stays on the free tier.
//
// This used to be pinned to gemini-2.5-flash with `thinkingConfig: { thinkingBudget: 0 }`.
// That parameter no longer appears in the API docs at all — the current control is
// thinkingLevel — and an unknown key in generationConfig is ignored rather than rejected.
// So the request silently stopped disabling anything and 2.5-flash (thinking ON by default)
// began thinking its way through every receipt. That is the shape of a failure that appears
// with no change on our side.
export const MODEL_CHOICES = [
  { id: 'gemini-2.5-flash-lite', label: 'Flash-Lite 2.5 — fastest, thinking off (default)' },
  { id: 'gemini-3.5-flash-lite', label: 'Flash-Lite 3.5 — newer, still fast' },
  { id: 'gemini-3.6-flash', label: 'Flash 3.6 — slower, better at messy photos' },
  { id: 'gemini-2.5-flash', label: 'Flash 2.5 — previous default' },
] as const

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'

// A 60-item receipt consolidates to roughly 3k output tokens. The model's own default cap is
// ~65k, so without this a single repetition loop generates for minutes and the only thing the
// user ever sees is the request timeout. Capping it converts that into a fast, named failure.
const MAX_OUTPUT_TOKENS = 8192


// Deliberately left at 45s. The previous round raised this from 20s and it did not help — a
// timeout is the symptom, not the cause. With a legible image and a bounded output, a scan that
// cannot finish in 45s is not going to finish in 90s either.
const REQUEST_TIMEOUT_MS = 45000

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
  }
  modelVersion?: string
}

export async function extractReceiptFromImage(
  file: File,
  apiKey: string,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<ExtractedReceiptData> {
  const GEMINI_MODEL = model || DEFAULT_GEMINI_MODEL
  const startedAt = performance.now()
  const diag: ScanDiagnostics = {
    buildId: __BUILD_ID__,
    sourceType: file.type || 'unknown',
    sourceBytes: file.size,
    sourceDimensions: null,
    sentBytes: null,
    sentDimensions: null,
    prepareMs: 0,
    requestMs: 0,
    totalMs: 0,
    model: GEMINI_MODEL,
    modelVersion: null,
    finishReason: null,
    promptTokens: null,
    thoughtTokens: null,
    outputTokens: null,
    itemCount: null,
    error: null,
  }

  // Every exit path records diagnostics, so a failure is always explainable after the fact.
  function fail(message: string): ScanError {
    diag.error = message
    diag.totalMs = Math.round(performance.now() - startedAt)
    lastDiagnostics = { ...diag }
    const err = new Error(message) as ScanError
    err.diagnostics = lastDiagnostics
    return err
  }

  if (file.size > 10 * 1024 * 1024) {
    throw fail('Image is over 10MB. Please use a smaller file or compress the image.')
  }

  // Preparing the image is the one step that used to throw outside the instrumented region, so
  // a failure here surfaced as a bare browser message ("Load failed") with no diagnostics at all
  // — the exact blind spot this whole change exists to remove.
  let payload: ImagePayload
  try {
    payload = await downscaleImage(file)
  } catch (err) {
    const detail = (err as Error).message || String(err)
    throw fail(`Could not read the photo (${detail}). Pick it again from Camera or Gallery — a photo held open for a while, or still syncing from iCloud, can stop being readable.`)
  }
  diag.prepareMs = Math.round(performance.now() - startedAt)
  diag.sentBytes = payload.bytes
  if (payload.sourceWidth && payload.sourceHeight) {
    diag.sourceDimensions = `${payload.sourceWidth}x${payload.sourceHeight}`
  }
  if (payload.width && payload.height) {
    diag.sentDimensions = `${payload.width}x${payload.height}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const requestStartedAt = performance.now()
  const markRequest = () => {
    diag.requestMs = Math.round(performance.now() - requestStartedAt)
  }

  try {
    let response: Response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: payload.mimeType, data: payload.base64 } },
                { text: RECEIPT_PROMPT },
              ],
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
          }),
        },
      )
    } catch (err) {
      markRequest()
      if ((err as Error).name === 'AbortError') {
        throw fail(
          `Gemini scan timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Tap Retry — if it keeps happening, open Scan details below.`,
        )
      }
      throw fail(`Could not reach Gemini: ${(err as Error).message}`)
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } }
      markRequest()
      const msg = errBody.error?.message || `Gemini API error ${response.status}`
      if (response.status === 429) throw fail('Gemini quota exceeded. Try again in a moment.')
      // A 400 is not automatically a bad key. A rejected generation config or an unknown model
      // also lands here, and reporting those as "invalid key" sends troubleshooting the wrong
      // way — so only claim that when the API actually says so, and pass its own words through
      // otherwise.
      if (response.status === 400 || response.status === 403) {
        if (/api[ _-]?key/i.test(msg)) throw fail('Invalid Gemini API key.')
        throw fail(`Gemini rejected the request: ${msg}`)
      }
      throw fail(msg)
    }

    // The timeout stays armed across the body read: aborting mid-stream is the only thing that
    // stops a response that has sent headers but stalled before finishing. That means the read
    // itself can abort, and it has to report as a timeout rather than a raw DOMException.
    let data: GeminiResponse
    try {
      data = await response.json() as GeminiResponse
    } catch (err) {
      markRequest()
      if ((err as Error).name === 'AbortError') {
        throw fail(
          `Gemini stalled mid-response and timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Tap Retry — if it keeps happening, open Scan details below.`,
        )
      }
      throw fail('Gemini returned a response that could not be read. Try again.')
    }
    markRequest()

    diag.modelVersion = data.modelVersion ?? null
    diag.finishReason = data.candidates?.[0]?.finishReason ?? null
    diag.promptTokens = data.usageMetadata?.promptTokenCount ?? null
    diag.outputTokens = data.usageMetadata?.candidatesTokenCount ?? null
    diag.thoughtTokens = data.usageMetadata?.thoughtsTokenCount ?? null

    if (data.promptFeedback?.blockReason) {
      throw fail(`Gemini refused the image (${data.promptFeedback.blockReason}). Try a clearer photo.`)
    }
    if (diag.finishReason === 'MAX_TOKENS') {
      throw fail('The scan produced more output than a receipt should. Retry, or photograph the receipt in two halves.')
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!raw.trim()) {
      throw fail(`Gemini returned an empty response${diag.finishReason ? ` (${diag.finishReason})` : ''}. Try again.`)
    }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw fail('Gemini returned an unexpected response. Try again.')
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw fail('Unexpected response format from Gemini.')
    }

    const p = parsed as Record<string, unknown>
    const rawItems = Array.isArray(p.items) ? p.items : []

    const result: ExtractedReceiptData = {
      store_name: typeof p.store_name === 'string' ? p.store_name.trim() : '',
      receipt_date: typeof p.receipt_date === 'string' ? p.receipt_date : '',
      total_amount: typeof p.total_amount === 'number' ? p.total_amount : null,
      tax_amount: typeof p.tax_amount === 'number' ? p.tax_amount : null,
      items: deduplicateItems((rawItems as Record<string, unknown>[])
        .filter(item => item && typeof item.item_name === 'string' && String(item.item_name).trim())
        .map(item => ({
          item_number: typeof item.item_number === 'string' && item.item_number.trim() ? item.item_number.trim() : null,
          item_name: String(item.item_name).trim().replace(/\s+/g, ' '),
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
          unit: typeof item.unit === 'string' && item.unit ? item.unit.trim() : 'ea',
          unit_price: typeof item.unit_price === 'number' ? item.unit_price : null,
          total_price: typeof item.total_price === 'number' ? item.total_price : null,
          category: VALID_CATEGORIES.includes(String(item.category)) ? String(item.category) : 'Other',
        }))),
    }

    diag.itemCount = result.items.length
    diag.totalMs = Math.round(performance.now() - startedAt)
    lastDiagnostics = { ...diag }
    return result
  } finally {
    clearTimeout(timeout)
  }
}

export async function validateGeminiKey(apiKey: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: controller.signal },
    )
    if (response.status === 400 || response.status === 403) {
      throw new Error('Invalid Gemini API key.')
    }
    if (response.status === 429) {
      throw new Error('Quota exceeded. Try again in a moment.')
    }
    if (!response.ok) {
      throw new Error(`API error ${response.status}`)
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('Request timed out.')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
