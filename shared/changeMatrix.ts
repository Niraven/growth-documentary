import type { Capture, Change } from './timeline.js'

export type ChangeMatrixMonth = { key: string; label: string }
export type ChangeMatrixRow = {
  field: 'title' | 'headline' | 'price'
  label: string
  counts: number[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ROWS: { field: ChangeMatrixRow['field']; label: string }[] = [
  { field: 'title', label: 'Page title' },
  { field: 'headline', label: 'Headline' },
  { field: 'price', label: 'Price string' },
]

const monthIndex = (ts: string): number => {
  const year = Number(ts.slice(0, 4))
  const month = Number(ts.slice(4, 6))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return -1
  return year * 12 + month - 1
}

const keyFor = (index: number): string => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`

/**
 * One cell per calendar month for each field the timeline reads. The baseline
 * row is a starting observation, not a change, so it is never counted.
 */
export function buildChangeMatrix(
  captures: Capture[],
  changes: Change[],
): { months: ChangeMatrixMonth[]; rows: ChangeMatrixRow[]; total: number } {
  if (captures.length === 0) return { months: [], rows: [], total: 0 }
  const start = monthIndex(captures[0].ts)
  const end = monthIndex(captures[captures.length - 1].ts)
  if (start < 0 || end < start) return { months: [], rows: [], total: 0 }

  const months = Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset
    return {
      key: keyFor(index),
      label: `${MONTHS[index % 12]} ${String(Math.floor(index / 12)).slice(2)}`,
    }
  })
  const columns = new Map(months.map((month, index) => [month.key, index]))
  const counts = new Map<string, number[]>(
    ROWS.map((row) => [row.field, Array.from({ length: months.length }, () => 0)]),
  )

  let total = 0
  for (const change of changes) {
    if (change.field === 'first capture') continue
    const column = columns.get(`${change.ts.slice(0, 4)}-${change.ts.slice(4, 6)}`)
    const row = counts.get(change.field)
    if (column === undefined || !row) continue
    row[column] += 1
    total += 1
  }

  return {
    months,
    rows: ROWS.map((row) => ({ ...row, counts: counts.get(row.field) ?? [] })),
    total,
  }
}
