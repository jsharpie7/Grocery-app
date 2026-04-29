import { describe, it, expect } from 'vitest'

// Pure parsing logic extracted for testing
function parseGeminiResponse(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Unexpected response format from Gemini.')
  }
  return parsed as Record<string, unknown>
}

describe('geminiParser', () => {
  it('parses valid JSON object', () => {
    const raw = JSON.stringify({ store_name: 'Walmart', total_amount: 42.5, items: [] })
    const result = parseGeminiResponse(raw)
    expect(result.store_name).toBe('Walmart')
    expect(result.total_amount).toBe(42.5)
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"store_name":"Target","items":[]}\n```'
    const result = parseGeminiResponse(raw)
    expect(result.store_name).toBe('Target')
  })

  it('strips plain code fences', () => {
    const raw = '```\n{"store_name":"CVS","items":[]}\n```'
    const result = parseGeminiResponse(raw)
    expect(result.store_name).toBe('CVS')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseGeminiResponse('not json at all')).toThrow()
  })

  it('throws when response is an array (not object)', () => {
    const raw = JSON.stringify([{ item_name: 'Milk' }])
    expect(() => parseGeminiResponse(raw)).toThrow('Unexpected response format')
  })

  it('throws on null response', () => {
    expect(() => parseGeminiResponse('null')).toThrow()
  })
})
