import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { parse, parseFragment } from 'parse5'
import { PAGE_TYPES, type PageType, type SiteGraph, type SiteGraphPage } from '../shared/sitegraph.js'
import { TimelineError, USER_AGENT, type FetchLike } from './archive.js'
import { normaliseTarget } from './core.js'
import { resolvePublic, robotsAllows, type Lookup } from './live.js'

export type SiteGraphOptions = { fetchImpl?: FetchLike; lookupImpl?: Lookup; timeoutMs?: number; maxPages?: number }
type Node = { nodeName: string; tagName?: string; value?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] }
const lookup: Lookup = async (host) => dnsLookup(host, { all: true, verbatim: true })
const MAX_BYTES = 1_000_000
const attr = (node: Node, name: string) => node.attrs?.find((a) => a.name === name)?.value ?? ''
function text(node: Node): string {
  if (['script', 'style', 'template', 'noscript'].includes(node.tagName ?? '')) return ''
  return node.nodeName === '#text' ? node.value ?? '' : (node.childNodes ?? []).map(text).join(' ')
}
const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 500)
function classify(url: string, title: string, h1: string): PageType {
  const str = `${new URL(url).pathname.replace(/[-_/]/g, ' ')} ${title} ${h1}`.toLowerCase()
  const patterns: [PageType, RegExp][] = [
    ['pricing', /\b(pricing|prices|plans)\b/], ['compare', /\b(compare|comparison|alternatives|versus|vs)\b/],
    ['integrations', /\b(integrations?|connectors?)\b/], ['changelog', /\b(changelog|release notes|updates)\b/],
    ['careers', /\b(careers?|jobs|hiring)\b/], ['docs', /\b(docs|documentation|developer guides?)\b/],
    ['blog', /\b(blog|articles?|news)\b/], ['product', /\b(product|features?|platform|solutions?)\b/],
  ]
  return patterns.find(([, re]) => re.test(str))?.[0] ?? 'other'
}

/** URL filtering is deliberately conservative: no queries, auth, forms, or assets. */
function eligible(raw: string, base: string, origin: string, sitemap = false): URL | null {
  try {
    if (raw.length > 2048) return null
    const url = new URL(raw, base)
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) return null
    url.hash = ''
    const path = decodeURIComponent(url.pathname)
    if (/\/(?:login|log-in|signin|sign-in|signup|sign-up|register|logout|account|auth|checkout|cart|admin|session)(?:\/|$)/i.test(path)) return null
    if (!sitemap && /\.(?:pdf|png|jpe?g|gif|webp|svg|ico|css|js|json|xml|zip|gz|mp4|webm|woff2?|ttf|rss|atom)$/i.test(url.pathname)) return null
    return url
  } catch { return null }
}

/** Use a DNS-pinned connection so a second resolution cannot rebind to a private IP. */
async function nativeRead(url: URL, address: string, family: number, signal: AbortSignal): Promise<{ status: number; location: string | null; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET', signal, agent: false, family, headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml,text/xml,text/plain' },
      lookup: (_host, _options, callback) => callback(null, address, family),
    }, (res) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BYTES) { res.destroy(new Error('Response too large')); return }
        chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null, type: res.headers['content-type'] ?? '', body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    request.end()
  })
}

export async function buildSiteGraph(rawTarget: string, options: SiteGraphOptions = {}): Promise<SiteGraph> {
  const target = normaliseTarget(rawTarget)
  const origin = target.origin
  const timeout = Math.min(5000, Math.max(1, options.timeoutMs ?? 5000))
  const maxPages = Math.min(40, Math.max(1, Math.floor(options.maxPages ?? 40)))
  const notes: string[] = []
  let skipped = 0
  let fetched = 0
  const seen = new Set<string>()
  const queue: string[] = []
  const pages: SiteGraphPage[] = []
  let rules = ''
  const read = async (start: URL, obeyRobots: boolean, sitemap = false) => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const task = async () => {
      let current = start
      for (let hop = 0; hop <= 3; hop++) {
        if (obeyRobots && !robotsAllows(rules, current.pathname + current.search)) throw new Error('Disallowed by robots.txt')
        const records = await resolvePublic(current.hostname, options.lookupImpl ?? lookup)
        if (controller.signal.aborted) throw new Error('Timeout')
        let result: { status: number; location: string | null; type: string; body: string }
        if (options.fetchImpl) {
          const response = await options.fetchImpl(current.href, { signal: controller.signal, redirect: 'manual', headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml,text/xml,text/plain' } })
          if (response.url && new URL(response.url).origin !== origin) throw new Error('Off-origin response')
          const declared = Number(response.headers?.get('content-length') ?? 0)
          if (declared > MAX_BYTES) throw new Error('Response too large')
          const body = await response.text()
          if (Buffer.byteLength(body) > MAX_BYTES) throw new Error('Response too large')
          result = { status: response.status, location: response.headers?.get('location') ?? null, type: response.headers?.get('content-type') ?? '', body }
        } else result = await nativeRead(current, records[0].address, records[0].family, controller.signal)
        if (result.status >= 300 && result.status < 400) {
          const next = result.location && eligible(result.location, current.href, origin, sitemap)
          if (!next) throw new Error('Unsafe redirect')
          current = next
          continue
        }
        return { ...result, url: current.href }
      }
      throw new Error('Too many redirects')
    }
    try {
      return await Promise.race([task(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')) }, timeout) })])
    } finally { clearTimeout(timer!) }
  }
  // Resolve before any fetch, including robots, and surface private DNS as an error.
  let dnsTimer: ReturnType<typeof setTimeout>
  try {
    await Promise.race([resolvePublic(target.hostname, options.lookupImpl ?? lookup), new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new TimelineError('DNS lookup timed out', 504)), timeout) })])
  } finally { clearTimeout(dnsTimer!) }
  let robotsUrl: string | null = null
  let robotsUnavailable = false
  const sitemapCandidates: string[] = []
  try {
    const r = await read(new URL('/robots.txt', origin), false, true)
    if (r.status >= 200 && r.status < 300) {
      robotsUrl = r.url; rules = r.body
      for (const line of rules.split(/\r?\n/)) {
        const match = /^\s*sitemap\s*:\s*(\S+)/i.exec(line)
        if (match) { const url = eligible(match[1], origin, origin, true); if (url) sitemapCandidates.push(url.href) }
      }
    } else if (r.status === 404 || r.status === 410) notes.push('robots.txt is missing; no rules were found.')
    else { robotsUnavailable = true; notes.push(`robots.txt unavailable (HTTP ${r.status}); crawling blocked.`) }
  } catch { robotsUnavailable = true; notes.push('robots.txt unavailable; crawling blocked.') }
  let sitemapUrl: string | null = null
  sitemapCandidates.push(new URL('/sitemap.xml', origin).href)
  const sitemapSeen = new Set<string>()
  while (!robotsUnavailable && sitemapCandidates.length && sitemapSeen.size < 10) {
    const raw = sitemapCandidates.shift()!
    if (sitemapSeen.has(raw)) continue
    sitemapSeen.add(raw)
    try {
      const r = await read(new URL(raw), true, true)
      if (r.status < 200 || r.status >= 300 || !/<(?:\w+:)?(?:urlset|sitemapindex)\b/i.test(r.body)) continue
      sitemapUrl ??= r.url
      const index = /<(?:\w+:)?sitemapindex\b/i.test(r.body)
      const locs = r.body.matchAll(/<(?:\w+:)?loc\b[^>]*>([\s\S]*?)<\/(?:\w+:)?loc\s*>/gi)
      for (const match of locs) {
        const decoded = clean(text(parseFragment(match[1]) as unknown as Node))
        const url = eligible(decoded, r.url, origin, index)
        if (!url) { skipped++; continue }
        if (index) { if (sitemapCandidates.length < 100) sitemapCandidates.push(url.href) }
        else enqueue(url.href)
      }
    } catch { /* A missing or inaccessible sitemap is reported below. */ }
  }
  if (!sitemapUrl) notes.push('No readable sitemap found.')
  function enqueue(raw: string) {
    const u = eligible(raw, origin, origin)
    if (!u) { skipped++; return }
    if (seen.has(u.href)) return
    if (seen.size >= 2000) { skipped++; return }
    seen.add(u.href); queue.push(u.href)
  }
  // The requested page is always first, independent of sitemap order.
  const initial = eligible(target.href, origin, origin)
  if (initial) { seen.delete(initial.href); const i = queue.indexOf(initial.href); if (i >= 0) queue.splice(i, 1); seen.add(initial.href); queue.unshift(initial.href) }
  while (!robotsUnavailable && queue.length && fetched < maxPages) {
    const url = queue.shift()!
    if (!robotsAllows(rules, new URL(url).pathname)) { skipped++; continue }
    fetched++
    try {
      const r = await read(new URL(url), true)
      if (r.status < 200 || r.status >= 300 || !/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(r.type)) { skipped++; continue }
      if (pages.some((p) => p.url === r.url)) continue
      const doc = parse(r.body) as unknown as Node
      let title = ''; let h1 = ''; let description = ''
      const links = new Set<string>()
      const visit = (node: Node, inForm = false) => {
        if (['script', 'style', 'template', 'noscript'].includes(node.tagName ?? '')) return
        const form = inForm || node.tagName === 'form'
        if (node.tagName === 'title' && !title) title = clean(text(node))
        if (node.tagName === 'h1' && !h1) h1 = clean(text(node))
        if (node.tagName === 'meta' && attr(node, 'name').toLowerCase() === 'description' && !description) description = clean(attr(node, 'content'))
        if (node.tagName === 'a' && !form && attr(node, 'href')) {
          const link = eligible(attr(node, 'href'), r.url, origin)
          if (link && links.size < 500) { links.add(link.href); enqueue(link.href) } else if (!link) skipped++
        }
        for (const child of node.childNodes ?? []) visit(child, form)
      }
      visit(doc)
      pages.push({ url: r.url, type: classify(r.url, title, h1), title, h1, description, links: [...links] })
    } catch { skipped++ }
  }
  if (queue.length) { skipped += queue.length; notes.push('Page limit reached; remaining discovered URLs were not fetched.') }
  const pageTypes = Object.fromEntries(PAGE_TYPES.map((type) => [type, 0])) as Record<PageType, number>
  for (const page of pages) pageTypes[page.type]++
  return { domain: target.hostname, checkedAt: new Date().toISOString(), robotsUrl, sitemapUrl, pages, pageTypes, discovered: seen.size, fetched, skipped, notes }
}
