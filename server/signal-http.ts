import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { parse } from 'parse5'
import { USER_AGENT, type FetchLike } from './archive.js'
import { isPublicAddress, robotsAllows, type Lookup } from './live.js'

export type SignalOptions = { fetchImpl?: FetchLike; lookupImpl?: Lookup; timeoutMs?: number; maxBytes?: number }
const lookupDefault: Lookup = async (host) => dnsLookup(host, { all: true, verbatim: true })

/** Request with DNS pinned to an already validated public address, no redirects. */
async function pinned(url: URL, address: string, family: number, signal: AbortSignal, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      signal, family, headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      lookup: (_host, _options, callback) => callback(null, address, family),
    }, (response) => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume(); reject(new Error(`HTTP ${response.statusCode}`)); return
      }
      const chunks: Buffer[] = []; let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > maxBytes) { response.destroy(new Error('Response too large')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    request.on('error', reject); request.end()
  })
}

export async function requestPublic(url: URL, options: SignalOptions, signal: AbortSignal): Promise<string> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid public URL')
  const records = await (options.lookupImpl ?? lookupDefault)(url.hostname)
  if (signal.aborted) throw new Error('Timed out')
  if (!records.length || records.some((r) => !isPublicAddress(r.address))) throw new Error('Non-public address')
  const maxBytes = options.maxBytes ?? 2_000_000
  if (!options.fetchImpl) return pinned(url, records[0].address, records[0].family, signal, maxBytes)
  const response = await options.fetchImpl(url.href, { signal, redirect: 'manual', headers: { 'user-agent': USER_AGENT } })
  if (!response.ok || response.status >= 300 || (response.url && new URL(response.url).origin !== url.origin)) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  if (Buffer.byteLength(text) > maxBytes) throw new Error('Response too large')
  return text
}

export async function publicPage(url: URL, options: SignalOptions, signal: AbortSignal): Promise<string> {
  let robots = ''
  try { robots = await requestPublic(new URL('/robots.txt', url.origin), options, signal) } catch (error) {
    if (!(error instanceof Error) || !/^HTTP (404|410)$/.test(error.message)) throw error
  }
  if (!robotsAllows(robots, `${url.pathname}${url.search}`)) throw new Error('robots.txt disallows this page')
  return requestPublic(url, options, signal)
}

export async function budget<T>(options: SignalOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([run(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Timed out')) }, options.timeoutMs ?? 12_000)
    })])
  } finally { clearTimeout(timer!) }
}

type Node = { tagName?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] }
export function htmlLinks(html: string): { tag: string; attrs: Record<string, string> }[] {
  const links: { tag: string; attrs: Record<string, string> }[] = []
  const walk = (node: Node) => {
    if (node.tagName && ['script', 'style', 'template', 'noscript'].includes(node.tagName)) return
    if (node.tagName === 'link' || node.tagName === 'a') links.push({ tag: node.tagName, attrs: Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value])) })
    for (const child of node.childNodes ?? []) walk(child)
  }
  walk(parse(html) as unknown as Node)
  return links
}
export function webUrl(raw: string, base: URL): URL | null {
  try { const url = new URL(raw, base); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null } catch { return null }
}
