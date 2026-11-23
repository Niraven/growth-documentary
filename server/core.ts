/**
 * Pure timeline logic. No HTTP, no Vite, no globals — everything here is
 * unit-testable and safe to import from a server, a script or a test.
 */

import type { Capture, Change, ChangeField, Timeline } from '../shared/timeline.js'

export type { Capture, Change, ChangeField, Timeline }

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
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export type BuildOptions = {
  fetchImpl?: FetchLike
  /** Delay between snapshot fetches. 0 in tests. */
  delayMs?: number
  /** Hard ceiling for the whole job. */
  timeoutMs?: number
  /** How many CDX rows to consider. */
  maxCaptures?: number
  /** Earliest year to query. */
  from?: number
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const USER_AGENT = 'growth-documentary/0.2 (+https://github.com/)'

/** `20240104213453` -> `4 Jan 2024`. Wayback timestamps are UTC. */
export function labelFor(ts: string): string {
  const year = ts.slice(0, 4)
  const month = MONTHS[Number(ts.slice(4, 6)) - 1] ?? ''
  const day = Number(ts.slice(6, 8))
  return `${day} ${month} ${year}`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(html: string, re: RegExp): string {
  const match = html.match(re)
  return match ? stripHtml(match[1]).slice(0, 160) : ''
}

/**
 * Price-like strings on a page. Deliberately conservative: `$0.49` per-unit
 * rates and absurd values are dropped, duplicates collapse, and the list is
 * capped so a pricing table cannot flood the diff.
 */
export function pricesIn(html: string): string[] {
  const text = stripHtml(html)
  const found = text.match(/(?:US)?\$\s?\d[\d,.]*(?:\s?\/\s?(?:mo|month|year|yr))?/gi) ?? []
  const cleaned = found
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => {
      const amount = Number(value.replace(/[^0-9.]/g, ''))
      return Number.isFinite(amount) && amount >= 1 && amount <= 100_000
    })
  return Array.from(new Set(cleaned)).slice(0, 6)
}

export function extractCapture(html: string, ts: string, archiveUrl: string): Capture {
  return {
    ts,
    label: labelFor(ts),
    title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    prices: pricesIn(html),
    url: archiveUrl,
  }
}

/**
 * Turn a user string into an archive target. Rejects anything that is not a
 * public-looking http(s) page; credentials and fragments are stripped.
 */
export function normaliseTarget(raw: string): URL {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new TimelineError('Enter a domain, for example stripe.com/pricing', 400)
  }
  if (trimmed.length > 300) {
    throw new TimelineError('That URL is too long (300 characters max)', 400)
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    throw new TimelineError('That is not a valid URL', 400)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TimelineError('Only http and https pages are supported', 400)
  }
  if (!url.hostname.includes('.') || /\s/.test(url.hostname)) {
    throw new TimelineError('That does not look like a public domain', 400)
  }
  url.hash = ''
  url.username = ''
  url.password = ''
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url
}

/** Compare consecutive captures and keep only observed differences. */
export function diffCaptures(captures: Capture[]): Change[] {
  const changes: Change[] = []

  captures.forEach((capture, index) => {
    if (index === 0) {
      changes.push({
        ts: capture.ts,
        label: capture.label,
        field: 'first capture',
        before: '',
        after: capture.title || capture.h1 || 'Page captured',
        url: capture.url,
      })
      return
    }

    const previous = captures[index - 1]
    if (capture.title && previous.title && capture.title !== previous.title) {
      changes.push({
        ts: capture.ts,
        label: capture.label,
        field: 'title',
        before: previous.title,
        after: capture.title,
        url: capture.url,
      })
    }
    if (capture.h1 && previous.h1 && capture.h1 !== previous.h1) {
      changes.push({
        ts: capture.ts,
        label: capture.label,
        field: 'headline',
        before: previous.h1,
        after: capture.h1,
        url: capture.url,
      })
    }
    const added = capture.prices.filter((price) => !previous.prices.includes(price))
    const removed = previous.prices.filter((price) => !capture.prices.includes(price))
    if (added.length || removed.length) {
      changes.push({
        ts: capture.ts,
        label: capture.label,
        field: 'price',
        before: removed.join(', ') || '—',
        after: added.join(', ') || '—',
        url: capture.url,
      })
    }
  })

  return changes
}

/** Build the dated timeline for one public page. */
export async function buildTimeline(raw: string, options: BuildOptions = {}): Promise<Timeline> {
  const {
    fetchImpl = globalThis.fetch as unknown as FetchLike,
    delayMs = 250,
    timeoutMs = 45_000,
    maxCaptures = 12,
    from = 2018,
  } = options

  const target = normaliseTarget(raw)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const get = async (url: string) => {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
    })
    if (!response.ok) throw new TimelineError(`Archive responded ${response.status}`, 502)
    return response
  }

  const rowsFor = async (path: string, collapse: string, limit: number) => {
    const cdx = new URL('https://web.archive.org/cdx/search/cdx')
    cdx.searchParams.set('url', path)
    cdx.searchParams.set('output', 'json')
    cdx.searchParams.set('filter', 'statuscode:200')
    cdx.searchParams.set('collapse', `timestamp:${collapse}`)
    cdx.searchParams.set('from', String(from))
    cdx.searchParams.set('limit', String(limit))
    const response = await get(cdx.toString())
    const payload = (await response.json()) as unknown
    return Array.isArray(payload) ? (payload as string[][]) : []
  }

  try {
    const rows = await rowsFor(target.hostname + target.pathname, '6', maxCaptures * 2)
    const captures: Capture[] = []

    for (const row of rows.slice(1, maxCaptures + 1)) {
      const ts = row[1]
      const snapshotUrl = `https://web.archive.org/web/${ts}id_/${target.href}`
      try {
        const response = await get(snapshotUrl)
        const html = await response.text()
        captures.push(extractCapture(html, ts, `https://web.archive.org/web/${ts}/${target.href}`))
      } catch {
        /* a snapshot that will not load is a gap, not a fatal error */
      }
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    if (captures.length === 0) {
      const siteRows = await rowsFor(target.hostname, '4', 6)
      if (siteRows.length < 2) {
        throw new TimelineError('No archived captures found for that page', 404)
      }
      throw new TimelineError(
        'That page is archived at the site level but its snapshots could not be read. Try the homepage or another path.',
        404,
      )
    }

    return {
      domain: target.hostname,
      path: target.pathname,
      captures,
      changes: diffCaptures(captures),
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    if (error instanceof TimelineError) throw error
    if ((error as Error)?.name === 'AbortError') {
      throw new TimelineError('The archive took too long to answer. Try again in a minute.', 504)
    }
    throw new TimelineError('Could not reach the Internet Archive', 502)
  } finally {
    clearTimeout(timer)
  }
}
