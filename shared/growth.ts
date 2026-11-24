/**
 * The growth timeline is the product contract.
 *
 * It is derived from the report, the archived sitemap and the public-source
 * lanes. It never fetches anything itself, and it never turns a missing source
 * into an event. That keeps the API, the UI and the exports on the same facts.
 */

import type { SiteInfo, Timeline } from './timeline.js'
import type { SourcesReport } from './sources.js'
import type { FeedSignal } from './signals.js'

export type GrowthEventType = 'page change' | 'site expansion' | 'public signal' | 'release'
export type GrowthEventSource =
  | 'Internet Archive'
  | 'Archived sitemap'
  | 'Hacker News'
  | 'Public feed'
export type GrowthEvidence = 'dated capture' | 'self-reported' | 'public post' | 'published feed'

export type GrowthEvent = {
  id: string
  /** `YYYY-MM-DD` when the source gives a day, `YYYY-MM` for a sitemap month. */
  date: string
  /** Human-readable date label, in UTC. */
  label: string
  type: GrowthEventType
  title: string
  detail: string
  source: GrowthEventSource
  sourceUrl: string
  evidence: GrowthEvidence
  note: string
  /** For a page change, the exact before/after strings and capture links. */
  before?: string
  after?: string
  beforeUrl?: string
  afterUrl?: string
}

export type GrowthTimeline = {
  target: string
  period: { from: string; to: string; months: number }
  coverage: { sampled: number; listed: number; strategy: 'adaptive' }
  events: GrowthEvent[]
  counts: { pageChanges: number; siteAdditions: number; publicSignals: number; releases: number }
  sources: {
    page: boolean
    site: boolean
    publicSignals: boolean
    feeds: boolean
    ads: 'manual'
  }
  caveats: string[]
  checkedAt: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthLabel = (month: string): string => {
  const [year, value] = month.split('-').map(Number)
  return `${MONTHS[value - 1]} ${year}`
}

const dayLabel = (iso: string): string => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

const dateOfTs = (ts: string): string =>
  `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`

const pageTitle = (field: string): string => {
  if (field === 'headline') return 'Headline changed'
  if (field === 'price') return 'Price strings changed'
  return 'Page title changed'
}

/**
 * Build the merged, newest-first growth timeline. `site` and `sources` are
 * optional so the UI can paint page events immediately while public lanes load.
 */
export function buildGrowthTimeline(
  report: Timeline,
  site: SiteInfo | null = null,
  sources: SourcesReport | null = null,
  feeds: FeedSignal | null = null,
): GrowthTimeline {
  const events: GrowthEvent[] = []

  for (const change of report.changes) {
    if (change.field === 'first capture') continue
    const date = dateOfTs(change.ts)
    const index = report.captures.findIndex((capture) => capture.ts === change.ts)
    const previous = index > 0 ? report.captures[index - 1] : null
    events.push({
      id: `page:${change.ts}:${change.field}:${change.after}`,
      date,
      label: change.label,
      type: 'page change',
      title: pageTitle(change.field),
      detail: `${change.before || '—'} → ${change.after || '—'}`,
      source: 'Internet Archive',
      sourceUrl: change.url,
      evidence: 'dated capture',
      note: `Read from the archived capture at ${change.label}; observed, not a claim of cause.`,
      before: change.before,
      after: change.after,
      beforeUrl: previous?.url,
      afterUrl: change.url,
    })
  }

  const siteEvents: GrowthEvent[] = []
  if (site?.sitemapUrl) {
    for (const month of site.months) {
      if (month.added <= 0) continue
      siteEvents.push({
        id: `site:${month.month}`,
        date: `${month.month}-01`,
        label: monthLabel(month.month),
        type: 'site expansion',
        title: `${month.added} page${month.added === 1 ? '' : 's'} added`,
        detail: `The site’s own sitemap dates ${month.added} page${
          month.added === 1 ? '' : 's'
        } to this month.`,
        source: 'Archived sitemap',
        sourceUrl: site.sitemapUrl,
        evidence: 'self-reported',
        note: `Archived sitemap read ${
          site.archivedAt ? dayLabel(site.archivedAt) : 'at an unknown date'
        }; ${site.pages.toLocaleString()} unique pages in that read.`,
      })
    }
  }
  events.push(...siteEvents)

  const launchEvents: GrowthEvent[] = []
  if (sources?.mentions.status === 'read') {
    for (const story of sources.mentions.stories) {
      const date = story.createdAt.slice(0, 10)
      launchEvents.push({
        id: `launch:${story.id}`,
        date,
        label: dayLabel(date),
        type: 'public signal',
        title: story.title,
        detail: `${story.points} point${story.points === 1 ? '' : 's'} · ${
          story.comments
        } comment${story.comments === 1 ? '' : 's'} · submitted URL on this host`,
        source: 'Hacker News',
        sourceUrl: story.url,
        evidence: 'public post',
        note: `Top ${sources.mentions.stories.length} of ${
          sources.mentions.total
        } matched public stories${sources.mentions.truncated ? ' (a lower bound)' : ''}.`,
      })
    }
  }
  events.push(...launchEvents)

  const releaseEvents: GrowthEvent[] = []
  if (feeds?.status === 'read') {
    for (const entry of feeds.entries) {
      if (!entry.publishedAt) continue
      const date = entry.publishedAt.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      releaseEvents.push({
        id: `release:${entry.url}:${date}`,
        date,
        label: dayLabel(date),
        type: 'release',
        title: entry.title,
        detail: entry.summary || 'Release entry published by the site.',
        source: 'Public feed',
        sourceUrl: entry.url,
        evidence: 'published feed',
        note: 'Published by the site’s own feed; the date is the feed entry’s published date.',
      })
    }
  }
  events.push(...releaseEvents)

  events.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  const siteAdditions = site?.months.reduce((sum, month) => sum + month.added, 0) ?? 0
  const publicSignals = launchEvents.length
  const releases = releaseEvents.length
  const pageChanges = events.length - siteEvents.length - launchEvents.length - releaseEvents.length
  const lists = `${report.coverage.sampled} of ${report.coverage.available}`

  const caveats = [
    `Page changes come from ${lists} sampled captures. Gaps are unread, not unchanged.`,
    site?.sitemapUrl
      ? 'Site expansion uses the site’s own sitemap `lastmod` claims. It is context, not traffic, quality or indexation.'
      : 'No archived sitemap was read. Site expansion is absent, not zero.',
    sources?.mentions.status === 'read'
      ? `Hacker News shows ${publicSignals} of ${sources.mentions.total} matched stories. It counts submitted links, not every discussion.`
      : 'Hacker News is unread or empty. That is not proof of zero public signals.',
    feeds?.status === 'read'
      ? `Public feed shows ${releases} dated release entr${releases === 1 ? 'y' : 'ies'}. A missing feed is unread, not a quiet period.`
      : 'No public release feed was read; release cadence is unknown.',
    'Ad libraries remain manual outbound lookups. No ad start date, spend or ROAS is in this timeline.',
    'No revenue, traffic, conversion, ROAS or causal claim is made anywhere in this report.',
  ]

  const target = `${report.domain}${report.path}`
  const timeline: GrowthTimeline = {
    target,
    period: {
      from: report.coverage.from,
      to: report.coverage.to,
      months: report.coverage.months,
    },
    coverage: {
      sampled: report.coverage.sampled,
      listed: report.coverage.available,
      strategy: report.coverage.strategy,
    },
    events,
    counts: { pageChanges, siteAdditions, publicSignals, releases },
    sources: {
      page: report.changes.length > 0,
      site: Boolean(site?.sitemapUrl),
      publicSignals: sources?.mentions.status === 'read',
      feeds: feeds?.status === 'read',
      ads: 'manual',
    },
    caveats,
    checkedAt: report.checkedAt,
  }

  return timeline
}

/** Markdown is generated from the finished timeline, not from a parallel story. */
export function growthMarkdown(timeline: GrowthTimeline): string {
  const header = [
    `# ${timeline.target} — public growth timeline`,
    '',
    `Period: ${dayLabel(timeline.period.from)} → ${dayLabel(timeline.period.to)}` +
      ` (${timeline.period.months} months)`,
    `Coverage: ${timeline.coverage.sampled} of ${timeline.coverage.listed} listed captures sampled`,
    `Events: ${timeline.events.length} (${timeline.counts.pageChanges} page changes, ` +
      `${timeline.counts.siteAdditions} site additions, ${timeline.counts.publicSignals} public signals, ${timeline.counts.releases} releases)`,
    '',
  ]
  const body = timeline.events.map(
    (event) =>
      `- **${event.label} — ${event.title}** (${event.type}, ${event.source}; ${event.evidence})\n` +
      `  ${event.detail}\n` +
      `  ${event.sourceUrl}` +
      (event.beforeUrl && event.beforeUrl !== event.sourceUrl
        ? `\n  before: ${event.beforeUrl}`
        : ''),
  )
  const limits = ['', '## Limits', '', ...timeline.caveats.map((caveat) => `- ${caveat}`)]
  return [...header, ...body, ...limits].join('\n')
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const TYPES: ReadonlySet<string> = new Set([
  'page change',
  'site expansion',
  'public signal',
  'release',
])
const SOURCES: ReadonlySet<string> = new Set([
  'Internet Archive',
  'Archived sitemap',
  'Hacker News',
  'Public feed',
])
const EVIDENCE: ReadonlySet<string> = new Set([
  'dated capture',
  'self-reported',
  'public post',
  'published feed',
])

const isGrowthEvent = (value: unknown): value is GrowthEvent =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.date) &&
  isString(value.label) &&
  isString(value.type) &&
  TYPES.has(value.type) &&
  isString(value.title) &&
  isString(value.detail) &&
  isString(value.source) &&
  SOURCES.has(value.source) &&
  isString(value.sourceUrl) &&
  isString(value.evidence) &&
  EVIDENCE.has(value.evidence) &&
  isString(value.note) &&
  (value.before === undefined || isString(value.before)) &&
  (value.after === undefined || isString(value.after)) &&
  (value.beforeUrl === undefined || isString(value.beforeUrl)) &&
  (value.afterUrl === undefined || isString(value.afterUrl))

/** Boundary check for `GET /api/growth`. */
export function isGrowthTimeline(value: unknown): value is GrowthTimeline {
  return (
    isRecord(value) &&
    isString(value.target) &&
    isRecord(value.period) &&
    isString(value.period.from) &&
    isString(value.period.to) &&
    isNumber(value.period.months) &&
    isRecord(value.coverage) &&
    isNumber(value.coverage.sampled) &&
    isNumber(value.coverage.listed) &&
    value.coverage.strategy === 'adaptive' &&
    Array.isArray(value.events) &&
    value.events.every(isGrowthEvent) &&
    isRecord(value.counts) &&
    isNumber(value.counts.pageChanges) &&
    isNumber(value.counts.siteAdditions) &&
    isNumber(value.counts.publicSignals) &&
    isNumber(value.counts.releases) &&
    isRecord(value.sources) &&
    typeof value.sources.page === 'boolean' &&
    typeof value.sources.site === 'boolean' &&
    typeof value.sources.publicSignals === 'boolean' &&
    typeof value.sources.feeds === 'boolean' &&
    value.sources.ads === 'manual' &&
    Array.isArray(value.caveats) &&
    value.caveats.every(isString) &&
    isString(value.checkedAt)
  )
}
