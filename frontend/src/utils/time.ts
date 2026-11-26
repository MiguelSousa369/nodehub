// ---------------------------------------------------------------------------
// Date helpers shared by the pages
// ---------------------------------------------------------------------------

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date for anything older than a month. */
export function timeAgo(iso: string | Date): string {
  const date = new Date(iso)
  const min = Math.round((Date.now() - date.getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.round(min / 60)} h ago`
  const days = Math.round(min / 1440)
  if (days <= 30) return days === 1 ? 'yesterday' : `${days} days ago`
  return date.toLocaleDateString()
}

/** Full local date and time, for tooltips next to a relative time. */
export function fullDate(iso: string | Date): string {
  return new Date(iso).toLocaleString()
}
