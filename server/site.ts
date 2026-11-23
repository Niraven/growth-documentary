/**
 * Site growth from the site's own sitemap, read through the archive.
 *
 * This is deliberately an archive read, not a live crawl: the app's contract is
 * that the only host it talks to is web.archive.org. A stale sitemap is less
 * useful than a fresh one, but it is honest, and the UI says which date it saw.
 */

import { parse } from 'parse5'

import type { SiteInfo, SiteMonth } from '../shared/timeline.js'
import { ArchiveClient, TimelineError, snapshotUrl, type FetchLike } from './archive.js'
import { normaliseTarget } from './core.js'

export type SiteOptions = {
  fetchImpl?: FetchLike
  timeoutMs?: number
}

type HtmlNode = {
  nodeName: string
  tagName?: string
  value?: string
  childNodes?: HtmlNode[]
}

const CANDIDATES = ['sitemap.xml', 'sitemap_index.xml']
const MAX_CHILDREN = 3
const MAX_BYTES = 2_000_000
const MAX_MONTHS = 24

const textOf = (node: HtmlNode | undefined): string => {
  if (!node) return ''
  if (node.nodeName === '#text') return node.value ?? ''
  let out = ''
  for (const child of node.childNodes ?? []) out += textOf(child)
  return out.trim()
}

const findTag = (node: HtmlNode | undefined, tag: string): HtmlNode | undefined => {
  if (!node) return undefined
  if (node.tagName === tag) return node
  for (const child of node.childNodes ?? []) {
    const found = findTag(child, tag)
    if (found) return found
  }
  return undefined
}

type ParsedSitemap = {
  urls: Set<string>
  dated: number
  months: Map<string, number>
  children: string[]
}

/** Read a `<urlset>` or `<sitemapindex>` document. Returns null when it is neither. */
export function parseSitemap(xml: string): ParsedSitemap | null {
  const doc = parse(xml) as unknown as HtmlNode
  const urlset = findTag(doc, 'urlset')
  const index = findTag(doc, 'sitemapindex')
  const root = urlset ?? index
  if (!root) return null

  const urls = new Set<string>()
  const months = new Map<string, number>()
  const children: string[] = []
  let dated = 0

  for (const entry of root.childNodes ?? []) {
    if (entry.tagName !== 'url' && entry.tagName !== 'sitemap') continue
    const loc = textOf(findTag(entry, 'loc'))
    if (!loc) continue

    if (entry.tagName === 'sitemap') {
      children.push(loc)
      continue
    }

    urls.add(loc)
    const lastmod = textOf(findTag(entry, 'lastmod'))
    const month = lastmod.slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(month)) {
      dated += 1
      months.set(month, (months.get(month) ?? 0) + 1)
    }
  }

  return { urls, dated, months, children }
}

const monthList = (months: Map<string, number>): SiteMonth[] =>
  Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-MAX_MONTHS)
    .map(([month, added]) => ({ month, added }))

const emptySite = (domain: string, note: string): SiteInfo => ({
  domain,
  sitemapUrl: null,
  archivedAt: null,
  pages: 0,
  dated: 0,
  months: [],
  children: 0,
  note,
})

export async function buildSiteInfo(raw: string, options: SiteOptions = {}): Promise<SiteInfo> {
  const {
    fetchImpl = globalThis.fetch as unknown as FetchLike,
    timeoutMs = 25_000,
  } = options

  const target = normaliseTarget(raw)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const client = new ArchiveClient(fetchImpl, controller.signal)

  try {
    for (const candidate of CANDIDATES) {
      const sitemapUrl = `${target.origin}/${candidate}`
      let rows: string[][]
      try {
        rows = await client.rows({ url: sitemapUrl, last: 1 })
      } catch {
        continue
      }
      if (rows.length < 2) continue

      const ts = rows[1][1]
      if (!/^\d{14}$/.test(ts ?? '')) continue
      const indexed =
        typeof rows[1][2] === 'string' && /^https?:\/\//i.test(rows[1][2])
          ? rows[1][2]
          : sitemapUrl

      let xml: string
      try {
        const response = await client.get(snapshotUrl(ts, indexed))
        xml = (await response.text()).slice(0, MAX_BYTES)
      } catch {
        continue
      }

      const parsed = parseSitemap(xml)
      if (!parsed) continue

      const pages = new Set(parsed.urls)
      let dated = parsed.dated
      const months = new Map(parsed.months)
      let children = 0

      for (const child of parsed.children.slice(0, MAX_CHILDREN)) {
        try {
          const response = await client.get(snapshotUrl(ts, child))
          const childParsed = parseSitemap((await response.text()).slice(0, MAX_BYTES))
          if (!childParsed) continue
          children += 1
          for (const url of childParsed.urls) pages.add(url)
          dated += childParsed.dated
          for (const [month, added] of childParsed.months) {
            months.set(month, (months.get(month) ?? 0) + added)
          }
        } catch {
          /* one unreadable child sitemap does not sink the report */
        }
      }

      const archivedAt = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
      const readable = new Date(`${archivedAt}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
      const note =
        children > 0
          ? `Archived sitemap index captured ${readable}; ${children} child sitemap${children === 1 ? '' : 's'} read.`
          : `Archived sitemap captured ${readable}.`

      return {
        domain: target.hostname,
        sitemapUrl: indexed,
        archivedAt,
        pages: pages.size,
        dated,
        months: monthList(months),
        children,
        note,
      }
    }

    return emptySite(
      target.hostname,
      'No archived sitemap found for this domain, so site growth cannot be measured from the archive.',
    )
  } catch (error) {
    if (error instanceof TimelineError) {
      return emptySite(target.hostname, error.message)
    }
    if ((error as Error)?.name === 'AbortError') {
      return emptySite(target.hostname, 'The sitemap check timed out. Try again in a minute.')
    }
    return emptySite(target.hostname, 'The sitemap could not be read from the archive.')
  } finally {
    clearTimeout(timer)
  }
}
