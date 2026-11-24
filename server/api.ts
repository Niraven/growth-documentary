import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildTimeline, normaliseTarget, TimelineError, type BuildOptions } from './core.js'
import { buildSiteInfo } from './site.js'
import { buildSiteGraph, type SiteGraphOptions } from './sitegraph.js'
import { buildSources } from './sources.js'
import { fetchLive, type LiveOptions } from './live.js'
import { ReportStore, defaultReportFile } from './store.js'
import type { Timeline } from '../shared/timeline.js'
import { buildGrowthTimeline } from '../shared/growth.js'

export type ApiOptions = BuildOptions & {
  /** Reports allowed per client per minute. */
  rateLimit?: number
  /** Sitemap checks allowed per client per minute. */
  siteRateLimit?: number
  /** Public-source checks allowed per client per minute. */
  sourceRateLimit?: number
  /** Combined growth-timeline builds allowed per client per minute. */
  growthRateLimit?: number
  /** Live page checks allowed per client per minute. */
  liveRateLimit?: number
  /** Saves allowed per client per minute. */
  saveRateLimit?: number
  /** Cached reports kept in memory. */
  cacheSize?: number
  /** Cache lifetime in milliseconds. */
  cacheTtlMs?: number
  /** Sitemap cache lifetime in milliseconds. */
  siteCacheTtlMs?: number
  /** Public-source cache lifetime in milliseconds. */
  sourceCacheTtlMs?: number
  /** Injectable store, used by tests. */
  store?: ReportStore
  /** Path for the default store. */
  storeFile?: string
  /** Live fetch injection and limits. */
  live?: LiveOptions
  /** Injectable public crawler transport and limits. */
  sitegraph?: SiteGraphOptions
  /** JSON body cap, for saved-report requests. */
  maxBodyBytes?: number
}

type CacheEntry = { at: number; payload: string }
type Bucket = { count: number; reset: number }
type Scope = 'report' | 'site' | 'sources' | 'growth' | 'live' | 'save'

const VERSION = '0.10.1'
const SAVED_ID = /^[A-Za-z0-9_-]{6,24}$/

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('x-content-type-options', 'nosniff')
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.end(JSON.stringify(body))
}

function sendEmpty(res: ServerResponse, status: number, headers: Record<string, string> = {}) {
  if (res.writableEnded) return
  res.statusCode = status
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.end()
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += buffer.length
    if (total > maxBytes) throw new TimelineError('Request body is too large', 413)
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * One handler shared by the dev server and the preview server, so what you
 * test locally is what ships.
 */
export function createApi(options: ApiOptions = {}) {
  const {
    rateLimit = 8,
    siteRateLimit = 20,
    sourceRateLimit = 6,
    growthRateLimit = 4,
    liveRateLimit = 4,
    saveRateLimit = 6,
    cacheSize = 100,
    cacheTtlMs = 10 * 60 * 1000,
    siteCacheTtlMs = 30 * 60 * 1000,
    sourceCacheTtlMs = 15 * 60 * 1000,
    store = new ReportStore(options.storeFile ?? defaultReportFile()),
    live = {},
    sitegraph = {},
    maxBodyBytes = 16_000,
    ...buildOptions
  } = options

  const cache = new Map<string, CacheEntry>()
  const siteCache = new Map<string, CacheEntry>()
  const sourceCache = new Map<string, CacheEntry>()
  const buckets = new Map<string, Bucket>()

  const limited = (client: string, scope: Scope) => {
    const key = `${scope}:${client}`
    const limit =
      scope === 'site'
        ? siteRateLimit
        : scope === 'sources'
          ? sourceRateLimit
          : scope === 'growth'
            ? growthRateLimit
            : scope === 'live'
            ? liveRateLimit
            : scope === 'save'
              ? saveRateLimit
              : rateLimit
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

  const cachedJson = (storeMap: Map<string, CacheEntry>, key: string, ttl: number) => {
    const entry = storeMap.get(key)
    if (!entry || Date.now() - entry.at >= ttl) return null
    return entry.payload
  }

  const remember = (
    storeMap: Map<string, CacheEntry>,
    key: string,
    payload: string,
    capacity: number,
  ) => {
    storeMap.delete(key)
    storeMap.set(key, { at: Date.now(), payload })
    while (storeMap.size > capacity) {
      const oldest = storeMap.keys().next().value
      if (!oldest) break
      storeMap.delete(oldest)
    }
  }

  const cacheKeyFor = (target: string): string => {
    try {
      return normaliseTarget(target).href
    } catch {
      // Invalid targets are rejected by the builders with a useful message.
      return target.trim()
    }
  }

  const resolveTimeline = async (target: string): Promise<{ timeline: Timeline; hit: boolean }> => {
    const key = cacheKeyFor(target)
    const cached = cachedJson(cache, key, cacheTtlMs)
    if (cached) return { timeline: JSON.parse(cached) as Timeline, hit: true }
    const timeline = await buildTimeline(target, buildOptions)
    remember(cache, key, JSON.stringify(timeline), cacheSize)
    return { timeline, hit: false }
  }

  const handleError = (res: ServerResponse, error: unknown) => {
    if (error instanceof TimelineError) {
      send(res, error.status, { error: error.message })
      return
    }
    send(res, 500, { error: 'Unexpected server error' })
  }

  return async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method ?? 'GET'

    if (route === '/') {
      if (method !== 'GET' && method !== 'HEAD') {
        send(res, 405, { error: 'GET only' }, { allow: 'GET, HEAD' })
        return
      }
      send(res, 200, {
        name: 'growth-documentary',
        version: VERSION,
        docs: 'https://github.com/Niraven/growth-documentary#api',
        endpoints: [
          { method: 'GET', path: '/api/timeline?url=', purpose: 'dated archive timeline' },
          { method: 'GET', path: '/api/growth?url=', purpose: 'merged public growth timeline' },
          { method: 'GET', path: '/api/site?url=', purpose: 'archived sitemap size' },
          { method: 'GET', path: '/api/sitegraph?url=', purpose: 'bounded public site graph' },
          { method: 'GET', path: '/api/sources?url=', purpose: 'public discussion and second archive lanes' },
          { method: 'GET', path: '/api/live?url=', purpose: 'opt-in current page read' },
          { method: 'GET', path: '/api/reports', purpose: 'saved report summaries' },
          { method: 'POST', path: '/api/reports', purpose: 'freeze a report' },
          { method: 'GET', path: '/api/reports/:id', purpose: 'read a frozen report' },
          { method: 'DELETE', path: '/api/reports/:id', purpose: 'remove a frozen report' },
          { method: 'GET', path: '/api/health', purpose: 'version and uptime' },
        ],
      })
      return
    }

    if (route === '/health') {
      if (method !== 'GET' && method !== 'HEAD') {
        send(res, 405, { error: 'GET only' }, { allow: 'GET, HEAD' })
        return
      }
      send(res, 200, { ok: true, version: VERSION, uptime: Math.round(process.uptime()) })
      return
    }

    if (
      route === '/timeline' ||
      route === '/growth' ||
      route === '/site' ||
      route === '/sitegraph' ||
      route === '/sources' ||
      route === '/live'
    ) {
      if (method !== 'GET' && method !== 'HEAD') {
        send(res, 405, { error: 'GET only' }, { allow: 'GET, HEAD' })
        return
      }

      const target = url.searchParams.get('url')
      if (!target) {
        send(res, 400, { error: 'Missing ?url= — pass a domain or page URL' })
        return
      }

      const client = req.socket.remoteAddress ?? 'unknown'

      if (route === '/growth') {
        if (limited(client, 'growth')) {
          send(res, 429, { error: 'Too many growth timelines from this client. Wait a minute.' }, { 'retry-after': '60' })
          return
        }
        const key = `growth:${cacheKeyFor(target)}`
        const hit = cachedJson(sourceCache, key, sourceCacheTtlMs)
        if (hit) {
          res.setHeader('x-cache', 'hit')
          send(res, 200, JSON.parse(hit), { 'cache-control': 'public, max-age=300' })
          return
        }
        try {
          const { timeline } = await resolveTimeline(target)
          const [site, sources] = await Promise.all([
            buildSiteInfo(target, {
              fetchImpl: buildOptions.fetchImpl,
              timeoutMs: buildOptions.timeoutMs,
            }),
            buildSources(target, {
              fetchImpl: buildOptions.fetchImpl,
              timeoutMs: buildOptions.timeoutMs,
            }),
          ])
          const growth = buildGrowthTimeline(timeline, site, sources)
          remember(sourceCache, key, JSON.stringify(growth), cacheSize)
          res.setHeader('x-cache', 'miss')
          send(res, 200, growth, { 'cache-control': 'public, max-age=300' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      if (route === '/site') {
        if (limited(client, 'site')) {
          send(res, 429, { error: 'Too many sitemap checks from this client. Wait a minute.' }, { 'retry-after': '60' })
          return
        }
        const key = `site:${cacheKeyFor(target)}`
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
          handleError(res, error)
        }
        return
      }

      if (route === '/sitegraph') {
        if (limited(client, 'live')) {
          send(res, 429, { error: 'Too many live checks from this client. Wait a minute.' }, { 'retry-after': '60' })
          return
        }
        const key = `sitegraph:${cacheKeyFor(target)}`
        const hit = cachedJson(siteCache, key, siteCacheTtlMs)
        if (hit) {
          res.setHeader('x-cache', 'hit')
          send(res, 200, JSON.parse(hit), { 'cache-control': 'public, max-age=600' })
          return
        }
        try {
          const graph = await buildSiteGraph(target, sitegraph)
          remember(siteCache, key, JSON.stringify(graph), cacheSize)
          res.setHeader('x-cache', 'miss')
          send(res, 200, graph, { 'cache-control': 'public, max-age=600' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      if (route === '/live') {
        if (limited(client, 'live')) {
          send(res, 429, { error: 'Too many live checks from this client. Wait a minute.' }, { 'retry-after': '60' })
          return
        }
        try {
          const check = await fetchLive(target, live)
          send(res, 200, check, { 'cache-control': 'no-store' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      if (route === '/sources') {
        if (limited(client, 'sources')) {
          send(res, 429, { error: 'Too many source checks from this client. Wait a minute.' }, { 'retry-after': '60' })
          return
        }
        const key = `sources:${cacheKeyFor(target)}`
        const hit = cachedJson(sourceCache, key, sourceCacheTtlMs)
        if (hit) {
          res.setHeader('x-cache', 'hit')
          send(res, 200, JSON.parse(hit), { 'cache-control': 'public, max-age=300' })
          return
        }
        try {
          const sources = await buildSources(target, {
            fetchImpl: buildOptions.fetchImpl,
            timeoutMs: buildOptions.timeoutMs,
          })
          if (sources.mentions.status !== 'unavailable' && sources.archives.status !== 'unavailable') {
            remember(sourceCache, key, JSON.stringify(sources), cacheSize)
          }
          res.setHeader('x-cache', 'miss')
          send(res, 200, sources, { 'cache-control': 'public, max-age=300' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      if (limited(client, 'report')) {
        send(res, 429, { error: 'Too many reports from this client. Wait a minute.' }, { 'retry-after': '60' })
        return
      }

      try {
        const { timeline, hit } = await resolveTimeline(target)
        res.setHeader('x-cache', hit ? 'hit' : 'miss')
        send(res, 200, timeline, { 'cache-control': 'public, max-age=600' })
      } catch (error) {
        handleError(res, error)
      }
      return
    }

    if (route === '/reports') {
      const client = req.socket.remoteAddress ?? 'unknown'

      if (method === 'GET' || method === 'HEAD') {
        try {
          send(res, 200, { reports: await store.list() }, { 'cache-control': 'no-store' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      if (method !== 'POST') {
        send(res, 405, { error: 'GET or POST only' }, { allow: 'GET, HEAD, POST' })
        return
      }

      if (limited(client, 'save')) {
        send(res, 429, { error: 'Too many saves from this client. Wait a minute.' }, { 'retry-after': '60' })
        return
      }

      try {
        let payload: unknown
        try {
          payload = JSON.parse(await readBody(req, maxBodyBytes))
        } catch (error) {
          if (error instanceof TimelineError) throw error
          throw new TimelineError('Body must be JSON', 400)
        }
        if (typeof payload !== 'object' || payload === null) {
          throw new TimelineError('Body must be a JSON object with a url', 400)
        }
        const target = (payload as { url?: unknown }).url
        if (typeof target !== 'string' || !target.trim()) {
          throw new TimelineError('Missing url — pass the page you want to save', 400)
        }

        const { timeline } = await resolveTimeline(target)
        const { report, created } = await store.save(timeline)
        send(
          res,
          created ? 201 : 200,
          {
            id: report.id,
            savedAt: report.savedAt,
            domain: report.report.domain,
            path: report.report.path,
            changes: report.report.changes.filter((change) => change.field !== 'first capture').length,
          },
          { 'cache-control': 'no-store' },
        )
      } catch (error) {
        handleError(res, error)
      }
      return
    }

    if (route.startsWith('/reports/')) {
      const id = route.slice('/reports/'.length)
      if (!SAVED_ID.test(id)) {
        send(res, 400, { error: 'That is not a valid saved-report id' })
        return
      }

      if (method === 'GET' || method === 'HEAD') {
        try {
          const report = await store.get(id)
          if (!report) {
            send(res, 404, { error: 'Saved report not found' })
            return
          }
          send(res, 200, report, { 'cache-control': 'public, max-age=31536000, immutable' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      if (method === 'DELETE') {
        try {
          const removed = await store.remove(id)
          if (!removed) {
            send(res, 404, { error: 'Saved report not found' })
            return
          }
          sendEmpty(res, 204, { 'cache-control': 'no-store' })
        } catch (error) {
          handleError(res, error)
        }
        return
      }

      send(res, 405, { error: 'GET or DELETE only' }, { allow: 'GET, HEAD, DELETE' })
      return
    }

    send(res, 404, {
      error: 'Unknown endpoint. Use /api/growth, /api/timeline, /api/site, /api/sitegraph, /api/sources, /api/live or /api/reports.',
    })
  }
}
