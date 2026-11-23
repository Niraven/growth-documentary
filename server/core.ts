/**
 * Pure timeline logic. No HTTP, no Vite, no globals — everything here is
 * unit-testable and safe to import from a server, a script or a test.
 */

import { parse } from 'parse5'

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

type HtmlNode = {
  nodeName: string
  tagName?: string
  value?: string
  childNodes?: HtmlNode[]
}

const SKIP_TAGS = new Set(['script', 'style', 'template', 'noscript'])

/** Visible text of a subtree; script, style, template and noscript are inert. */
function textOf(node: HtmlNode | undefined): string {
  if (!node) return ''
  if (node.nodeName === '#text') return node.value ?? ''
  if (node.nodeName === '#comment' || node.nodeName === '#documentType') return ''
  if (node.tagName && SKIP_TAGS.has(node.tagName)) return ''
  let out = ''
  for (const child of node.childNodes ?? []) out += ` ${textOf(child)}`
  return out
}

function findTag(node: HtmlNode | undefined, tag: string): HtmlNode | undefined {
  if (!node) return undefined
  if (node.tagName === tag) return node
  if (node.tagName && SKIP_TAGS.has(node.tagName)) return undefined
  for (const child of node.childNodes ?? []) {
    const found = findTag(child, tag)
    if (found) return found
  }
  return undefined
}

const cleanText = (value: string): string => value.replace(/\s+/g, ' ').trim()

const parseHtml = (html: string): HtmlNode => parse(html) as unknown as HtmlNode

/**
 * Price-like strings on a page. Deliberately conservative: `$0.49` per-unit
 * rates and absurd values are dropped, duplicates collapse, and the list is
 * capped so a pricing table cannot flood the diff.
 */
export function pricesIn(html: string): string[] {
  const doc = parseHtml(html)
  const body = findTag(doc, 'body') ?? doc
  const text = cleanText(textOf(body))
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
  const doc = parseHtml(html)
  return {
    ts,
    label: labelFor(ts),
    title: cleanText(textOf(findTag(doc, 'title'))).slice(0, 160),
    h1: cleanText(textOf(findTag(doc, 'h1'))).slice(0, 160),
    prices: pricesIn(html),
    url: archiveUrl,
  }
}

const LOCAL_SUFFIXES = ['.local', '.localhost', '.internal', '.home', '.lan', '.test', '.invalid', '.example']

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host.includes(':')
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
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

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (host !== url.hostname) url.hostname = host
  if (isIpLiteral(host) && isPrivateIpv4(host)) {
    throw new TimelineError('Use a public domain, not a local or private address', 400)
  }
  if (isIpLiteral(host)) {
    throw new TimelineError('Use a domain name, not an IP address', 400)
  }
  if (host === 'localhost' || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new TimelineError('Use a public domain, not a local or private address', 400)
  }
  if (!host.includes('.') || /\s/.test(host)) {
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
    // Only claim a price change when both captures actually show prices. A page
    // that lost its pricing block is unreadable evidence, not a deletion.
    if (previous.prices.length > 0 && capture.prices.length > 0 && (added.length || removed.length)) {
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

  const ARCHIVE_ORIGIN = 'https://web.archive.org'

  // Redirects are followed by hand, one hop at a time, so an off-site
  // redirect can never be fetched or read.
  const getArchive = async (url: string) => {
    let current = url
    for (let hop = 0; hop <= 3; hop += 1) {
      const response = await fetchImpl(current, {
        signal: controller.signal,
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

  const rowsFor = async (path: string, collapse: string, limit: number) => {
    const cdx = new URL('https://web.archive.org/cdx/search/cdx')
    cdx.searchParams.set('url', path)
    cdx.searchParams.set('output', 'json')
    cdx.searchParams.set('filter', 'statuscode:200')
    cdx.searchParams.set('collapse', `timestamp:${collapse}`)
    cdx.searchParams.set('from', String(from))
    cdx.searchParams.set('limit', String(limit))
    const response = await getArchive(cdx.toString())
    const payload = (await response.json()) as unknown
    if (!Array.isArray(payload)) {
      throw new TimelineError('Unexpected response from the Internet Archive', 502)
    }
    if (payload.length > 0 && !payload.every((row) => Array.isArray(row))) {
      throw new TimelineError('Unexpected response from the Internet Archive', 502)
    }
    return payload as string[][]
  }

  try {
    // The full normalised URL, including any query string, so a query-specific
    // pricing page is not silently swapped for its bare path.
    const rows = await rowsFor(target.href, '6', maxCaptures * 2)
    const captures: Capture[] = []

    const rowsToRead = rows
      .slice(1, maxCaptures + 1)
      .filter((row) => /^\d{14}$/.test(row[1] ?? ''))

    for (const [index, row] of rowsToRead.entries()) {
      const ts = row[1]
      // Cite the URL the archive actually indexed when it is valid, so the
      // printed link and the fetched snapshot are the same page variant.
      const indexed =
        typeof row[2] === 'string' && /^https?:\/\//i.test(row[2]) ? row[2] : target.href
      const snapshotUrl = `https://web.archive.org/web/${ts}id_/${indexed}`
      try {
        const response = await getArchive(snapshotUrl)
        const html = await response.text()
        const capture = extractCapture(html, ts, `https://web.archive.org/web/${ts}/${indexed}`)
        // An empty shell is not evidence: it cannot support a before/after claim.
        if (capture.title || capture.h1 || capture.prices.length > 0) captures.push(capture)
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          throw new TimelineError('The archive took too long to answer. Try again in a minute.', 504)
        }
        /* a snapshot that will not load is a gap, not a fatal error */
      }
      if (delayMs > 0 && index < rowsToRead.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        if (controller.signal.aborted) {
          throw new TimelineError('The archive took too long to answer. Try again in a minute.', 504)
        }
      }
    }

    if (captures.length === 0) {
      if (rows.length < 2) {
        throw new TimelineError('No archived captures found for that page', 404)
      }
      throw new TimelineError(
        'The archive lists captures for that page but none could be read. Try again shortly.',
        502,
      )
    }

    if (controller.signal.aborted) {
      throw new TimelineError('The archive took too long to answer. Try again in a minute.', 504)
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
