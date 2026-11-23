import type { Timeline } from '../../shared/timeline'

const dateLabel = (date: Date): string =>
  date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

/**
 * A citation with every fact the report actually established: the two ends of
 * the coverage window, how many captures were read, and how many field changes
 * were observed. No claim about revenue, traffic or cause.
 */
export function citationFor(
  report: Timeline,
  options: { accessed?: Date; link?: string } = {},
): string {
  const accessed = options.accessed ?? new Date()
  const first = report.captures[0]
  const last = report.captures[report.captures.length - 1]
  const changes = report.changes.filter((change) => change.field !== 'first capture').length
  const link = options.link ?? last?.url ?? ''

  return [
    `Growth Documentary — "${report.domain}${report.path}",`,
    `${first?.label ?? 'unknown date'} to ${last?.label ?? 'unknown date'}`,
    `(${report.coverage.sampled} archived captures read; ${changes} field ${changes === 1 ? 'change' : 'changes'}).`,
    'Internet Archive Wayback Machine.',
    `Accessed ${dateLabel(accessed)}.`,
    link,
  ]
    .filter(Boolean)
    .join(' ')
}
