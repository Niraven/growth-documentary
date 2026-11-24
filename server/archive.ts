/**
 * Archive transport. Every outbound request in this app goes through here, so
 * the "we only talk to web.archive.org" guarantee has exactly one place to
 * enforce and one place to test.
 */

export class TimelineError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TimelineError'
    this.status = status
  }
}

export type FetchLike = (
  url: string,
  init?: {
    signal?: AbortSignal
    headers?: Record<string, string>
    redirect?: 'follow' | 'manual'
  },
) => Promise<{
  ok: boolean
  status: number
  url?: string
  headers?: { get: (name: string) => string | null }
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export const ARCHIVE_ORIGIN = 'https://web.archive.org'
export const USER_AGENT = 'growth-documentary/0.12.0 (+https://github.com/Niraven/growth-documentary)'

export type CdxQuery = {
  /** Exact URL to look up, including query string. */
  url: string
  /** One capture per N digits of the timestamp: `8` = per day, `6` = per month. */
  collapse?: string
  /** Rows to return, ascending by time. Ignored when `last` is set. */
  limit?: number
  /** Return the last N rows instead of the first N. */
  last?: number
  /** Earliest year to include. */
  from?: number
}

export class ArchiveClient {
  private readonly fetchImpl: FetchLike
  private readonly signal: AbortSignal

  constructor(fetchImpl: FetchLike, signal: AbortSignal) {
    this.fetchImpl = fetchImpl
    this.signal = signal
  }

  /**
   * GET an archive URL. Redirects are followed by hand, one hop at a time, so
   * an off-site redirect can never be fetched or read.
   */
  async get(url: string) {
    let current = url
    for (let hop = 0; hop <= 3; hop += 1) {
      const response = await this.fetchImpl(current, {
        signal: this.signal,
        headers: { 'user-agent': USER_AGENT },
        redirect: 'manual',
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get('location')
        if (!location) throw new TimelineError('Archive redirect had no location', 502)
        const next = new URL(location, current)
        if (next.origin !== ARCHIVE_ORIGIN) {
          throw new TimelineError('Archive redirected off-site', 502)
        }
        current = next.toString()
        continue
      }
      if (!response.ok) throw new TimelineError(`Archive responded ${response.status}`, 502)
      if (response.url && new URL(response.url).origin !== ARCHIVE_ORIGIN) {
        throw new TimelineError('Archive redirected off-site', 502)
      }
      return response
    }
    throw new TimelineError('Archive redirected too many times', 502)
  }

  /** CDX index rows, header included when the archive returns one. */
  async rows(query: CdxQuery): Promise<string[][]> {
    const cdx = new URL(`${ARCHIVE_ORIGIN}/cdx/search/cdx`)
    cdx.searchParams.set('url', query.url)
    cdx.searchParams.set('output', 'json')
    cdx.searchParams.set('filter', 'statuscode:200')
    if (query.collapse) cdx.searchParams.set('collapse', `timestamp:${query.collapse}`)
    if (query.from) cdx.searchParams.set('from', String(query.from))
    cdx.searchParams.set('limit', String(query.last ? -query.last : (query.limit ?? 100)))

    const response = await this.get(cdx.toString())
    const payload = (await response.json()) as unknown
    if (!Array.isArray(payload)) {
      throw new TimelineError('Unexpected response from the Internet Archive', 502)
    }
    if (payload.length > 0 && !payload.every((row) => Array.isArray(row))) {
      throw new TimelineError('Unexpected response from the Internet Archive', 502)
    }
    return payload as string[][]
  }
}

/** A readable snapshot URL: `id_` returns the raw archived bytes. */
export function snapshotUrl(ts: string, url: string): string {
  return `${ARCHIVE_ORIGIN}/web/${ts}id_/${url}`
}

/** A human-facing capture URL. */
export function captureUrl(ts: string, url: string): string {
  return `${ARCHIVE_ORIGIN}/web/${ts}/${url}`
}
