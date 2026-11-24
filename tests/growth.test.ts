import { describe, expect, it } from 'vitest'
import type { Capture, Change, SiteInfo, Timeline } from '../shared/timeline'
import type { SourcesReport } from '../shared/sources'
import type { FeedSignal } from '../shared/signals'
import { buildGrowthTimeline, growthMarkdown, isGrowthTimeline } from '../shared/growth'

const capture = (ts: string, h1: string, prices: string[]): Capture => ({
  ts,
  label: `${ts.slice(6, 8)} ${ts.slice(4, 6)} ${ts.slice(0, 4)}`,
  title: 'Pricing',
  h1,
  prices,
  url: `https://web.archive.org/web/${ts}/https://example.com/pricing`,
})

const a = capture('20250101000000', 'Earlier', ['$30/mo'])
const b = capture('20250601000000', 'Middle', ['$50/mo'])

const change = (row: Capture, field: Change['field'], before: string, after: string): Change => ({
  ts: row.ts,
  label: row.label,
  field,
  before,
  after,
  url: row.url,
})

const report: Timeline = {
  domain: 'example.com',
  path: '/pricing',
  checkedAt: '2026-01-02T00:00:00Z',
  captures: [a, b],
  coverage: { from: a.ts, to: b.ts, sampled: 2, available: 20, months: 6, strategy: 'adaptive' },
  changes: [
    {
      ts: a.ts,
      label: a.label,
      field: 'first capture',
      before: '',
      after: a.title,
      url: a.url,
    },
    change(b, 'price', a.prices.join(', '), b.prices.join(', ')),
  ],
}

const site: SiteInfo = {
  domain: 'example.com',
  sitemapUrl: 'https://example.com/sitemap.xml',
  archivedAt: '2026-01-01',
  pages: 120,
  dated: 80,
  months: [
    { month: '2025-05', added: 6 },
    { month: '2025-08', added: 3 },
  ],
  children: 0,
  note: 'Archived sitemap captured 1 Jan 2026.',
}

const sources: SourcesReport = {
  domain: 'example.com',
  checkedAt: '2026-01-02T00:00:00Z',
  mentions: {
    provider: 'Hacker News',
    status: 'read',
    total: 8,
    truncated: false,
    months: [{ month: '2025-07', count: 1 }],
    stories: [
      {
        id: '123',
        title: 'Example launches a new pricing page',
        url: 'https://news.ycombinator.com/item?id=123',
        submittedUrl: 'https://example.com/pricing',
        createdAt: '2025-07-15T10:00:00.000Z',
        points: 42,
        comments: 7,
        author: 'someone',
      },
    ],
    note: 'Public stories whose submitted URL points at example.com. Last two years; up to 100 results.',
    checkedAt: '2026-01-02T00:00:00Z',
  },
  archives: {
    provider: 'Arquivo.pt',
    status: 'read',
    count: 2,
    first: '2025-01-01',
    last: '2025-07-01',
    captures: [],
    note: 'Coverage only.',
    checkedAt: '2026-01-02T00:00:00Z',
  },
}

const feeds: FeedSignal = {
  status: 'read',
  entries: [
    {
      title: 'Release notes: September',
      url: 'https://example.com/changelog/september',
      publishedAt: '2025-09-01T12:00:00.000Z',
      summary: 'A dated release entry from the site’s own feed.',
    },
  ],
  note: 'Public feed read.',
  checkedAt: '2026-01-02T00:00:00Z',
}

describe('growth timeline', () => {
  it('merges page, site, public-launch and feed signals newest first', () => {
    const timeline = buildGrowthTimeline(report, site, sources, feeds)
    expect(timeline.target).toBe('example.com/pricing')
    expect(timeline.events.map((event) => event.type)).toEqual([
      'release',
      'site expansion',
      'public signal',
      'page change',
      'site expansion',
    ])
    expect(timeline.counts).toEqual({
      pageChanges: 1,
      siteAdditions: 9,
      publicSignals: 1,
      releases: 1,
    })
    expect(timeline.events.map((event) => event.source)).toEqual([
      'Public feed',
      'Archived sitemap',
      'Hacker News',
      'Internet Archive',
      'Archived sitemap',
    ])
  })

  it('keeps the baseline out of events and counts', () => {
    const timeline = buildGrowthTimeline(report, site, sources)
    expect(timeline.events.some((event) => event.id.includes('first capture'))).toBe(false)
    expect(timeline.counts.pageChanges).toBe(1)
  })

  it('ties every event to a public source URL and evidence label', () => {
    const timeline = buildGrowthTimeline(report, site, sources)
    for (const event of timeline.events) {
      expect(event.sourceUrl).toMatch(/^https:\/\//)
      expect(event.evidence).toMatch(/dated capture|self-reported|public post/)
    }
  })

  it('does not invent site or launch events when those lanes are absent', () => {
    const timeline = buildGrowthTimeline(report, null, null)
    expect(timeline.events).toHaveLength(1)
    expect(timeline.sources.site).toBe(false)
    expect(timeline.sources.publicSignals).toBe(false)
    expect(timeline.caveats.join(' ')).toContain('Site expansion is absent, not zero')
    expect(timeline.caveats.join(' ')).toContain('not proof of zero public signals')
  })

  it('does not turn an unavailable HN lane into a zero launch claim', () => {
    const unavailable: SourcesReport = {
      ...sources,
      mentions: {
        ...sources.mentions,
        status: 'unavailable',
        total: 0,
        stories: [],
        note: 'Hacker News answered 503. This lane is unread, not zero.',
      },
    }
    const timeline = buildGrowthTimeline(report, site, unavailable)
    expect(timeline.counts.publicSignals).toBe(0)
    expect(timeline.caveats.join(' ')).toContain('not proof of zero public signals')
  })

  it('exports the same event ids and source URLs as Markdown', () => {
    const timeline = buildGrowthTimeline(report, site, sources)
    const markdown = growthMarkdown(timeline)
    expect(markdown).toContain('public growth timeline')
    expect(markdown).toContain('2 of 20')
    for (const event of timeline.events) expect(markdown).toContain(event.sourceUrl)
    expect(markdown).toContain('No revenue, traffic, conversion, ROAS or causal claim')
  })

  it('rejects a fabricated event at the API boundary', () => {
    const timeline = buildGrowthTimeline(report, site, sources)
    expect(isGrowthTimeline(timeline)).toBe(true)
    expect(
      isGrowthTimeline({
        ...timeline,
        events: [{ ...timeline.events[0], evidence: 'vibes' }],
      }),
    ).toBe(false)
  })
})
