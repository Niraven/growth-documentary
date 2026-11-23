/**
 * One on-demand read of a public page, after robots.txt permits it.
 *
 * This is not a crawler and not a history source. A live read has no timestamp
 * in the archive, so it can never become a dated change row. It exists to
 * answer "what does the page say right now?", which is a different question
 * from "what changed, and when?".
 *
 * Safety, in order: public hostname, DNS resolves only to public addresses,
 * same-host redirects only, no cookies or credentials, HTML only, a byte cap,
 * and a robots.txt check before the page is fetched.
 */

import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { LiveCheck } from '../shared/timeline.js'
import { TimelineError, USER_AGENT, type FetchLike } from './archive.js'
import { normaliseTarget, readVisibleFields } from './core.js'

export type LookupRecord = { address: string; family: number }
export type Lookup = (host: string) => Promise<LookupRecord[]>

export type LiveOptions = {
  fetchImpl?: FetchLike
  lookupImpl?: Lookup
  /** Whole live check budget. */
  timeoutMs?: number
  /** HTML cap; a page larger than this is not a page this tool reads. */
  maxBytes?: number
}

const MAX_REDIRECTS = 3
const ROBOTS_TTL_MS = 10 * 60 * 1000
const robotsCache = new Map<string, { at: number; allows: boolean }>()
const ENGINE = 'growth-documentary'

const defaultLookup: Lookup = async (host) =>
  (await dnsLookup(host, { all: true, verbatim: true })) as LookupRecord[]

/** True only for addresses that are safe to reach on the public internet. */
export function isPublicAddress(raw: string): boolean {
  const address = raw.trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]

  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number)
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false
    }
    const [a, b] = parts
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if (a === 192 && b === 0) return false
    if (a === 198 && b === 51) return false
    if (a === 203 && b === 0) return false
    if (a >= 224) return false
    return true
  }

  if (isIP(address) === 6) {
    if (address === '::' || address === '::1') return false
    if (address.startsWith('::ffff:')) return isPublicAddress(address.slice(7))
    if (address.startsWith('fc') || address.startsWith('fd')) return false
    if (/^fe[89ab]/.test(address)) return false
    if (address.startsWith('ff')) return false
    if (address.startsWith('2001:db8')) return false
    return true
  }

  return false
}

async function resolvePublic(host: string, lookupImpl: Lookup): Promise<void> {
  let records: LookupRecord[]
  try {
    records = await lookupImpl(host)
  } catch {
    throw new TimelineError('Could not resolve that domain', 400)
  }
  if (records.length === 0) {
    throw new TimelineError('Could not resolve that domain', 400)
  }
  if (records.some((record) => !isPublicAddress(record.address))) {
    throw new TimelineError('That domain resolves to a private address', 400)
  }
}

/**
 * robots.txt group selection. A group naming this agent wins over `*`; within
 * the chosen groups the longest matching rule wins, and Allow wins a tie.
 * Wildcards (`*`) are supported; `$` anchors are rare enough to be ignored and
 * documented as such.
 */
export function robotsAllows(text: string, path: string, agent = ENGINE): boolean {
  type Rule = { allow: boolean; path: string }
  type Group = { agents: string[]; rules: Rule[] }
  const groups: Group[] = []
  let current: Group | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (key === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
    } else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push({ allow: key === 'allow', path: value })
    }
  }

  const token = agent.toLowerCase()
  const specific = groups.filter((group) =>
    group.agents.some((name) => name !== '*' && (token.startsWith(name) || name.includes(token))),
  )
  const chosen = specific.length > 0 ? specific : groups.filter((group) => group.agents.includes('*'))
  if (chosen.length === 0) return true

  const matches = (pattern: string): boolean => {
    if (!pattern) return false
    const body = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    try {
      return new RegExp(`^${body}`).test(path)
    } catch {
      return false
    }
  }

  let verdict: boolean | null = null
  let best = -1
  for (const rule of chosen.flatMap((group) => group.rules)) {
    if (!matches(rule.path)) continue
    const length = rule.path.replace(/\*/g, '').length
    if (length > best || (length === best && rule.allow && verdict === false)) {
      best = length
      verdict = rule.allow
    }
  }
  return verdict ?? true
}

async function readCapped(
  response: Awaited<ReturnType<FetchLike>>,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers?.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new TimelineError('That page is too large to read', 502)
  }

  const body = (response as unknown as { body?: ReadableStream<Uint8Array> }).body
  if (!body) {
    const text = await response.text()
    if (Buffer.byteLength(text) > maxBytes) {
      throw new TimelineError('That page is too large to read', 502)
    }
    return text
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new TimelineError('That page is too large to read', 502)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function getSameHost(
  fetchImpl: FetchLike,
  start: URL,
  signal: AbortSignal,
  headers: Record<string, string>,
): Promise<{ response: Awaited<ReturnType<FetchLike>>; finalUrl: URL }> {
  let current = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(current.href, { signal, headers, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get('location')
      if (!location) throw new TimelineError('The page redirected without a location', 502)
      const next = new URL(location, current)
      if (
        (next.protocol !== 'http:' && next.protocol !== 'https:') ||
        next.hostname !== start.hostname ||
        next.port !== start.port
      ) {
        throw new TimelineError('The page redirected to another site', 502)
      }
      current = next
      continue
    }
    return { response, finalUrl: current }
  }
  throw new TimelineError('The page redirected too many times', 502)
}

async function robotsAllowsUrl(
  target: URL,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<boolean> {
  const key = target.origin
  const hit = robotsCache.get(key)
  if (hit && Date.now() - hit.at < ROBOTS_TTL_MS) return hit.allows

  const robots = new URL('/robots.txt', target.origin)
  let allows = true
  try {
    const { response } = await getSameHost(fetchImpl, robots, signal, {
      'user-agent': USER_AGENT,
      accept: 'text/plain',
    })
    if (response.ok) {
      allows = robotsAllows(await readCapped(response, 64_000), target.pathname)
    } else if (response.status === 401 || response.status === 403) {
      allows = false
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    // No reachable robots.txt is treated as "no rules", except when the host
    // itself failed the public-address check — that must not be swallowed.
    if (error instanceof TimelineError && /private address|resolve/.test(error.message)) throw error
    allows = true
  }

  if (robotsCache.size > 200) robotsCache.clear()
  robotsCache.set(key, { at: Date.now(), allows })
  return allows
}

export async function fetchLive(raw: string, options: LiveOptions = {}): Promise<LiveCheck> {
  const {
    fetchImpl = globalThis.fetch as unknown as FetchLike,
    lookupImpl = defaultLookup,
    timeoutMs = 15_000,
    maxBytes = 2_000_000,
  } = options

  const target = normaliseTarget(raw)
  await resolvePublic(target.hostname, lookupImpl)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const abortError = () => new TimelineError('The live page took too long to answer', 504)

  try {
    const allowed = await robotsAllowsUrl(target, fetchImpl, controller.signal)
    if (!allowed) {
      throw new TimelineError('robots.txt asks this tool not to read that page', 403)
    }

    const { response, finalUrl } = await getSameHost(fetchImpl, target, controller.signal, {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    })

    if (!response.ok) {
      throw new TimelineError(`The live page responded ${response.status}`, 502)
    }
    const type = response.headers?.get('content-type') ?? ''
    if (type && !/text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new TimelineError('That URL is not an HTML page', 415)
    }

    const fields = readVisibleFields(await readCapped(response, maxBytes))
    if (!fields.title && !fields.h1 && fields.prices.length === 0) {
      throw new TimelineError('That page had no readable title, headline or prices', 502)
    }

    return {
      domain: target.hostname,
      path: target.pathname,
      fetchedAt: new Date().toISOString(),
      finalUrl: finalUrl.href,
      ...fields,
      robots: 'allowed',
    }
  } catch (error) {
    if (error instanceof TimelineError) throw error
    if ((error as Error)?.name === 'AbortError') throw abortError()
    throw new TimelineError('Could not reach that page', 502)
  } finally {
    clearTimeout(timer)
  }
}
