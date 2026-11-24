import { describe, expect, it } from 'vitest'
import { buildGrowthBrief } from '../shared/growthBrief'
import type { Capture, Timeline } from '../shared/timeline'
import type { GrowthTimeline } from '../shared/growth'

const capture = (ts: string, h1: string, prices: string[]): Capture => ({
  ts,
  label: `${ts.slice(6, 8)} ${ts.slice(4, 6)} ${ts.slice(0, 4)}`,
  title: 'Pricing',
  h1,
  prices,
  url: `https://web.archive.org/web/${ts}/https://example.com/pricing`,
})

const report: Timeline = {
  domain: 'example.com',
  path: '/pricing',
  captures: [
    capture('20241214215555', 'Old promise.', ['$10/mo', '$20/mo']),
    capture('20261118020945', 'New promise.', ['$20/mo', '$30/mo']),
  ],
  changes: [],
  coverage: {
    from: '20241214215555',
    to: '20261118020945',
    months: 24,
    sampled: 15,
    available: 392,
    strategy: 'adaptive',
  },
  checkedAt: '2026-11-24T00:00:00.000Z',
}

const growth: GrowthTimeline = {
  target: 'example.com/pricing',
  period: { from: report.coverage.from, to: report.coverage.to, months: 24 },
  coverage: { sampled: 15, listed: 392, strategy: 'adaptive' },
  events: [
    {
      id: 'page:1',
      date: '2024-12-14',
      label: '14 Dec 2024',
      type: 'page change',
      title: 'Headline changed',
      detail: '',
      source: 'Internet Archive',
      sourceUrl: 'https://example.com/one',
      evidence: 'dated capture',
      note: '',
    },
    {
      id: 'site:2026-05',
      date: '2026-05-01',
      label: 'May 2026',
      type: 'site expansion',
      title: '171 pages added',
      detail: '',
      source: 'Archived sitemap',
      sourceUrl: 'https://example.com/sitemap.xml',
      evidence: 'self-reported',
      note: '',
    },
  ],
  counts: { pageChanges: 1, siteAdditions: 171, publicSignals: 0, releases: 0 },
  sources: { page: true, site: true, publicSignals: false, feeds: false, ads: 'manual' },
  caveats: [],
  checkedAt: report.checkedAt,
}

describe('buildGrowthBrief', () => {
  it('derives the period, sample and movement from the report', () => {
    const brief = buildGrowthBrief(report, growth)
    expect(brief.from).toBe('Dec 2024')
    expect(brief.to).toBe('Nov 2026')
    expect(brief.months).toBe(24)
    expect(brief.sampled).toBe(15)
    expect(brief.listed).toBe(392)
    expect(brief.percent).toBe(4)
    expect(brief.unsampled).toBe(377)
    expect(brief.headline).toEqual({
      before: 'Old promise.',
      after: 'New promise.',
      changed: true,
    })
    expect(brief.price).toEqual({
      before: '$10–$20/mo',
      after: '$20–$30/mo',
      changed: true,
    })
    expect(brief.counts.siteAdditions).toBe(171)
    expect(brief.counts.siteMonths).toBe(1)
  })

  it('does not invent a price range when one side has no monthly amount', () => {
    const unread = {
      ...report,
      captures: [
        capture('20241214215555', 'Old promise.', []),
        capture('20261118020945', 'New promise.', ['$30/mo']),
      ],
    }
    const brief = buildGrowthBrief(unread, growth)
    expect(brief.price).toBeNull()
  })

  it('labels a stable field as unchanged instead of a movement', () => {
    const stable = {
      ...report,
      captures: [
        capture('20241214215555', 'Same promise.', ['$10/mo']),
        capture('20261118020945', 'Same promise.', ['$10/mo']),
      ],
    }
    const brief = buildGrowthBrief(stable, growth)
    expect(brief.headline?.changed).toBe(false)
    expect(brief.price?.changed).toBe(false)
  })
})
