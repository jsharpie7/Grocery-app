/**
 * Monogram badges for stores.
 *
 * Stores are user-created and free-form, so there is no logo to show. Initials
 * on the store's own colour read faster than a bare colour dot while needing no
 * external assets (real chain logos would mean shipping trademarked images).
 */

/**
 * Initials for a store name: two letters for a multi-word name, otherwise the
 * first two characters of the single word.
 *
 * Uses Array.from rather than string indexing so an emoji or other
 * multi-codepoint character yields a whole glyph instead of half a surrogate
 * pair (`'🛒'[0]` renders as a replacement character).
 */
export function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'

  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join('').toUpperCase()
  }
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join('')
    .toUpperCase()
}

/**
 * Black or white, whichever gives higher WCAG contrast against `hexColor`.
 *
 * Store colours are user-chosen and can be anything from near-white to
 * near-black, so the text colour is derived rather than fixed. This compares
 * the two candidate contrast ratios directly instead of thresholding luminance
 * at 0.5 — that midpoint is the intuitive guess but it is wrong. Contrast
 * against white and against black are equal at luminance ~0.179, not 0.5, so a
 * 0.5 split hands white text to mid-bright colours it cannot be read on: on
 * amber (#f59e0b) white scores 2.2:1 (fails AA) where black scores 9.7:1.
 *
 * Falls back to white on an unparseable colour, matching the darker end of the
 * app's default palette.
 */
export function badgeTextColor(hexColor: string): '#000000' | '#ffffff' {
  const hex = hexColor.trim().replace(/^#/, '')

  const full =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#ffffff'

  const channel = (start: number) => parseInt(full.slice(start, start + 2), 16) / 255

  // WCAG relative luminance: linearize each channel, then weight by perceived
  // brightness (green dominates, blue barely registers).
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance =
    0.2126 * linearize(channel(0)) +
    0.7152 * linearize(channel(2)) +
    0.0722 * linearize(channel(4))

  const contrastWithBlack = (luminance + 0.05) / 0.05
  const contrastWithWhite = 1.05 / (luminance + 0.05)

  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff'
}
