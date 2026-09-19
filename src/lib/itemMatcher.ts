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

  // Truncation match.
  //
  // Registers cut long names off at the END, so a shortened receipt name is a
  // PREFIX of the full one: "Purely Elizabeth" for "Purely Elizabeth Granola".
  // Modifiers, by contrast, sit at the FRONT of a catalog name — "Turkey
  // Bacon", "Almond Butter", "Frozen Strawberries" — so a plain containment
  // test reads every generic word as the specific product that happens to
  // contain it. That is how "Butter" became almond butter, "Bacon" became
  // turkey bacon, and "Strawberries" became the frozen ones.
  //
  // Requiring a prefix keeps the truncations and rejects the collisions. The
  // boundary check stops "chip" matching "chipotle"; the uniqueness check
  // stops "Chicken" silently picking one of five chicken products.
  if (normalized.length >= 5) {
    const prefixMatches = items.filter(item => {
      const n = normalizeForMatch(item.name)
      const [longer, shorter] = n.length >= normalized.length ? [n, normalized] : [normalized, n]
      if (!longer.startsWith(shorter)) return false
      // The prefix has to end where a word ends, not mid-word.
      return longer.length === shorter.length || longer[shorter.length] === ' '
    })

    // Exactly one candidate, or it is a guess rather than a match. An
    // unmatched line still records its spend under its own name, and the
    // review screen marks it NEW so it can be named deliberately.
    if (prefixMatches.length === 1) return prefixMatches[0]
  }

  return null
}
