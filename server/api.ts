import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildTimeline, normaliseTarget, TimelineError, type BuildOptions } from './core.js'

export type ApiOptions = BuildOptions & {
  /** Requests allowed per client per minute. */
  rateLimit?: number
  /** Cached reports kept in memory. */
  cacheSize?: number
  /** Cache lifetime in milliseconds. */
  cacheTtlMs?: number
}

type CacheEntry = { at: number; payload: string }
type Bucket = { count: number; reset: number }

const VERSION = '0.2.0'

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
    cacheSize = 100,
    cacheTtlMs = 10 * 60 * 1000,
    ...buildOptions
  } = options

  const cache = new Map<string, CacheEntry>()
  const buckets = new Map<string, Bucket>()

  const limited = (client: string) => {
    const now = Date.now()
    const bucket = buckets.get(client)
    if (!bucket || bucket.reset < now) {
      buckets.set(client, { count: 1, reset: now + 60_000 })
      return false
    }
    bucket.count += 1
    return bucket.count > rateLimit
  }

  return async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.replace(/\/+$/, '') || '/'

    if (route === '/health') {
      send(res, 200, { ok: true, version: VERSION, uptime: Math.round(process.uptime()) })
      return
    }

    if (route !== '/timeline') {
      send(res, 404, { error: 'Unknown endpoint. Use /api/timeline?url=…' })
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
    if (limited(client)) {
      send(res, 429, { error: 'Too many reports from this client. Wait a minute.' }, { 'retry-after': '60' })
      return
    }

    // `basecamp.com/pricing`, `https://Basecamp.com/pricing/` and a trailing
    // slash are the same report — cache them under one key.
    let key = target.trim().toLowerCase()
    try {
      const normalised = normaliseTarget(target)
      key = `${normalised.hostname}${normalised.pathname}`.toLowerCase()
    } catch {
      /* invalid targets are rejected by buildTimeline below */
    }
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < cacheTtlMs) {
      res.setHeader('x-cache', 'hit')
      send(res, 200, JSON.parse(cached.payload), { 'cache-control': 'public, max-age=600' })
      return
    }

    try {
      const timeline = await buildTimeline(target, buildOptions)
      const payload = JSON.stringify(timeline)
      cache.set(key, { at: Date.now(), payload })
      if (cache.size > cacheSize) {
        const oldest = cache.keys().next().value
        if (oldest) cache.delete(oldest)
      }
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
