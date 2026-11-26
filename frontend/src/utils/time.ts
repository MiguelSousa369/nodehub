import { getLocale, getMessages } from '../i18n'

// ---------------------------------------------------------------------------
// Date and sorting helpers shared by the pages. Dates follow the active language
// (en-GB or pt-PT: day-month order, 24-hour clock).
// ---------------------------------------------------------------------------

/** "just now", "5 min ago", "3 h ago", "yesterday", "2 days ago", then the date after a month. */
export function timeAgo(iso: string | Date): string {
  const t = getMessages().time
  const date = new Date(iso)
  const min = Math.round((Date.now() - date.getTime()) / 60_000)
  if (min < 1) return t.justNow
  if (min < 60) return t.minutes(min)
  if (min < 1440) return t.hours(Math.round(min / 60))
  const days = Math.round(min / 1440)
  if (days <= 30) return days === 1 ? t.yesterday : t.days(days)
  return formatDate(date)
}

/** "26 Nov 2026" / "26/11/2026" */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "26 Nov 2026, 14:05" */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' })
}

/** "14:05" */
export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
}

/** Full date and time, for tooltips next to a relative time. */
export function fullDate(iso: string | Date): string {
  return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'full', timeStyle: 'short' })
}

/** "Thursday, 26 November 2026", for day headings. */
export function longDay(date: Date): string {
  return date.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Natural order for names with numbers: "pc2" before "pc10", ignoring case. */
export function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
