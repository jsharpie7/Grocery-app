export interface ExtractedReceiptData {
  store_name: string
  receipt_date: string
  total_amount: number | null
  tax_amount: number | null
  items: ExtractedLineItem[]
}

export interface ExtractedLineItem {
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

const RECEIPT_PROMPT = `Analyze this grocery receipt image. Extract all information.
Return ONLY a JSON object (no markdown, no explanation) with exactly these fields:
{
  "store_name": "store name from receipt header" (string),
  "receipt_date": "YYYY-MM-DD format date from receipt" (string),
  "total_amount": total amount paid as decimal number or null (number|null),
  "tax_amount": tax amount as decimal number or null (number|null),
  "items": array of line items, each with:
    {
      "item_name": "product name" (string, required),
      "quantity": quantity as number (number, default 1),
      "unit": "ea" unless clearly different (string),
      "unit_price": unit price as decimal or null (number|null),
      "total_price": line total as decimal or null (number|null),
      "category": one of exactly: Produce, Meat, Dairy, Bakery, Frozen, Pantry, Beverages, Snacks, Household, Personal Care, Baby, Pet, Other (string)
    }
}
Return ONLY the JSON object, nothing else.`

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
    items: (items as Record<string, unknown>[])
      .filter(item => item && typeof item.item_name === 'string' && String(item.item_name).trim())
      .map(item => ({
        item_name: String(item.item_name).trim().replace(/\s+/g, ' '),
        quantity: typeof item.quantity === 'number' ? Math.max(1, item.quantity) : 1,
        unit: typeof item.unit === 'string' && item.unit ? item.unit.trim() : 'ea',
        unit_price: typeof item.unit_price === 'number' ? item.unit_price : null,
        total_price: typeof item.total_price === 'number' ? item.total_price : null,
        category: VALID_CATEGORIES.includes(String(item.category)) ? String(item.category) : 'Other',
      })),
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
