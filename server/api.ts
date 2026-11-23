import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildTimeline, normaliseTarget, TimelineError, type BuildOptions } from './core.js'
import { buildSiteInfo } from './site.js'

export type ApiOptions = BuildOptions & {
  /** Reports allowed per client per minute. */
  rateLimit?: number
  /** Sitemap checks allowed per client per minute. */
  siteRateLimit?: number
  /** Cached reports kept in memory. */
  cacheSize?: number
  /** Cache lifetime in milliseconds. */
  cacheTtlMs?: number
  /** Sitemap cache lifetime in milliseconds. */
  siteCacheTtlMs?: number
}

type CacheEntry = { at: number; payload: string }
type Bucket = { count: number; reset: number }

const VERSION = '0.3.0'

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('x-content-type-options', 'nosniff')
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.end(JSON.stringify(body))
}

/**
 * One handler shared by the dev server and the preview server, so what you
 * test locally is what ships.
 */
export function createApi(options: ApiOptions = {}) {
  const {
    rateLimit = 8,
    siteRateLimit = 20,
    cacheSize = 100,
    cacheTtlMs = 10 * 60 * 1000,
    siteCacheTtlMs = 30 * 60 * 1000,
    ...buildOptions
  } = options

  const cache = new Map<string, CacheEntry>()
  const siteCache = new Map<string, CacheEntry>()
  const buckets = new Map<string, Bucket>()

  const limited = (client: string, scope: 'report' | 'site') => {
    const key = `${scope}:${client}`
    const limit = scope === 'site' ? siteRateLimit : rateLimit
    const now = Date.now()
    if (buckets.size > 500) {
      for (const [address, entry] of buckets) {
        if (entry.reset < now) buckets.delete(address)
      }
    }
    // A hard ceiling: a flood of distinct clients must not grow the map without
    // bound. Oldest entries go first; active clients keep their quota.
    if (buckets.size >= 5000 && !buckets.has(key)) {
      let overflow = buckets.size - 4999
      for (const address of buckets.keys()) {
        buckets.delete(address)
        overflow -= 1
        if (overflow <= 0) break
      }
    }
    const bucket = buckets.get(key)
    if (!bucket || bucket.reset < now) {
      buckets.set(key, { count: 1, reset: now + 60_000 })
      return false
    }
    bucket.count += 1
    return bucket.count > limit
  }

  const cachedJson = (store: Map<string, CacheEntry>, key: string, ttl: number) => {
    const entry = store.get(key)
    if (!entry || Date.now() - entry.at >= ttl) return null
    return entry.payload
  }

  const remember = (
    store: Map<string, CacheEntry>,
    key: string,
    payload: string,
    capacity: number,
  ) => {
    store.delete(key)
    store.set(key, { at: Date.now(), payload })
    while (store.size > capacity) {
      const oldest = store.keys().next().value
      if (!oldest) break
      store.delete(oldest)
    }
  }

  return async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.replace(/\/+$/, '') || '/'

    if (route === '/health') {
      send(res, 200, { ok: true, version: VERSION, uptime: Math.round(process.uptime()) })
      return
    }

    if (route !== '/timeline' && route !== '/site') {
      send(res, 404, { error: 'Unknown endpoint. Use /api/timeline?url=… or /api/site?url=…' })
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, { error: 'GET only' }, { allow: 'GET, HEAD' })
      return
    }

    const target = url.searchParams.get('url')
    if (!target) {
      send(res, 400, { error: 'Missing ?url= — pass a domain or page URL' })
      return
    }

    const client = req.socket.remoteAddress ?? 'unknown'
    const scope = route === '/site' ? 'site' : 'report'
    if (limited(client, scope)) {
      send(res, 429, { error: 'Too many reports from this client. Wait a minute.' }, { 'retry-after': '60' })
      return
    }

    // `basecamp.com/pricing`, `https://Basecamp.com/pricing/` and a trailing
    // slash are the same report — cache them under one key. Path and query
    // case is preserved: `/Plans` and `/plans` can be different pages.
    let href = target.trim()
    try {
      href = normaliseTarget(target).href
    } catch {
      /* invalid targets are rejected by the builders below */
    }

    if (route === '/site') {
      const key = `site:${href}`
      const hit = cachedJson(siteCache, key, siteCacheTtlMs)
      if (hit) {
        res.setHeader('x-cache', 'hit')
        send(res, 200, JSON.parse(hit), { 'cache-control': 'public, max-age=600' })
        return
      }
      try {
        const site = await buildSiteInfo(target, {
          fetchImpl: buildOptions.fetchImpl,
          timeoutMs: buildOptions.timeoutMs,
        })
        remember(siteCache, key, JSON.stringify(site), cacheSize)
        res.setHeader('x-cache', 'miss')
        send(res, 200, site, { 'cache-control': 'public, max-age=600' })
      } catch (error) {
        if (error instanceof TimelineError) {
          send(res, error.status, { error: error.message })
          return
        }
        send(res, 500, { error: 'Unexpected server error' })
      }
      return
    }

    const cached = cachedJson(cache, href, cacheTtlMs)
    if (cached) {
      res.setHeader('x-cache', 'hit')
      send(res, 200, JSON.parse(cached), { 'cache-control': 'public, max-age=600' })
      return
    }

    try {
      const timeline = await buildTimeline(target, buildOptions)
      remember(cache, href, JSON.stringify(timeline), cacheSize)
      res.setHeader('x-cache', 'miss')
      send(res, 200, timeline, { 'cache-control': 'public, max-age=600' })
    } catch (error) {
      if (error instanceof TimelineError) {
        send(res, error.status, { error: error.message })
        return
      }
      send(res, 500, { error: 'Unexpected server error' })
    }
  }
}
