import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { normaliseTarget } from './core.js'
import { budget, htmlLinks, publicPage, webUrl, type SignalOptions } from './signal-http.js'
import type { FeedEntry, FeedSignal } from '../shared/signals.js'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: false, parseTagValue: false, trimValues: true })
const obj = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {}
const text = (v: unknown): string => typeof v === 'string' ? v : typeof v === 'number' ? String(v) : typeof obj(v)['#text'] === 'string' ? obj(v)['#text'] as string : ''
const clean = (v: unknown): string => text(v).replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos);/g, (x) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[x] ?? x).replace(/\s+/g, ' ').trim().slice(0, 2000)
const array = (v: unknown): unknown[] => v === undefined ? [] : Array.isArray(v) ? v : [v]

export function parseFeed(xml: string, base: URL): FeedEntry[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid XML')
  const doc = obj(parser.parse(xml))
  const rss = obj(obj(doc.rss).channel)
  const atom = obj(doc.feed)
  if (!doc.rss && !doc.feed) throw new Error('Not RSS or Atom')
  return array(doc.feed ? atom.entry : rss.item).flatMap((raw): FeedEntry[] => {
    const item = obj(raw)
    const link = doc.feed ? array(item.link).map(obj).find((v) => !v['@_rel'] || v['@_rel'] === 'alternate')?.['@_href'] : item.link
    const url = webUrl(clean(link), base)
    const title = clean(item.title)
    if (!url || !title) return []
    const date = Date.parse(text(item.pubDate ?? item.published ?? item.updated ?? item['dc:date']))
    return [{ title, url: url.href, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null, summary: clean(item.description ?? item.summary ?? item.content) }]
  })
}

export async function buildFeedSignals(rawTarget: string, options: SignalOptions = {}): Promise<FeedSignal> {
  const target = normaliseTarget(rawTarget)
  const checkedAt = new Date().toISOString()
  const unavailable = (note: string): FeedSignal => ({ status: 'unavailable', entries: [], note: `${note} This lane is unread, not zero.`, checkedAt })
  try {
    return await budget(options, async (signal) => {
      const html = await publicPage(target, options, signal)
      const candidates = htmlLinks(html).flatMap(({ tag, attrs }) => {
        if (tag !== 'link' || !attrs.rel?.toLowerCase().split(/\s+/).includes('alternate') || !/^(application\/(rss|atom)\+xml)(?:\s*;|$)/i.test(attrs.type ?? '')) return []
        const url = webUrl(attrs.href ?? '', target)
        return url && url.origin === target.origin ? [url.href] : []
      })
      candidates.push(...['/feed', '/rss.xml', '/feed.xml', '/blog/feed'].map((path) => new URL(path, target.origin).href))
      const selected = [...new Set(candidates)].slice(0, 2)
      const results = await Promise.allSettled(selected.map(async (url) => parseFeed(await publicPage(new URL(url), options, signal), new URL(url))))
      const successful = results.filter((r): r is PromiseFulfilledResult<FeedEntry[]> => r.status === 'fulfilled')
      if (!successful.length) return unavailable('No candidate feed could be read.')
      const entries = successful.flatMap((r) => r.value).filter((entry, index, all) => all.findIndex((e) => e.url === entry.url) === index).slice(0, 30)
      if (!entries.length && successful.length < results.length) return unavailable('A candidate feed could not be read.')
      return { status: entries.length ? 'read' : 'empty', entries, note: `Read ${successful.length} public feed(s); up to 30 entries.${successful.length < results.length ? ' Some candidate feeds were unavailable.' : ''}`, checkedAt }
    })
  } catch { return unavailable('Could not read the public page or feeds.') }
}
