/**
 * Safe first-party outcomes: a user imports a CSV in the browser. Nothing is
 * uploaded, fetched, persisted or joined to public events automatically.
 *
 * This is deliberately an import boundary, not a pretend OAuth connector.
 */

export type OutcomePoint = {
  date: string
  metric: string
  value: number
}

export type OutcomeParse = {
  points: OutcomePoint[]
  metrics: string[]
  errors: string[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_POINTS = 5000

/** Parse `date,metric,value` CSV with optional spaces and quoted fields. */
export function parseOutcomeCsv(text: string): OutcomeParse {
  const errors: string[] = []
  const points: OutcomePoint[] = []
  const seen = new Set<string>()
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const header = (lines.shift() ?? '').split(',').map((value) => value.trim().toLowerCase())
  const dateIndex = header.indexOf('date')
  const metricIndex = header.indexOf('metric')
  const valueIndex = header.indexOf('value')

  if (dateIndex < 0 || metricIndex < 0 || valueIndex < 0) {
    return {
      points: [],
      metrics: [],
      errors: ['CSV needs a header with date, metric, value.'],
    }
  }

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim()
    if (!line) continue
    const cells = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''))
    const date = cells[dateIndex] ?? ''
    const metric = cells[metricIndex] ?? ''
    const value = Number(cells[valueIndex])
    if (!DATE.test(date)) {
      errors.push(`Line ${index + 2}: date must be YYYY-MM-DD.`)
      continue
    }
    if (!metric) {
      errors.push(`Line ${index + 2}: metric is empty.`)
      continue
    }
    if (!Number.isFinite(value)) {
      errors.push(`Line ${index + 2}: value must be a number.`)
      continue
    }
    const key = `${date}\u0000${metric}`
    if (seen.has(key)) {
      errors.push(`Line ${index + 2}: duplicate ${date} / ${metric}; kept the first.`)
      continue
    }
    seen.add(key)
    points.push({ date, metric, value })
    if (points.length >= MAX_POINTS) {
      errors.push(`Stopped at ${MAX_POINTS} points.`)
      break
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric))
  return {
    points,
    metrics: [...new Set(points.map((point) => point.metric))].sort(),
    errors,
  }
}
