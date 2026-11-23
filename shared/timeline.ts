/**
 * The report contract, shared by the server and the UI.
 *
 * One definition means the API response and the component props cannot drift
 * apart. Values coming off the network are `unknown` until `isTimeline`
 * accepts them.
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

export type Timeline = {
  domain: string
  path: string
  captures: Capture[]
  changes: Change[]
  checkedAt: string
}

export type ErrorBody = { error: string }

const FIELDS: ReadonlySet<string> = new Set<ChangeField>([
  'title',
  'headline',
  'price',
  'first capture',
])

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

/** Boundary check for `GET /api/timeline`. */
export function isTimeline(value: unknown): value is Timeline {
  return (
    isRecord(value) &&
    typeof value.domain === 'string' &&
    typeof value.path === 'string' &&
    typeof value.checkedAt === 'string' &&
    Array.isArray(value.captures) &&
    value.captures.every(isCapture) &&
    Array.isArray(value.changes) &&
    value.changes.every(isChange)
  )
}

/** Boundary check for an error response. */
export function isErrorBody(value: unknown): value is ErrorBody {
  return isRecord(value) && typeof value.error === 'string'
}
