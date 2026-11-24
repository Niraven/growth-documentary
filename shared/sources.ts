/**
 * Public-source evidence, kept separate from the dated page timeline.
 *
 * The timeline is one source: archived HTML from the Wayback Machine. These
 * lanes add public context without pretending it is a page change. Every lane
 * reports whether it was read, empty, or unavailable, so a missing answer is
 * never drawn as a zero.
 */

export type SourceStatus = 'read' | 'empty' | 'unavailable'

export type MentionStory = {
  id: string
  title: string
  /** Hacker News discussion URL. */
  url: string
  /** The public URL that was submitted; null for text-only posts. */
  submittedUrl: string | null
  createdAt: string
  points: number
  comments: number
  author: string
}

export type MentionMonth = { month: string; count: number }

export type MentionsSource = {
  provider: 'Hacker News'
  status: SourceStatus
  /** Matching stories whose submitted URL points at the target host. */
  total: number
  /** True when the provider cap was reached; total is then a lower bound. */
  truncated: boolean
  /** Months with at least one matching story, oldest first. */
  months: MentionMonth[]
  /** A few cited stories, highest score first. */
  stories: MentionStory[]
  note: string
  checkedAt: string
}

export type ArchiveCapture = {
  ts: string
  label: string
  url: string
}

export type ArchivesSource = {
  provider: 'Arquivo.pt'
  status: SourceStatus
  /** Unique captures inspected; the provider's estimate is in `note`. */
  count: number
  first: string | null
  last: string | null
  /** The newest few captures, newest first. */
  captures: ArchiveCapture[]
  note: string
  checkedAt: string
}

export type SourcesReport = {
  domain: string
  checkedAt: string
  mentions: MentionsSource
  archives: ArchivesSource
}

const STATUSES: ReadonlySet<string> = new Set<SourceStatus>(['read', 'empty', 'unavailable'])
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isMentionStory = (value: unknown): value is MentionStory =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  isString(value.url) &&
  (value.submittedUrl === null || isString(value.submittedUrl)) &&
  isString(value.createdAt) &&
  isNumber(value.points) &&
  isNumber(value.comments) &&
  isString(value.author)

const isMentionMonth = (value: unknown): value is MentionMonth =>
  isRecord(value) && isString(value.month) && isNumber(value.count)

const isMentionsSource = (value: unknown): value is MentionsSource =>
  isRecord(value) &&
  value.provider === 'Hacker News' &&
  isString(value.status) &&
  STATUSES.has(value.status) &&
  isNumber(value.total) &&
  typeof value.truncated === 'boolean' &&
  isString(value.note) &&
  isString(value.checkedAt) &&
  Array.isArray(value.months) &&
  value.months.every(isMentionMonth) &&
  Array.isArray(value.stories) &&
  value.stories.every(isMentionStory)

const isArchiveCapture = (value: unknown): value is ArchiveCapture =>
  isRecord(value) && isString(value.ts) && isString(value.label) && isString(value.url)

const isArchivesSource = (value: unknown): value is ArchivesSource =>
  isRecord(value) &&
  value.provider === 'Arquivo.pt' &&
  isString(value.status) &&
  STATUSES.has(value.status) &&
  isNumber(value.count) &&
  (value.first === null || isString(value.first)) &&
  (value.last === null || isString(value.last)) &&
  isString(value.note) &&
  isString(value.checkedAt) &&
  Array.isArray(value.captures) &&
  value.captures.every(isArchiveCapture)

/** Boundary check for `GET /api/sources`. */
export function isSourcesReport(value: unknown): value is SourcesReport {
  return (
    isRecord(value) &&
    isString(value.domain) &&
    isString(value.checkedAt) &&
    isMentionsSource(value.mentions) &&
    isArchivesSource(value.archives)
  )
}
