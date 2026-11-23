/**
 * Pure timeline logic. No HTTP framework, no Vite, no globals — everything
 * here is unit-testable and safe to import from a server, a script or a test.
 */

import { parse } from 'parse5'

import type { Capture, Change, ChangeField, Coverage, Timeline } from '../shared/timeline.js'
import {
  ArchiveClient,
  TimelineError,
  captureUrl,
  snapshotUrl,
  type FetchLike,
} from './archive.js'

export { TimelineError }
export type { Capture, Change, ChangeField, FetchLike, Timeline }

export type BuildOptions = {
  fetchImpl?: FetchLike
  /** Delay between snapshot fetches. 0 in tests. */
  delayMs?: number
  /** Hard ceiling for the whole job. */
  timeoutMs?: number
  /** Most captures to read before refining around changes. */
  maxCaptures?: number
  /** Earliest archive date to query, `YYYYMMDD`. */
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

/** `20240104213453` -> `4 Jan 2024`. Wayback timestamps are UTC. */
export function labelFor(ts: string): string {
  const year = ts.slice(0, 4)
  const month = MONTHS[Number(ts.slice(4, 6)) - 1] ?? ''
  const day = Number(ts.slice(6, 8))
  return `${day} ${month} ${year}`
}

/** Inclusive month span, e.g. Jan 2024 to Jan 2024 = 1 month. */
export function monthsBetween(from: string, to: string): number {
  const start = Number(from.slice(0, 4)) * 12 + Number(from.slice(4, 6)) - 1
  const end = Number(to.slice(0, 4)) * 12 + Number(to.slice(4, 6)) - 1
  return Math.max(1, end - start + 1)
}

/** Wayback `from` value for 24 months ago, so "two years" means two years. */
const defaultFrom = (): number => {
  const date = new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return Number(`${date.getUTCFullYear()}${month}${day}`)
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

export const parseHtml = (html: string): HtmlNode => parse(html) as unknown as HtmlNode

/**
 * Price-like strings on a page. Deliberately conservative: `$0.49` per-unit
 * rates and absurd values are dropped, duplicates collapse, and the list is
 * capped so a pricing table cannot flood the diff.
 */
export function pricesIn(html: string): string[] {
  const doc = parseHtml(html)
  const body = findTag(doc, 'body') ?? doc
  const text = cleanText(textOf(body))
  const found =
    text.match(
      /(?:US)?\$\s?\d[\d,.]*(?:\s*\/\s*(?:(?:mo|month|year|yr)|(?:seat|user|member|admin|employee|agent|workspace)\s*\/\s*(?:mo|month|year|yr)))?(?:[\s,]+per\s+(?:\d+\s+)?[a-z][a-z-]*)?/gi,
    ) ?? []
  const cleaned = found
    .map((value) =>
      value
        .replace(/\s+/g, ' ')
        .replace(/\$\s+/g, '$')
        .replace(/\s*\/\s*/g, '/')
        .trim(),
    )
    .filter((value) => {
      const amount = priceAmount(value)
      return Number.isFinite(amount) && amount >= 1 && amount <= 100_000
    })
  return Array.from(new Set(cleaned)).slice(0, 6)
}

const priceAmount = (value: string): number => {
  const match = /^(?:US)?\$\s*([\d,]+(?:\.\d+)?)/i.exec(value.trim())
  return match ? Number(match[1].replace(/,/g, '')) : 0
}

/** Stable display order, so an order-only shuffle is not shown as a change. */
export const sortPrices = (prices: string[]): string[] =>
  [...prices].sort((a, b) => priceAmount(a) - priceAmount(b) || a.localeCompare(b))

/** The three visible fields, from one HTML document. */
export function readVisibleFields(html: string): {
  title: string
  h1: string
  prices: string[]
} {
  const doc = parseHtml(html)
  return {
    title: cleanText(textOf(findTag(doc, 'title'))).slice(0, 160),
    h1: cleanText(textOf(findTag(doc, 'h1'))).slice(0, 160),
    prices: pricesIn(html),
  }
}

export function extractCapture(html: string, ts: string, archiveUrl: string): Capture {
  return {
    ts,
    label: labelFor(ts),
    ...readVisibleFields(html),
    url: archiveUrl,
  }
}

const LOCAL_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.home',
  '.lan',
  '.test',
  '.invalid',
  '.example',
]

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
    // that lost its pricing block is unreadable evidence, not a deletion. The
    // before/after values are the full price lists, not just the delta, so a
    // row reads as a state change rather than an unexplained "—".
    if (previous.prices.length > 0 && capture.prices.length > 0 && (added.length || removed.length)) {
      changes.push({
        ts: capture.ts,
        label: capture.label,
        field: 'price',
        before: sortPrices(previous.prices).join(', '),
        after: sortPrices(capture.prices).join(', '),
        url: capture.url,
      })
    }
  })

  return changes
}

/**
 * Spread `count` samples across the listed timestamps. Always keeps the first
 * and last capture, then repeatedly adds the capture that sits furthest from
 * everything chosen so far. This is robust to months with ten captures and
 * months with none, which fixed-interval sampling is not.
 */
export function pickEven(timestamps: string[], count: number): string[] {
  const unique = Array.from(new Set(timestamps)).sort()
  if (count >= unique.length) return unique
  if (count <= 0) return []
  if (count === 1) return [unique[0]]

  const chosen = new Set<number>([0, unique.length - 1])
  const distance = new Array<number>(unique.length).fill(Number.POSITIVE_INFINITY)

  const relax = (index: number) => {
    for (let i = 0; i < unique.length; i += 1) {
      distance[i] = Math.min(distance[i], Math.abs(i - index))
    }
  }
  relax(0)
  relax(unique.length - 1)

  while (chosen.size < count) {
    let best = -1
    let bestDistance = -1
    for (let i = 0; i < unique.length; i += 1) {
      if (chosen.has(i)) continue
      if (distance[i] > bestDistance) {
        bestDistance = distance[i]
        best = i
      }
    }
    if (best < 0) break
    chosen.add(best)
    relax(best)
  }

  return Array.from(chosen)
    .sort((a, b) => a - b)
    .map((index) => unique[index])
}

/**
 * Second sampling pass: for every observed change, add the capture halfway
 * between the change and the previous sample, so the moment it happened is
 * bracketed more tightly. Never exceeds the remaining budget.
 */
export function refineSelection(
  all: string[],
  sampled: string[],
  changes: Change[],
  budget: number,
): string[] {
  const taken = new Set(sampled)
  const extra = new Set<string>()
  let remaining = Math.max(0, budget - sampled.length)

  for (const change of changes) {
    if (remaining === 0) break
    if (change.field === 'first capture') continue
    const at = all.indexOf(change.ts)
    if (at <= 0) continue
    let previous = -1
    for (let i = at - 1; i >= 0; i -= 1) {
      if (taken.has(all[i])) {
        previous = i
        break
      }
    }
    if (previous < 0) continue
    const middle = all[Math.floor((previous + at) / 2)]
    if (!middle || taken.has(middle) || extra.has(middle)) continue
    extra.add(middle)
    remaining -= 1
  }

  return Array.from(extra).sort()
}

/** Build the dated timeline for one public page. */
export async function buildTimeline(raw: string, options: BuildOptions = {}): Promise<Timeline> {
  const {
    fetchImpl = globalThis.fetch as unknown as FetchLike,
    delayMs = 120,
    timeoutMs = 90_000,
    maxCaptures = 24,
    from = defaultFrom(),
  } = options

  const target = normaliseTarget(raw)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const client = new ArchiveClient(fetchImpl, controller.signal)

  const abortError = () =>
    new TimelineError('The archive took too long to answer. Try again in a minute.', 504)

  const wait = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    if (controller.signal.aborted) throw abortError()
  }

  try {
    const rows = await client.rows({ url: target.href, collapse: '8', limit: 400, from })

    const indexedByTs = new Map<string, string>()
    for (const row of rows.slice(1)) {
      const ts = row[1]
      if (!/^\d{14}$/.test(ts ?? '')) continue
      const indexed =
        typeof row[2] === 'string' && /^https?:\/\//i.test(row[2]) ? row[2] : target.href
      if (!indexedByTs.has(ts)) indexedByTs.set(ts, indexed)
    }

    const available = Array.from(indexedByTs.keys()).sort()
    if (available.length === 0) {
      throw new TimelineError('No archived captures found for that page', 404)
    }

    const readCapture = async (ts: string): Promise<Capture | null> => {
      const indexed = indexedByTs.get(ts) ?? target.href
      try {
        const response = await client.get(snapshotUrl(ts, indexed))
        const html = await response.text()
        const capture = extractCapture(html, ts, captureUrl(ts, indexed))
        // An empty shell is not evidence: it cannot support a before/after claim.
        return capture.title || capture.h1 || capture.prices.length > 0 ? capture : null
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw abortError()
        /* a snapshot that will not load is a gap, not a fatal error */
        return null
      }
    }

    const readMany = async (timestamps: string[]): Promise<Capture[]> => {
      const out: Capture[] = []
      let cursor = 0
      // Three at a time: fast enough to feel responsive, still polite to the
      // archive. Order is restored by the timestamp sort after each pass.
      const workers = Array.from({ length: Math.min(3, timestamps.length) }, async () => {
        while (cursor < timestamps.length) {
          const index = cursor
          cursor += 1
          const capture = await readCapture(timestamps[index])
          if (capture) out.push(capture)
          if (delayMs > 0 && index < timestamps.length - 1) await wait(delayMs)
        }
      })
      await Promise.all(workers)
      return out
    }

    const budget = Math.max(2, Math.min(maxCaptures, 40))
    const firstPass = pickEven(available, Math.min(12, budget))
    let captures = (await readMany(firstPass)).sort((a, b) => a.ts.localeCompare(b.ts))

    if (captures.length === 0) {
      throw new TimelineError(
        'The archive lists captures for that page but none could be read. Try again shortly.',
        502,
      )
    }

    let changes = diffCaptures(captures)

    if (budget > captures.length) {
      const extra = refineSelection(
        available,
        captures.map((capture) => capture.ts),
        changes,
        budget,
      )
      if (extra.length > 0) {
        const more = await readMany(extra)
        if (more.length > 0) {
          captures = [...captures, ...more].sort((a, b) => a.ts.localeCompare(b.ts))
          changes = diffCaptures(captures)
        }
      }
    }

    if (controller.signal.aborted) throw abortError()

    const coverage: Coverage = {
      from: captures[0].ts,
      to: captures[captures.length - 1].ts,
      months: monthsBetween(captures[0].ts, captures[captures.length - 1].ts),
      sampled: captures.length,
      available: available.length,
      strategy: 'adaptive',
    }

    return {
      domain: target.hostname,
      path: target.pathname,
      captures,
      changes,
      coverage,
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    if (error instanceof TimelineError) throw error
    if ((error as Error)?.name === 'AbortError') throw abortError()
    throw new TimelineError('Could not reach the Internet Archive', 502)
  } finally {
    clearTimeout(timer)
  }
}
