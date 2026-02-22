export interface ExtractedItem {
  item_name: string
  store_name: string
  category: string
  typical_price: number | null
  unit: string
  typical_quantity: number
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

const SHELF_PROMPT = `Look at this grocery store shelf label image. Extract every item you can see.
Return ONLY a JSON array (no markdown, no explanation) where each object has:
- item_name: product name (string, required)
- store_name: store name if visible anywhere in the image, otherwise "" (string)
- category: classify into ONE of exactly these: Produce, Meat, Dairy, Bakery, Frozen, Pantry, Beverages, Snacks, Household, Personal Care, Baby, Pet, Other (string)
- typical_price: price as a decimal number, or null if not visible (number|null)
- unit: unit such as "ea", "lb", "oz", "gallon", "count", "pack", "bag" (string)
- typical_quantity: default purchase quantity, usually 1 (number)
Return ONLY the JSON array, nothing else.`

const RECEIPT_PROMPT = `Look at this receipt image. Extract all purchased line items.
Return ONLY a JSON array (no markdown, no explanation) where each object has:
- item_name: product name (string, required)
- store_name: store name from the receipt header (string)
- category: classify into ONE of exactly these: Produce, Meat, Dairy, Bakery, Frozen, Pantry, Beverages, Snacks, Household, Personal Care, Baby, Pet, Other (string)
- typical_price: unit price as a decimal number, or null if unclear (number|null)
- unit: "ea" unless clearly different (string)
- typical_quantity: quantity purchased as shown on receipt (number)
Return ONLY the JSON array, nothing else.`

export async function extractItemsFromImage(
  file: File,
  type: 'shelf' | 'receipt',
  apiKey: string,
): Promise<ExtractedItem[]> {
  const { base64, mimeType } = await fileToBase64(file)
  const prompt = type === 'shelf' ? SHELF_PROMPT : RECEIPT_PROMPT

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
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

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = err.error?.message || `Gemini API error ${response.status}`
    if (response.status === 400) throw new Error('Invalid Gemini API key. Get one at aistudio.google.com/app/apikey')
    if (response.status === 429) throw new Error('Gemini quota exceeded. Try again in a moment.')
    throw new Error(msg)
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Strip markdown code fences if the model wraps the JSON anyway
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini returned an unexpected response. Try again.')
  }

  if (!Array.isArray(parsed)) throw new Error('Unexpected response format from Gemini.')

  return (parsed as Record<string, unknown>[])
    .filter(item => item && typeof item.item_name === 'string' && String(item.item_name).trim())
    .map(item => ({
      item_name: String(item.item_name).trim(),
      store_name: String(item.store_name || '').trim(),
      category: VALID_CATEGORIES.includes(String(item.category)) ? String(item.category) : 'Other',
      typical_price: typeof item.typical_price === 'number' ? item.typical_price : null,
      unit: String(item.unit || 'ea').trim() || 'ea',
      typical_quantity: typeof item.typical_quantity === 'number' ? Math.max(1, item.typical_quantity) : 1,
    }))
}
