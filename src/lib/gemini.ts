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

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, base64] = result.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
      resolve({ base64, mimeType })
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
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
  - Multiple units = same name + same price on consecutive lines
  - CONSOLIDATE: "ORG APPLES GR SM  5.99  t  F" x2 → {quantity:2, unit_price:5.99, total_price:11.98}
  - DISCOUNTS: "You Saved X.XX" lines appear below discounted items. The item price shown is
    ALREADY the final after-discount price. IGNORE all "You Saved" lines completely —
    do NOT include them as line items or subtract them from anything.

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

export async function extractReceiptFromImage(
  file: File,
  apiKey: string,
): Promise<ExtractedReceiptData> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is over 10MB. Please use a smaller file or compress the image.')
  }

  const { base64, mimeType } = await fileToBase64(file)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: RECEIPT_PROMPT },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    )
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Gemini scan timed out after 20 seconds. Try again.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = err.error?.message || `Gemini API error ${response.status}`
    if (response.status === 400) throw new Error('Invalid Gemini API key.')
    if (response.status === 429) throw new Error('Gemini quota exceeded. Try again in a moment.')
    throw new Error(msg)
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini returned an unexpected response. Try again.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Unexpected response format from Gemini.')
  }

  const p = parsed as Record<string, unknown>
  const items = Array.isArray(p.items) ? p.items : []

  return {
    store_name: typeof p.store_name === 'string' ? p.store_name.trim() : '',
    receipt_date: typeof p.receipt_date === 'string' ? p.receipt_date : '',
    total_amount: typeof p.total_amount === 'number' ? p.total_amount : null,
    tax_amount: typeof p.tax_amount === 'number' ? p.tax_amount : null,
    items: deduplicateItems((items as Record<string, unknown>[])
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
