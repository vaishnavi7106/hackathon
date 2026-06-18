/** Merge Tailwind class names safely */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Format a date string for Tamil display */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('ta-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/** Truncate text to a max length with ellipsis */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}

/** Check whether a string looks like a URL */
export function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://')
}
