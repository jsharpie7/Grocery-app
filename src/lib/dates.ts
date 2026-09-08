/**
 * Date formatting for receipt dates.
 *
 * Every helper parses at **noon**, not midnight. `new Date('2026-09-05')`
 * is parsed as UTC midnight and then rendered in local time, which lands on
 * the 4th anywhere west of Greenwich. Noon leaves ~12 hours of slack in both
 * directions, so the calendar day survives every real timezone.
 */

function atNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

/** "Sep 5" — list rows and the review summary. */
export function shortDate(isoDate: string): string {
  return atNoon(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Thursday, September 3, 2026" — the receipt detail screen. */
export function longDate(isoDate: string): string {
  return atNoon(isoDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "September 2026" — month group headers. Takes a `YYYY-MM` key. */
export function monthYearLabel(monthKey: string): string {
  return atNoon(`${monthKey}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** "Sep" — chart axis labels. Takes a `YYYY-MM` key. */
export function shortMonth(monthKey: string): string {
  return atNoon(`${monthKey}-01`).toLocaleDateString('en-US', { month: 'short' })
}
