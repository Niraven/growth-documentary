import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApi } from '../server/api'
import type { FetchLike } from '../server/core'
import { ReportStore } from '../server/store'

const cdx = [
  ['urlkey', 'timestamp', 'original'],
  ['com,example)/pricing', '20200101000000', 'https://example.com/pricing'],
  ['com,example)/pricing', '20210101000000', 'https://example.com/pricing'],
]

const pages: Record<string, string> = {
  '20200101000000id_': '<title>Pricing</title><h1>Simple</h1><p>$10/mo</p>',
  '20210101000000id_': '<title>Pricing</title><h1>Simple</h1><p>$20/mo</p>',
}

function makeFetch() {
  let calls = 0
  const fetchImpl: FetchLike = async (url) => {
    calls += 1
    if (url.includes('/cdx/search/cdx')) {
      return { ok: true, status: 200, json: async () => cdx, text: async () => '' }
    }
    const key = Object.keys(pages).find((needle) => url.includes(needle))
    if (!key) return { ok: false, status: 404, json: async () => null, text: async () => '' }
    return { ok: true, status: 200, json: async () => null, text: async () => pages[key] }
  }
  return { fetchImpl, calls: () => calls }
}

function fakeExchange(
  url: string,
  ip = '10.0.0.1',
  init: { method?: string; body?: string } = {},
) {
  const chunks = init.body === undefined ? [] : [Buffer.from(init.body)]
  const req = {
    url,
    method: init.method ?? 'GET',
    socket: { remoteAddress: ip },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  } as unknown as IncomingMessage
  const state = { status: 0, headers: {} as Record<string, string>, body: '' }
  const res = {
    writableEnded: false,
    set statusCode(value: number) {
      state.status = value
    },
    get statusCode() {
      return state.status
    },
    setHeader(key: string, value: string) {
      state.headers[key.toLowerCase()] = value
    },
    end(body: string) {
      state.body = body
      res.writableEnded = true
    },
  } as unknown as ServerResponse & { writableEnded: boolean }
  return { req, res, state }
}

describe('api handler', () => {
  it('answers health', async () => {
    const api = createApi()
    const { req, res, state } = fakeExchange('/health')
    await api(req, res)
    expect(state.status).toBe(200)
    expect(JSON.parse(state.body).ok).toBe(true)
    expect(JSON.parse(state.body).version).toBe('0.9.1')
  })

  it('describes the API at the root', async () => {
    const api = createApi()
    const { req, res, state } = fakeExchange('/')
    await api(req, res)
    expect(state.status).toBe(200)
    const body = JSON.parse(state.body) as { name: string; endpoints: unknown[] }
    expect(body.name).toBe('growth-documentary')
    expect(body.endpoints).toHaveLength(9)
  })

  it('returns site info and caches it', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('/cdx/search/cdx')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            ['urlkey', 'timestamp', 'original'],
            ['com,example)/sitemap.xml', '20240601120000', 'https://example.com/sitemap.xml'],
          ],
          text: async () => '',
        }
      }
      if (url.includes('sitemap.xml')) {
        return {
          ok: true,
          status: 200,
          json: async () => null,
          text: async () =>
            '<urlset><url><loc>https://example.com/a</loc><lastmod>2024-01-01</lastmod></url></urlset>',
        }
      }
      return { ok: false, status: 404, json: async () => null, text: async () => '' }
    }
    const api = createApi({ fetchImpl })
    const first = fakeExchange('/site?url=example.com')
    await api(first.req, first.res)
    expect(first.state.status).toBe(200)
    expect(JSON.parse(first.state.body).pages).toBe(1)
    expect(first.state.headers['x-cache']).toBe('miss')

    const second = fakeExchange('/site?url=example.com')
    await api(second.req, second.res)
    expect(second.state.status).toBe(200)
    expect(second.state.headers['x-cache']).toBe('hit')
  })

  it('returns public source lanes and caches them', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('hn.algolia.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            nbHits: 1,
            hits: [
              {
                objectID: '1',
                title: 'Example story',
                url: 'https://example.com/pricing',
                created_at: '2026-01-01T00:00:00Z',
                points: 3,
                num_comments: 1,
                author: 'alice',
              },
            ],
          }),
          text: async () => '',
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          estimated_nr_results: 2,
          response_items: [
            {
              tstamp: '20250101000000',
              originalURL: 'https://example.com/pricing',
              linkToNoFrame: 'https://arquivo.pt/noFrame/replay/20250101000000/https://example.com/pricing',
            },
          ],
        }),
        text: async () => '',
      }
    }
    const api = createApi({ fetchImpl })
    const first = fakeExchange('/sources?url=example.com')
    await api(first.req, first.res)
    expect(first.state.status).toBe(200)
    expect(JSON.parse(first.state.body).mentions.status).toBe('read')
    expect(JSON.parse(first.state.body).archives.status).toBe('read')
    expect(first.state.headers['x-cache']).toBe('miss')

    const second = fakeExchange('/sources?url=example.com')
    await api(second.req, second.res)
    expect(second.state.status).toBe(200)
    expect(second.state.headers['x-cache']).toBe('hit')
  })

  it('rejects a missing url with 400', async () => {
    const api = createApi()
    const { req, res, state } = fakeExchange('/timeline')
    await api(req, res)
    expect(state.status).toBe(400)
    expect(JSON.parse(state.body).error).toMatch(/Missing \?url=/)
  })

  it('returns a timeline and caches the second call', async () => {
    const { fetchImpl, calls } = makeFetch()
    const api = createApi({ fetchImpl, delayMs: 0 })
    const first = fakeExchange('/timeline?url=example.com/pricing')
    await api(first.req, first.res)
    expect(first.state.status).toBe(200)
    expect(JSON.parse(first.state.body).captures).toHaveLength(2)
    expect(first.state.headers['x-cache']).toBe('miss')

    const before = calls()
    const second = fakeExchange('/timeline?url=example.com/pricing')
    await api(second.req, second.res)
    expect(second.state.status).toBe(200)
    expect(second.state.headers['x-cache']).toBe('hit')
    expect(calls()).toBe(before)
  })

  it('treats URL variants as one cached report', async () => {
    const { fetchImpl } = makeFetch()
    const api = createApi({ fetchImpl, delayMs: 0 })
    const first = fakeExchange('/timeline?url=example.com/pricing')
    await api(first.req, first.res)
    const variant = fakeExchange(
      `/timeline?url=${encodeURIComponent('https://EXAMPLE.com/pricing/')}`,
    )
    await api(variant.req, variant.res)
    expect(variant.state.status).toBe(200)
    expect(variant.state.headers['x-cache']).toBe('hit')
  })

  it('keeps case-sensitive paths distinct in the cache', async () => {
    const { fetchImpl } = makeFetch()
    const api = createApi({ fetchImpl, delayMs: 0 })
    const upper = fakeExchange('/timeline?url=example.com/Plans')
    await api(upper.req, upper.res)
    expect(upper.state.headers['x-cache']).toBe('miss')
    const lower = fakeExchange('/timeline?url=example.com/plans')
    await api(lower.req, lower.res)
    expect(lower.state.headers['x-cache']).toBe('miss')
  })

  it('keeps scheme and port distinct in the cache', async () => {
    const { fetchImpl } = makeFetch()
    const api = createApi({ fetchImpl, delayMs: 0 })
    const https = fakeExchange('/timeline?url=https://example.com/pricing')
    await api(https.req, https.res)
    expect(https.state.headers['x-cache']).toBe('miss')
    const http = fakeExchange('/timeline?url=http://example.com/pricing')
    await api(http.req, http.res)
    expect(http.state.headers['x-cache']).toBe('miss')
  })

  it('rate limits a noisy client', async () => {
    const { fetchImpl } = makeFetch()
    const api = createApi({ fetchImpl, delayMs: 0, rateLimit: 2 })
    const statuses: number[] = []
    for (let i = 0; i < 3; i += 1) {
      const call = fakeExchange('/timeline?url=example.com/pricing', '9.9.9.9')
      await api(call.req, call.res)
      statuses.push(call.state.status)
    }
    expect(statuses).toEqual([200, 200, 429])
  })

  it('reports an invalid target as 400, not 500', async () => {
    const { fetchImpl } = makeFetch()
    const api = createApi({ fetchImpl, delayMs: 0 })
    const call = fakeExchange('/timeline?url=localhost')
    await api(call.req, call.res)
    expect(call.state.status).toBe(400)
    expect(JSON.parse(call.state.body).error).toMatch(/public domain/)
  })

  it('404s an unknown endpoint', async () => {
    const api = createApi()
    const { req, res, state } = fakeExchange('/nope')
    await api(req, res)
    expect(state.status).toBe(404)
  })

  it('saves, lists, opens and deletes a report', async () => {
    const { fetchImpl } = makeFetch()
    const dir = await mkdtemp(join(tmpdir(), 'gd-api-'))
    const store = new ReportStore(join(dir, 'reports.json'))
    const api = createApi({ fetchImpl, delayMs: 0, store })

    const create = fakeExchange('/reports', '10.0.0.2', {
      method: 'POST',
      body: JSON.stringify({ url: 'example.com/pricing' }),
    })
    await api(create.req, create.res)
    expect(create.state.status).toBe(201)
    const saved = JSON.parse(create.state.body) as { id: string; changes: number }
    expect(saved.id).toMatch(/^[A-Za-z0-9_-]{6,24}$/)
    expect(saved.changes).toBe(1)

    const list = fakeExchange('/reports', '10.0.0.2')
    await api(list.req, list.res)
    expect(list.state.status).toBe(200)
    expect(JSON.parse(list.state.body).reports).toHaveLength(1)

    const open = fakeExchange(`/reports/${saved.id}`, '10.0.0.2')
    await api(open.req, open.res)
    expect(open.state.status).toBe(200)
    expect(JSON.parse(open.state.body).report.captures).toHaveLength(2)

    const remove = fakeExchange(`/reports/${saved.id}`, '10.0.0.2', { method: 'DELETE' })
    await api(remove.req, remove.res)
    expect(remove.state.status).toBe(204)

    const gone = fakeExchange(`/reports/${saved.id}`, '10.0.0.2')
    await api(gone.req, gone.res)
    expect(gone.state.status).toBe(404)
  })

  it('is idempotent when the same snapshot is saved twice', async () => {
    const { fetchImpl } = makeFetch()
    const dir = await mkdtemp(join(tmpdir(), 'gd-api-'))
    const api = createApi({
      fetchImpl,
      delayMs: 0,
      store: new ReportStore(join(dir, 'reports.json')),
    })

    const first = fakeExchange('/reports', '10.0.0.3', {
      method: 'POST',
      body: JSON.stringify({ url: 'example.com/pricing' }),
    })
    await api(first.req, first.res)
    const second = fakeExchange('/reports', '10.0.0.3', {
      method: 'POST',
      body: JSON.stringify({ url: 'example.com/pricing' }),
    })
    await api(second.req, second.res)

    expect(second.state.status).toBe(200)
    expect(JSON.parse(second.state.body).id).toBe(JSON.parse(first.state.body).id)
    const list = fakeExchange('/reports', '10.0.0.3')
    await api(list.req, list.res)
    expect(JSON.parse(list.state.body).reports).toHaveLength(1)
  })

  it('rejects a save without a url and a non-JSON body', async () => {
    const api = createApi({ store: new ReportStore('/tmp/gd-never-written.json') })
    const missing = fakeExchange('/reports', '10.0.0.4', { method: 'POST', body: '{}' })
    await api(missing.req, missing.res)
    expect(missing.state.status).toBe(400)

    const malformed = fakeExchange('/reports', '10.0.0.4', { method: 'POST', body: 'nope' })
    await api(malformed.req, malformed.res)
    expect(malformed.state.status).toBe(400)
    expect(JSON.parse(malformed.state.body).error).toMatch(/JSON/)
  })

  it('returns a live check and marks it no-store', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) {
        return { ok: false, status: 404, headers: { get: () => null }, json: async () => null, text: async () => '' }
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        json: async () => null,
        text: async () => '<title>Now</title><h1>Current</h1><p>$30/mo</p>',
      }
    }
    const api = createApi({
      live: {
        fetchImpl,
        lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
      },
    })
    const call = fakeExchange('/live?url=example.com/pricing')
    await api(call.req, call.res)
    expect(call.state.status).toBe(200)
    expect(call.state.headers['cache-control']).toBe('no-store')
    const body = JSON.parse(call.state.body)
    expect(body.title).toBe('Now')
    expect(body.robots).toBe('allowed')
  })
})
