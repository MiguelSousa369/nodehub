// ---------------------------------------------------------------------------
// Date and text helpers shared by the pages.
//
// The UI is in English, so dates use an English locale too (day-month order, 24-hour clock),
// instead of mixing the browser's language into English sentences.
// ---------------------------------------------------------------------------

export const LOCALE = 'en-GB'

/** "just now", "5 min ago", "3 h ago", "yesterday", "2 days ago", then the date after a month. */
export function timeAgo(iso: string | Date): string {
  const date = new Date(iso)
  const min = Math.round((Date.now() - date.getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.round(min / 60)} h ago`
  const days = Math.round(min / 1440)
  if (days <= 30) return days === 1 ? 'yesterday' : `${days} days ago`
  return formatDate(date)
}

/** "26 Nov 2026" */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "26 Nov 2026, 14:05" */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
}

/** "14:05" */
export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** Full date and time, for tooltips next to a relative time. */
export function fullDate(iso: string | Date): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'full', timeStyle: 'short' })
}

/** Natural order for names with numbers: "pc2" before "pc10", ignoring case. */
export function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
