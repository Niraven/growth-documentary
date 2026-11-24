/**
 * Hacker News is a public conversation index, not a crawler.
 *
 * We ask its public Algolia API for stories whose submitted URL points at the
 * target host. No login, no comments scraping, no guessed mentions: a story that
 * only names the company in its title is not counted.
 */

import type { FetchLike } from './archive.js'
import { TimelineError, USER_AGENT } from './archive.js'
import { normaliseTarget } from './core.js'
import type { MentionMonth, MentionStory, MentionsSource } from '../shared/sources.js'

export type MentionOptions = {
  fetchImpl?: FetchLike
  timeoutMs?: number
}

const HN_SEARCH = 'https://hn.algolia.com/api/v1/search_by_date'
const MAX_HITS = 100
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000

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

const asStory = (hit: unknown, targetHost: string): MentionStory | null => {
  if (typeof hit !== 'object' || hit === null) return null
  const record = hit as Record<string, unknown>
  const submittedUrl = typeof record.url === 'string' ? record.url : null
  if (!submittedUrl || hostOf(submittedUrl) !== targetHost) return null
  if (
    typeof record.objectID !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.created_at !== 'string' ||
    typeof record.author !== 'string'
  ) {
    return null
  }
  const createdAt = Date.parse(record.created_at)
  if (!Number.isFinite(createdAt)) return null
  return {
    id: record.objectID,
    title: record.title,
    url: `https://news.ycombinator.com/item?id=${encodeURIComponent(record.objectID)}`,
    submittedUrl,
    createdAt: new Date(createdAt).toISOString(),
    points: typeof record.points === 'number' && Number.isFinite(record.points) ? record.points : 0,
    comments:
      typeof record.num_comments === 'number' && Number.isFinite(record.num_comments)
        ? record.num_comments
        : 0,
    author: record.author,
  }
}

/** Fetch public HN stories linking to the target host. Never throws for a remote failure. */
export async function buildMentions(raw: string, options: MentionOptions = {}): Promise<MentionsSource> {
  const { fetchImpl = globalThis.fetch as unknown as FetchLike, timeoutMs = 12_000 } = options
  const target = normaliseTarget(raw)
  const targetHost = target.hostname.toLowerCase().replace(/^www\./, '')
  const checkedAt = new Date().toISOString()

  const empty = (status: MentionsSource['status'], note: string): MentionsSource => ({
    provider: 'Hacker News',
    status,
    total: 0,
    truncated: false,
    months: [],
    stories: [],
    note,
    checkedAt,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL(HN_SEARCH)
    url.searchParams.set('query', targetHost)
    url.searchParams.set('tags', 'story')
    url.searchParams.set('hitsPerPage', String(MAX_HITS))
    url.searchParams.set('numericFilters', `created_at_i>${Math.floor((Date.now() - TWO_YEARS_MS) / 1000)}`)

    const response = await fetchImpl(url.toString(), {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
    })
    if (!response.ok) {
      return empty('unavailable', `Hacker News answered ${response.status}. This lane is unread, not zero.`)
    }
    const payload = (await response.json()) as unknown
    if (typeof payload !== 'object' || payload === null) {
      return empty('unavailable', 'Hacker News returned an unexpected response. This lane is unread, not zero.')
    }
    const record = payload as Record<string, unknown>
    const hits = Array.isArray(record.hits) ? record.hits : []
    const nbHits = typeof record.nbHits === 'number' && Number.isFinite(record.nbHits) ? record.nbHits : hits.length
    const matched = hits
      .map((hit) => asStory(hit, targetHost))
      .filter((story): story is MentionStory => story !== null)
      .sort((a, b) => b.points - a.points || b.createdAt.localeCompare(a.createdAt))

    if (matched.length === 0) {
      return {
        ...empty(
          'empty',
          nbHits > 0
            ? 'The search returned stories, but none had a submitted URL on this host. This lane counts links, not name mentions.'
            : 'No public Hacker News story in the last two years links to this host. This lane is empty, not proof nobody talked about it.',
        ),
        total: 0,
        truncated: nbHits > hits.length,
      }
    }

    const counts = new Map<string, number>()
    for (const story of matched) {
      const month = story.createdAt.slice(0, 7)
      counts.set(month, (counts.get(month) ?? 0) + 1)
    }
    const months: MentionMonth[] = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    return {
      provider: 'Hacker News',
      status: 'read',
      total: matched.length,
      truncated: nbHits > hits.length,
      months,
      stories: matched.slice(0, 6),
      note: `Public stories whose submitted URL points at ${targetHost}. Last two years; up to ${MAX_HITS} results.`,
      checkedAt,
    }
  } catch (error) {
    if (error instanceof TimelineError) throw error
    return empty(
      'unavailable',
      (error as Error)?.name === 'AbortError'
        ? 'Hacker News took too long to answer. This lane is unread, not zero.'
        : 'Could not reach Hacker News. This lane is unread, not zero.',
    )
  } finally {
    clearTimeout(timer)
  }
}
