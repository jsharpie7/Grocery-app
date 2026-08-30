import type { FocusEvent } from 'react'

/**
 * Highlights a field's whole value the moment it takes focus, so one tap on a
 * scanned name or quantity lets you type the replacement instead of landing a
 * caret mid-word and having to clear the old value by hand.
 *
 * The select is deferred one frame because iOS Safari sets its own caret
 * position *after* dispatching `focus`, which would collapse a selection made
 * synchronously here.
 */
export function selectAllOnFocus(e: FocusEvent<HTMLInputElement>) {
  const input = e.currentTarget
  requestAnimationFrame(() => {
    // The field can blur or unmount before the frame runs (fast tap-through,
    // sheet closing); selecting a detached input would throw on some browsers.
    if (document.activeElement !== input) return
    try {
      input.select()
    } catch {
      // Safari throws on `select()` for a few input types; a caret is fine there.
    }
  })
}
