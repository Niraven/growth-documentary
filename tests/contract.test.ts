import { describe, expect, it } from 'vitest'
import { isSiteInfo, isTimeline } from '../shared/timeline'

const timeline = {
  domain: 'example.com',
  path: '/pricing',
  captures: [
    {
      ts: '20200101000000',
      label: '1 Jan 2020',
      title: 'Pricing',
      h1: 'Simple',
      prices: ['$10/mo'],
      url: 'https://web.archive.org/web/20200101000000/example.com/pricing',
    },
  ],
  changes: [
    {
      ts: '20200101000000',
      label: '1 Jan 2020',
      field: 'first capture',
      before: '',
      after: 'Pricing',
      url: 'https://web.archive.org/web/20200101000000/example.com/pricing',
    },
  ],
  coverage: {
    from: '20200101000000',
    to: '20200101000000',
    months: 1,
    sampled: 1,
    available: 1,
    strategy: 'adaptive',
  },
  checkedAt: '2026-11-24T00:00:00.000Z',
}

describe('isTimeline', () => {
  it('accepts a report with coverage', () => {
    expect(isTimeline(timeline)).toBe(true)
  })

  it('rejects a report without coverage, so old payloads cannot slip through', () => {
    const { coverage: _coverage, ...withoutCoverage } = timeline
    expect(isTimeline(withoutCoverage)).toBe(false)
  })

  it('rejects an unknown change field', () => {
    expect(
      isTimeline({
        ...timeline,
        changes: [{ ...timeline.changes[0], field: 'vibes' }],
      }),
    ).toBe(false)
  })
})

describe('isSiteInfo', () => {
  const site = {
    domain: 'example.com',
    sitemapUrl: 'https://example.com/sitemap.xml',
    archivedAt: '2024-06-01',
    pages: 120,
    dated: 80,
    months: [{ month: '2024-05', added: 12 }],
    children: 0,
    note: 'Archived sitemap captured 2024-06-01.',
  }

  it('accepts a complete sitemap report', () => {
    expect(isSiteInfo(site)).toBe(true)
  })

  it('accepts the empty case with a null sitemap', () => {
    expect(isSiteInfo({ ...site, sitemapUrl: null, archivedAt: null, pages: 0, months: [] })).toBe(
      true,
    )
  })

  it('rejects malformed months', () => {
    expect(isSiteInfo({ ...site, months: [{ month: '2024-05' }] })).toBe(false)
  })
})
