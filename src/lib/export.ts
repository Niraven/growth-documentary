import type { Timeline } from '../../shared/timeline'

/** A filename that survives every filesystem, derived from the report target. */
export function reportSlug(report: Timeline): string {
  const raw = `${report.domain}${report.path}`
    .replace(/^www\./i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return raw || 'report'
}

/**
 * Spreadsheet cells are executable. A value that begins with a formula marker
 * is prefixed with an apostrophe so Excel and Sheets treat it as text.
 */
const csvCell = (value: string): string => {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function reportCsv(report: Timeline): string {
  const header = ['date', 'timestamp', 'field', 'before', 'after', 'capture_url']
  const rows = report.changes.map((change) => [
    change.label,
    change.ts,
    change.field === 'first capture' ? 'baseline' : change.field,
    change.before,
    change.after,
    change.url,
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function reportJson(report: Timeline): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: 'growth-documentary',
      report,
    },
    null,
    2,
  )
}

export function downloadFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 0)
}
