import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../server/core'
import { buildSiteInfo, parseSitemap } from '../server/site'

const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2024-01-10</lastmod></url>
  <url><loc>https://example.com/pricing</loc><lastmod>2024-03-02T10:00:00+00:00</lastmod></url>
  <url><loc>https://example.com/blog</loc></url>
</urlset>`

const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`

describe('parseSitemap', () => {
  it('counts urls, dated entries and months from a urlset', () => {
    const parsed = parseSitemap(urlset)
    expect(parsed).not.toBeNull()
    expect(parsed?.urls.size).toBe(3)
    expect(parsed?.dated).toBe(2)
    expect(parsed?.months.get('2024-01')).toBe(1)
    expect(parsed?.months.get('2024-03')).toBe(1)
    expect(parsed?.children).toEqual([])
  })

  it('reads child sitemap urls from an index', () => {
    const parsed = parseSitemap(index)
    expect(parsed?.children).toEqual([
      'https://example.com/sitemap-1.xml',
      'https://example.com/sitemap-2.xml',
    ])
    expect(parsed?.urls.size).toBe(0)
  })

  it('returns null for something that is not a sitemap', () => {
    expect(parseSitemap('<html><body>hello</body></html>')).toBeNull()
  })
})

const siteFetch = (xml: string): FetchLike => async (url) => {
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
  return { ok: true, status: 200, json: async () => null, text: async () => xml }
}

describe('buildSiteInfo', () => {
  it('reads the archived sitemap and reports page growth', async () => {
    const site = await buildSiteInfo('example.com', { fetchImpl: siteFetch(urlset) })
    expect(site.pages).toBe(3)
    expect(site.dated).toBe(2)
    expect(site.archivedAt).toBe('2024-06-01')
    expect(site.sitemapUrl).toBe('https://example.com/sitemap.xml')
    expect(site.months).toEqual([
      { month: '2024-01', added: 1 },
      { month: '2024-03', added: 1 },
    ])
    expect(site.note).toMatch(/Archived sitemap captured 1 Jun 2024/)
  })

  it('answers an empty report when no sitemap is archived', async () => {
    const empty: FetchLike = async (url) => {
      if (url.includes('/cdx/search/cdx')) {
        return {
          ok: true,
          status: 200,
          json: async () => [['urlkey', 'timestamp']],
          text: async () => '',
        }
      }
      return { ok: false, status: 404, json: async () => null, text: async () => '' }
    }
    const site = await buildSiteInfo('example.com', { fetchImpl: empty })
    expect(site.pages).toBe(0)
    expect(site.sitemapUrl).toBeNull()
    expect(site.note).toMatch(/No archived sitemap/)
  })

  it('rejects a private target before any fetch', async () => {
    let called = false
    const spy: FetchLike = async () => {
      called = true
      throw new Error('should not run')
    }
    await expect(buildSiteInfo('localhost', { fetchImpl: spy })).rejects.toMatchObject({
      status: 400,
    })
    expect(called).toBe(false)
  })
})
