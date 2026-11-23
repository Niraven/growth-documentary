/**
 * The report contract, shared by the server and the UI.
 *
 * One definition means the API response and the component props cannot drift
 * apart. Values coming off the network are `unknown` until the guards accept
 * them.
 */

export type Capture = {
  ts: string
  label: string
  title: string
  h1: string
  prices: string[]
  url: string
}

export type ChangeField = 'title' | 'headline' | 'price' | 'first capture'

export type Change = {
  ts: string
  label: string
  field: ChangeField
  before: string
  after: string
  url: string
}

/** How the sampled captures cover the period being reported. */
export type Coverage = {
  /** First readable capture, `YYYYMMDDHHmmss`. */
  from: string
  /** Last readable capture, `YYYYMMDDHHmmss`. */
  to: string
  /** Inclusive month span between `from` and `to`. */
  months: number
  /** Captures read and compared. */
  sampled: number
  /** Distinct captures the archive listed before sampling. */
  available: number
  /** `adaptive`: evenly spread first, then extra captures where changes appeared. */
  strategy: 'adaptive'
}

export type Timeline = {
  domain: string
  path: string
  captures: Capture[]
  changes: Change[]
  coverage: Coverage
  checkedAt: string
}

/** One month of sitemap additions, `YYYY-MM`. */
export type SiteMonth = { month: string; added: number }

/**
 * What the site's own sitemap says about its page count. Sitemaps are
 * self-reported; `lastmod` is only as honest as the site that wrote it.
 */
export type SiteInfo = {
  domain: string
  /** Sitemap URL that was read, or null when none is archived. */
  sitemapUrl: string | null
  /** Date of the archived sitemap copy, `YYYY-MM-DD`. */
  archivedAt: string | null
  /** Unique page URLs in the sitemap. */
  pages: number
  /** URLs that carried a usable `lastmod`. */
  dated: number
  /** Additions per month, newest last, only months with at least one. */
  months: SiteMonth[]
  /** Child sitemaps read when the sitemap was an index. */
  children: number
  /** Plain-language note about where these numbers came from. */
  note: string
}

export type ErrorBody = { error: string }

const FIELDS: ReadonlySet<string> = new Set<ChangeField>([
  'title',
  'headline',
  'price',
  'first capture',
])

/** `YYYYMMDDHHmmss` in UTC milliseconds. */
export function tsToMs(ts: string): number {
  return Date.UTC(
    Number(ts.slice(0, 4)),
    Number(ts.slice(4, 6)) - 1,
    Number(ts.slice(6, 8)),
    Number(ts.slice(8, 10)) || 0,
    Number(ts.slice(10, 12)) || 0,
    Number(ts.slice(12, 14)) || 0,
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isCapture = (value: unknown): value is Capture =>
  isRecord(value) &&
  typeof value.ts === 'string' &&
  typeof value.label === 'string' &&
  typeof value.title === 'string' &&
  typeof value.h1 === 'string' &&
  typeof value.url === 'string' &&
  Array.isArray(value.prices) &&
  value.prices.every((price) => typeof price === 'string')

const isChange = (value: unknown): value is Change =>
  isRecord(value) &&
  typeof value.ts === 'string' &&
  typeof value.label === 'string' &&
  typeof value.field === 'string' &&
  FIELDS.has(value.field) &&
  typeof value.before === 'string' &&
  typeof value.after === 'string' &&
  typeof value.url === 'string'

const isCoverage = (value: unknown): value is Coverage =>
  isRecord(value) &&
  typeof value.from === 'string' &&
  typeof value.to === 'string' &&
  typeof value.months === 'number' &&
  typeof value.sampled === 'number' &&
  typeof value.available === 'number' &&
  value.strategy === 'adaptive'

/** Boundary check for `GET /api/timeline`. */
export function isTimeline(value: unknown): value is Timeline {
  return (
    isRecord(value) &&
    typeof value.domain === 'string' &&
    typeof value.path === 'string' &&
    typeof value.checkedAt === 'string' &&
    isCoverage(value.coverage) &&
    Array.isArray(value.captures) &&
    value.captures.every(isCapture) &&
    Array.isArray(value.changes) &&
    value.changes.every(isChange)
  )
}

const isSiteMonth = (value: unknown): value is SiteMonth =>
  isRecord(value) && typeof value.month === 'string' && typeof value.added === 'number'

/** Boundary check for `GET /api/site`. */
export function isSiteInfo(value: unknown): value is SiteInfo {
  return (
    isRecord(value) &&
    typeof value.domain === 'string' &&
    (value.sitemapUrl === null || typeof value.sitemapUrl === 'string') &&
    (value.archivedAt === null || typeof value.archivedAt === 'string') &&
    typeof value.pages === 'number' &&
    typeof value.dated === 'number' &&
    typeof value.children === 'number' &&
    typeof value.note === 'string' &&
    Array.isArray(value.months) &&
    value.months.every(isSiteMonth)
  )
}

/** Boundary check for an error response. */
export function isErrorBody(value: unknown): value is ErrorBody {
  return isRecord(value) && typeof value.error === 'string'
}
