import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApi } from '../server/api'
import type { FetchLike } from '../server/core'

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

function fakeExchange(url: string, ip = '10.0.0.1') {
  const req = { url, method: 'GET', socket: { remoteAddress: ip } } as unknown as IncomingMessage
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
})
