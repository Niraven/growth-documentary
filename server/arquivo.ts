/**
 * Arquivo.pt is a second public web archive.
 *
 * It is used as an independent coverage signal, not as a second opinion on the
 * page diff. A capture listed here is a link the reader can open; it does not
 * become a dated change unless the timeline itself reads it.
 */

import type { FetchLike } from './archive.js'
import { TimelineError, USER_AGENT } from './archive.js'
import { labelFor, normaliseTarget } from './core.js'
import type { ArchiveCapture, ArchivesSource } from '../shared/sources.js'

export type ArquivoOptions = {
  fetchImpl?: FetchLike
  timeoutMs?: number
}

const ARQUIVO_ORIGIN = 'https://arquivo.pt'
const MAX_ITEMS = 50

const hostOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Read Arquivo.pt's public index for the target host. Never throws for remote failure. */
export async function buildArquivoInfo(
  raw: string,
  options: ArquivoOptions = {},
): Promise<ArchivesSource> {
  const { fetchImpl = globalThis.fetch as unknown as FetchLike, timeoutMs = 12_000 } = options
  const target = normaliseTarget(raw)
  const targetHost = target.hostname.toLowerCase().replace(/^www\./, '')
  const checkedAt = new Date().toISOString()

  const empty = (status: ArchivesSource['status'], note: string): ArchivesSource => ({
    provider: 'Arquivo.pt',
    status,
    count: 0,
    first: null,
    last: null,
    captures: [],
    note,
    checkedAt,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL(`${ARQUIVO_ORIGIN}/textsearch`)
    url.searchParams.set('versionHistory', target.href)
    url.searchParams.set('maxItems', String(MAX_ITEMS))

    const response = await fetchImpl(url.toString(), {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
    })
    if (!response.ok) {
      return empty('unavailable', `Arquivo.pt answered ${response.status}. This lane is unread, not zero.`)
    }
    const payload = (await response.json()) as unknown
    if (typeof payload !== 'object' || payload === null) {
      return empty('unavailable', 'Arquivo.pt returned an unexpected response. This lane is unread, not zero.')
    }
    const record = payload as Record<string, unknown>
    const items = Array.isArray(record.response_items) ? record.response_items : []
    const indexed = items
      .map((item): ArchiveCapture | null => {
        if (typeof item !== 'object' || item === null) return null
        const row = item as Record<string, unknown>
        const ts = typeof row.tstamp === 'string' ? row.tstamp : ''
        if (!/^\d{14}$/.test(ts)) return null
        const original = typeof row.originalURL === 'string' ? row.originalURL : target.href
        if (hostOf(original) !== targetHost) return null
        const replay =
          typeof row.linkToNoFrame === 'string' && row.linkToNoFrame.startsWith(`${ARQUIVO_ORIGIN}/`)
            ? row.linkToNoFrame
            : `${ARQUIVO_ORIGIN}/noFrame/replay/${ts}/${original}`
        return { ts, label: labelFor(ts), url: replay }
      })
      .filter((capture): capture is ArchiveCapture => capture !== null)
      .sort((a, b) => b.ts.localeCompare(a.ts))
    const unique = [...new Map(indexed.map((capture) => [capture.ts, capture])).values()]
    const estimate =
      typeof record.estimated_nr_results === 'number' && Number.isFinite(record.estimated_nr_results)
        ? record.estimated_nr_results
        : unique.length

    if (unique.length === 0) {
      return empty(
        'empty',
        'Arquivo.pt lists no captures for this host. This lane is empty, not proof the page never existed.',
      )
    }

    return {
      provider: 'Arquivo.pt',
      status: 'read',
      count: unique.length,
      first: unique[unique.length - 1]?.ts ?? null,
      last: unique[0]?.ts ?? null,
      captures: unique.slice(0, 5),
      note: `Arquivo.pt's public index estimates ${estimate.toLocaleString()} captures; ${unique.length} unique rows were inspected and the newest capture is linked here. The dated page diff still comes from the Internet Archive; this lane is coverage only.`,
      checkedAt,
    }
  } catch (error) {
    if (error instanceof TimelineError) throw error
    return empty(
      'unavailable',
      (error as Error)?.name === 'AbortError'
        ? 'Arquivo.pt took too long to answer. This lane is unread, not zero.'
        : 'Could not reach Arquivo.pt. This lane is unread, not zero.',
    )
  } finally {
    clearTimeout(timer)
  }
}
