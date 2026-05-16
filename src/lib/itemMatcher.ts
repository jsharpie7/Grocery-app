import type { Item } from './supabase'

export function normalizeForMatch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function normalizeStoreName(name: string): string {
  return name
    .replace(/#\s*\d+/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function matchItem(
  candidateName: string,
  items: Item[],
  itemNumber?: string | null,
): Item | null {
  if (!items.length) return null

  // Barcode/item-number match is the most reliable — try first
  if (itemNumber) {
    const byNumber = items.find(item => item.item_number === itemNumber)
    if (byNumber) return byNumber
  }

  // Fall back to name matching
  const normalized = normalizeForMatch(candidateName)
  if (!normalized) return null

  const exact = items.find(item => normalizeForMatch(item.name) === normalized)
  if (exact) return exact

  // Substring match — minimum 5 chars to avoid false positives (e.g. "milk" ≠ "buttermilk")
  if (normalized.length >= 5) {
    const sub = items.find(item => {
      const n = normalizeForMatch(item.name)
      return n.includes(normalized) || normalized.includes(n)
    })
    if (sub) return sub
  }

  return null
}
