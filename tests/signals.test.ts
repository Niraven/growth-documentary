import { describe, expect, it } from 'vitest'
import { buildFeedSignals } from '../server/feeds.js'
import { buildJobsSignal } from '../server/jobs.js'
import { isFeedSignal, isJobsSignal } from '../shared/signals.js'
import type { FetchLike } from '../server/archive.js'

const lookupImpl = async () => [{ address: '8.8.8.8', family: 4 }]
function fixture(pages: Record<string, string>, status = 200): FetchLike {
  return async (url) => {
    const text = pages[url]
    return { ok: text !== undefined && status === 200, status: text === undefined ? 404 : status,
      text: async () => text ?? '', json: async () => JSON.parse(text ?? '{}'),
      headers: { get: () => null } }
  }
}

describe('public signals', () => {
  it('validates signal boundaries', () => {
    expect(isFeedSignal({ status: 'read', entries: [{ title: 'x', url: 'https://example.com', publishedAt: null, summary: '' }], note: '', checkedAt: '' })).toBe(true)
    expect(isFeedSignal({ status: 'read', entries: [null], note: '', checkedAt: '' })).toBe(false)
    expect(isJobsSignal({ status: 'unavailable', provider: null, boardUrl: null, openRoles: null, roles: [], note: '', checkedAt: '' })).toBe(true)
    expect(isJobsSignal({ status: 'read', provider: 'LinkedIn', boardUrl: null, openRoles: 1, roles: [], note: '', checkedAt: '' })).toBe(false)
  })
  it('enforces the deadline even when the transport ignores abort', async () => {
    const result = await buildFeedSignals('example.com', { lookupImpl, timeoutMs: 10, fetchImpl: async () => new Promise(() => {}) })
    expect(result.status).toBe('unavailable')
  })
  it('discovers and reads RSS', async () => {
    const fetchImpl = fixture({ 'https://example.com/': '<link rel="alternate" type="application/rss+xml" href="/news.xml">', 'https://example.com/news.xml': '<rss><channel><item><title>News</title><link>https://example.com/news</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>Hello</description></item></channel></rss>' })
    const result = await buildFeedSignals('example.com', { fetchImpl, lookupImpl })
    expect(result.status).toBe('read')
    expect(result.entries[0]).toMatchObject({ title: 'News', url: 'https://example.com/news', summary: 'Hello' })
  })
  it('reads Atom entries and caps at 30', async () => {
    const entries = Array.from({ length: 35 }, (_, i) => `<entry><title>Item ${i}</title><link href="/post/${i}"/><updated>2024-01-01T00:00:00Z</updated><summary>Summary</summary></entry>`).join('')
    const calls: string[] = []
    const base = fixture({ 'https://example.com/': '<link rel="alternate" type="application/atom+xml" href="/atom"><link rel="alternate" type="application/rss+xml" href="https://elsewhere.com/feed">', 'https://example.com/atom': `<feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>` })
    const fetchImpl: FetchLike = async (url, init) => { calls.push(url); return base(url, init) }
    const result = await buildFeedSignals('example.com', { fetchImpl, lookupImpl })
    expect(result.entries).toHaveLength(30)
    expect(result.entries[0]).toEqual({ title: 'Item 0', url: 'https://example.com/post/0', publishedAt: '2024-01-01T00:00:00.000Z', summary: 'Summary' })
    expect(calls).not.toContain('https://elsewhere.com/feed')
    expect(calls.filter((url) => url === 'https://example.com/atom' || url === 'https://example.com/feed' || url === 'https://example.com/rss.xml')).toHaveLength(2)
  })
  it('marks inaccessible feeds unread, not zero', async () => {
    const result = await buildFeedSignals('example.com', { lookupImpl, fetchImpl: fixture({ 'https://example.com/': '<title>Site</title>' }) })
    expect(result.status).toBe('unavailable')
    expect(result.note).toContain('not zero')
  })
  it.each([
    ['Lever', 'https://jobs.lever.co/acme', 'https://api.lever.co/v0/postings/acme?mode=json', [{ text: 'Engineer', categories: { location: 'Remote' }, hostedUrl: 'https://jobs.lever.co/acme/1' }]],
    ['Ashby', 'https://jobs.ashbyhq.com/acme', 'https://api.ashbyhq.com/posting-api/job-board/acme', { jobs: [{ title: 'Engineer', location: 'Remote', jobUrl: 'https://jobs.ashbyhq.com/acme/1' }] }],
  ])('reads %s public JSON', async (provider, board, endpoint, payload) => {
    const result = await buildJobsSignal('example.com/path', { lookupImpl, fetchImpl: fixture({ 'https://example.com/': `<a href="${board}">Jobs</a>`, [endpoint as string]: JSON.stringify(payload) }) })
    expect(result).toMatchObject({ status: 'read', provider, openRoles: 1, roles: [{ title: 'Engineer', location: 'Remote', url: `${board}/1` }] })
  })
  it('does not infer zero roles when no board was found', async () => {
    const result = await buildJobsSignal('example.com', { lookupImpl, fetchImpl: fixture({ 'https://example.com/': '<a href="https://linkedin.com/jobs">jobs</a>' }) })
    expect(result).toMatchObject({ status: 'empty', provider: null, openRoles: null })
  })
  it('reports a provider failure as unavailable', async () => {
    const base = fixture({ 'https://example.com/': '<a href="https://boards.greenhouse.io/acme">jobs</a>' })
    const fetchImpl: FetchLike = async (url, init) => url.includes('boards-api') ? { ok: false, status: 503, text: async () => '', json: async () => null } : base(url, init)
    const result = await buildJobsSignal('example.com', { lookupImpl, fetchImpl })
    expect(result).toMatchObject({ status: 'unavailable', provider: 'Greenhouse', openRoles: null })
  })
  it('rejects private DNS answers before any network request', async () => {
    let calls = 0
    const fetchImpl: FetchLike = async () => { calls++; throw Error('unexpected') }
    const result = await buildFeedSignals('example.com', { fetchImpl, lookupImpl: async () => [{ address: '127.0.0.1', family: 4 }] })
    expect(result.status).toBe('unavailable')
    expect(calls).toBe(0)
  })
  it('discovers Greenhouse and counts public roles', async () => {
    const fetchImpl = fixture({ 'https://example.com/': '<a href="https://boards.greenhouse.io/acme">Jobs</a>', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs': JSON.stringify({ jobs: [{ title: 'Engineer', location: { name: 'Remote' }, absolute_url: 'https://boards.greenhouse.io/acme/jobs/1' }] }) })
    const result = await buildJobsSignal('example.com', { fetchImpl, lookupImpl })
    expect(result).toMatchObject({ status: 'read', provider: 'Greenhouse', openRoles: 1 })
  })
})
