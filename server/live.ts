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
const robotsCache = new Map<string, { at: number; text: string }>()
const ENGINE = 'growth-documentary'

const defaultLookup: Lookup = async (host) =>
  (await dnsLookup(host, { all: true, verbatim: true })) as LookupRecord[]

/** Parse an IPv6 address to 16 bytes; null when the text is not valid IPv6. */
const ipv6Bytes = (input: string): Uint8Array | null => {
  let address = input.split('%')[0]
  if (address.includes('.')) {
    const colon = address.lastIndexOf(':')
    if (colon < 0) return null
    const parts = address
      .slice(colon + 1)
      .split('.')
      .map(Number)
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null
    }
    address = `${address.slice(0, colon + 1)}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`
  }

  const halves = address.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  if (halves.length === 1 && head.length !== 8) return null
  const missing = 8 - head.length - tail.length
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail]
  if (groups.length !== 8) return null

  const bytes = new Uint8Array(16)
  for (let index = 0; index < 8; index += 1) {
    if (!/^[0-9a-f]{1,4}$/i.test(groups[index])) return null
    const value = Number.parseInt(groups[index], 16)
    bytes[index * 2] = value >> 8
    bytes[index * 2 + 1] = value & 0xff
  }
  return bytes
}

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
    const bytes = ipv6Bytes(address)
    if (!bytes) return false

    const allZero = bytes.every((byte) => byte === 0)
    const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1
    if (allZero || loopback) return false

    // IPv4-compatible (deprecated, ::/96) can spell loopback as ::7f00:1.
    if (bytes.slice(0, 12).every((byte) => byte === 0)) return false

    // IPv4-mapped (::ffff:0:0/96): validate the embedded IPv4 address.
    if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
      return isPublicAddress(`${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`)
    }

    // IPv4-translated (::ffff:0:0/96): bytes 8-9 are ffff, bytes 10-11 are zero,
    // and the IPv4 address lives in the last four bytes.
    if (
      bytes.slice(0, 8).every((byte) => byte === 0) &&
      bytes[8] === 0xff &&
      bytes[9] === 0xff &&
      bytes[10] === 0 &&
      bytes[11] === 0
    ) {
      return isPublicAddress(`${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`)
    }

    // NAT64 and 6to4 embed IPv4 in ranges that do not prove the embedded address.
    if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) return false
    if (bytes[0] === 0x20 && bytes[1] === 0x02) return false

    if ((bytes[0] & 0xfe) === 0xfc) return false // unique local fc00::/7
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false // link-local fe80::/10
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return false // site-local fec0::/10
    if (bytes[0] === 0xff) return false // multicast
    if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false // docs
    return true
  }

  return false
}

export async function resolvePublic(host: string, lookupImpl: Lookup): Promise<LookupRecord[]> {
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
  return records
}

const MAX_ROBOTS_RULE_LENGTH = 256
const MAX_ROBOTS_RULES = 500

/**
 * Wildcard match without a regex. A robots.txt pattern is attacker-controlled
 * and a compiled `.*` chain backtracks catastrophically on a long path; this
 * dynamic-programming matcher is bounded by pattern length × path length and
 * cannot block the event loop on a hostile file.
 *
 * Unanchored rules match a prefix, per RFC 9309. Appending a trailing `*`
 * turns prefix matching into a full match without a second code path.
 */
function globMatches(pattern: string, text: string): boolean {
  if (!pattern) return false
  const anchored = pattern.endsWith('$')
  const glob = anchored ? pattern.slice(0, -1) : `${pattern}*`
  if (!glob) return false

  const length = text.length
  let previous = new Uint8Array(length + 1)
  previous[0] = 1

  for (let p = 0; p < glob.length; p += 1) {
    const next = new Uint8Array(length + 1)
    if (glob[p] === '*') {
      next[0] = previous[0]
      for (let t = 1; t <= length; t += 1) {
        next[t] = previous[t] === 1 || next[t - 1] === 1 ? 1 : 0
      }
    } else {
      for (let t = 1; t <= length; t += 1) {
        next[t] = previous[t - 1] === 1 && text[t - 1] === glob[p] ? 1 : 0
      }
    }
    previous = next
  }

  return previous[length] === 1
}

/**
 * robots.txt group selection. A group naming this agent wins over `*`; within
 * the chosen groups the longest matching rule wins, and Allow wins a tie.
 * Wildcards (`*`) and `$` end anchors are supported. `path` must include the
 * query string, because RFC 9309 matches path plus query.
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

  const rules = chosen.flatMap((group) => group.rules)
  // A rule longer than this, or too many rules, is treated as a deny-all
  // rather than as a regex workload. It is a rare shape; failing closed is the
  // only option that cannot be turned into an event-loop stall.
  if (
    rules.length > MAX_ROBOTS_RULES ||
    rules.some((rule) => rule.path.length > MAX_ROBOTS_RULE_LENGTH)
  ) {
    return false
  }

  let verdict: boolean | null = null
  let best = -1
  for (const rule of rules) {
    if (!globMatches(rule.path, path)) continue
    const length = rule.path.replace(/[*$]/g, '').length
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
  guard?: (next: URL) => Promise<void>,
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
      // Check the destination before fetching it: a redirect to a disallowed
      // path must not be read "to discover" that it is disallowed.
      if (guard) await guard(next)
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
  let text: string
  if (hit && Date.now() - hit.at < ROBOTS_TTL_MS) {
    // Cache the rules, never the verdict: the same origin can allow /pricing
    // and disallow /private, and a per-origin verdict would leak one path's
    // answer into the other.
    text = hit.text
  } else {
    text = ''
    try {
      const { response } = await getSameHost(fetchImpl, new URL('/robots.txt', target.origin), signal, {
        'user-agent': USER_AGENT,
        accept: 'text/plain',
      })
      if (response.ok) {
        text = await readCapped(response, 64_000)
      } else if (response.status !== 404 && response.status !== 410) {
        // 401/403/5xx/other: the rules cannot be read, so do not read the page.
        text = 'User-agent: *\nDisallow: /'
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      // A host that fails validation must not be swallowed.
      if (error instanceof TimelineError && /private address|resolve/.test(error.message)) throw error
      // Unreachable or off-host robots.txt is not "no rules". Fail closed.
      text = 'User-agent: *\nDisallow: /'
    }

    if (robotsCache.size > 200) robotsCache.clear()
    robotsCache.set(key, { at: Date.now(), text })
  }

  return robotsAllows(text, `${target.pathname}${target.search}`)
}

export async function fetchLive(raw: string, options: LiveOptions = {}): Promise<LiveCheck> {
  const {
    fetchImpl = globalThis.fetch as unknown as FetchLike,
    lookupImpl = defaultLookup,
    timeoutMs = 15_000,
    maxBytes = 2_000_000,
  } = options

  const target = normaliseTarget(raw)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const abortError = () => new TimelineError('The live page took too long to answer', 504)

  try {
    // DNS is part of the budget. A slow resolver must not extend the documented
    // 15-second ceiling just because the timer used to start after it.
    await Promise.race([
      resolvePublic(target.hostname, lookupImpl),
      new Promise<never>((_, reject) => {
        if (controller.signal.aborted) reject(abortError())
        else
          controller.signal.addEventListener('abort', () => reject(abortError()), {
            once: true,
          })
      }),
    ])

    const allowed = await robotsAllowsUrl(target, fetchImpl, controller.signal)
    if (!allowed) {
      throw new TimelineError('robots.txt asks this tool not to read that page', 403)
    }

    const { response, finalUrl } = await getSameHost(fetchImpl, target, controller.signal, {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    }, async (next) => {
      // Robots was checked for the requested path. Check the redirect target
      // before that URL is fetched.
      const nextAllowed = await robotsAllowsUrl(next, fetchImpl, controller.signal)
      if (!nextAllowed) {
        throw new TimelineError('robots.txt asks this tool not to read that page', 403)
      }
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
