import { describe, expect, it } from 'vitest'
import { buildSiteGraph } from '../server/sitegraph.js'
import type { FetchLike } from '../server/archive.js'
import { isSiteGraph } from '../shared/sitegraph.js'

const lookupImpl = async () => [{ address: '8.8.8.8', family: 4 }]
function fixture(entries: Record<string, string>) {
  const calls: string[] = []
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url)
    const text = entries[url]
    return { ok: text !== undefined, status: text === undefined ? 404 : 200, headers: { get: (key) => key.toLowerCase() === 'content-type' ? (url.endsWith('.xml') ? 'application/xml' : 'text/html') : null }, json: async () => ({}), text: async () => text ?? '' }
  }
  return { calls, fetchImpl }
}

describe('public site graph', () => {
  it('reads a public page and rejects off-origin links', async () => {
    const f = fixture({ 'https://acme.com/': '<title>Home</title><h1>Hello</h1><a href="/pricing">Pricing</a><a href="https://evil.com/">outside</a>', 'https://acme.com/pricing': '<title>Pricing</title>' })
    const graph = await buildSiteGraph('https://acme.com', { ...f, lookupImpl })
    expect(graph.pages.map((p) => p.url)).toEqual(['https://acme.com/', 'https://acme.com/pricing'])
    expect(graph.pages[1].type).toBe('pricing')
    expect(f.calls.every((url) => new URL(url).origin === 'https://acme.com')).toBe(true)
    expect(graph.sitemapUrl).toBeNull()
    expect(isSiteGraph(graph)).toBe(true)
    expect(isSiteGraph({ ...graph, pages: [{ ...graph.pages[0], type: 'unknown' }] })).toBe(false)
  })
  it('rejects private DNS before any request', async () => {
    const f = fixture({})
    await expect(buildSiteGraph('https://acme.com', { ...f, lookupImpl: async () => [{ address: '127.0.0.1', family: 4 }] })).rejects.toThrow(/private/)
    await expect(buildSiteGraph('http://169.254.169.254', { ...f, lookupImpl })).rejects.toThrow()
    expect(f.calls).toEqual([])
  })
  it('honours robots disallow', async () => {
    const f = fixture({ 'https://acme.com/robots.txt': 'User-agent: *\nDisallow: /secret', 'https://acme.com/': '<a href="/secret">secret</a><a href="/ok">ok</a>', 'https://acme.com/ok': '<h1>OK</h1>' })
    const graph = await buildSiteGraph('acme.com', { ...f, lookupImpl })
    expect(f.calls).not.toContain('https://acme.com/secret')
    expect(graph.pages).toHaveLength(2)
    expect(graph.skipped).toBeGreaterThan(0)
  })
  it('reads sitemap indexes and urlsets and removes duplicates', async () => {
    const f = fixture({
      'https://acme.com/robots.txt': 'Sitemap: https://acme.com/index.xml',
      'https://acme.com/index.xml': '<sitemapindex><sitemap><loc>https://acme.com/child.xml</loc></sitemap><sitemap><loc>https://elsewhere.com/a.xml</loc></sitemap></sitemapindex>',
      'https://acme.com/child.xml': '<urlset><url><loc>https://acme.com/product</loc></url><url><loc>https://acme.com/product#x</loc></url></urlset>',
      'https://acme.com/': '<a href="/product">one</a><a href="/product#two">two</a>',
      'https://acme.com/product': '<title>Product</title><meta name="description" content="Useful product"><h1>Our product</h1>',
    })
    const graph = await buildSiteGraph('acme.com', { ...f, lookupImpl })
    expect(graph.sitemapUrl).toBe('https://acme.com/index.xml')
    expect(graph.pages).toHaveLength(2)
    expect(graph.pages[1]).toMatchObject({ type: 'product', description: 'Useful product', h1: 'Our product' })
    expect(f.calls.filter((url) => url.endsWith('/product'))).toHaveLength(1)
    expect(f.calls.every((url) => url.startsWith('https://acme.com/'))).toBe(true)
  })
  it('caps page fetches at forty and reports missing sitemap and robots', async () => {
    const entries: Record<string, string> = { 'https://acme.com/': Array.from({ length: 80 }, (_, i) => `<a href="/p${i}">x</a>`).join('') }
    for (let i = 0; i < 80; i++) entries[`https://acme.com/p${i}`] = `<title>Page ${i}</title>`
    const f = fixture(entries)
    const graph = await buildSiteGraph('acme.com', { ...f, lookupImpl, maxPages: 100 })
    expect(graph.pages).toHaveLength(40)
    expect(graph.fetched).toBe(40)
    expect(graph.sitemapUrl).toBeNull()
    expect(graph.robotsUrl).toBeNull()
    expect(graph.notes.join(' ')).toMatch(/sitemap/i)
    expect(graph.notes.join(' ')).toMatch(/robots/i)
  })
  it('checks robots and origin on redirects before following', async () => {
    const calls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url)
      if (url.endsWith('/robots.txt')) return { ok: true, status: 200, text: async () => 'User-agent: *\nDisallow: /secret', json: async () => null }
      if (url.endsWith('/sitemap.xml')) return { ok: false, status: 404, text: async () => '', json: async () => null }
      if (url.endsWith('/')) return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<a href="/a">a</a><a href="/b">b</a>', json: async () => null }
      return { ok: false, status: 302, headers: { get: () => url.endsWith('/a') ? '/secret' : 'http://127.0.0.1/' }, text: async () => '', json: async () => null }
    }
    await buildSiteGraph('acme.com', { fetchImpl, lookupImpl })
    expect(calls).not.toContain('https://acme.com/secret')
    expect(calls.every((url) => url.startsWith('https://acme.com/'))).toBe(true)
  })
  it('rejects authentication, query, form and cross-origin links', async () => {
    const f = fixture({ 'https://acme.com/': '<a href="/login">login</a><a href="/x?a=1">query</a><form><a href="/private-form">form</a></form><a href="https://other.com/">external</a>' })
    const graph = await buildSiteGraph('acme.com', { ...f, lookupImpl })
    expect(graph.pages[0].links).toEqual([])
    expect(f.calls).toEqual(['https://acme.com/robots.txt', 'https://acme.com/sitemap.xml', 'https://acme.com/'])
  })
})
