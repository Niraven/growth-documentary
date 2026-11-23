import { describe, expect, it } from 'vitest'
import {
  compareSnapshot,
  isLiveCheck,
  isSavedListBody,
  isSavedReport,
  isSiteInfo,
  isTimeline,
} from '../shared/timeline'

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

describe('saved report guards', () => {
  const saved = {
    id: 'abc12345',
    savedAt: '2026-11-24T00:00:00.000Z',
    report: timeline,
  }

  it('accepts a saved report wrapping a valid timeline', () => {
    expect(isSavedReport(saved)).toBe(true)
  })

  it('rejects a malformed id or a broken report', () => {
    expect(isSavedReport({ ...saved, id: 'no spaces allowed' })).toBe(false)
    expect(isSavedReport({ ...saved, report: { ...timeline, changes: 'nope' } })).toBe(false)
  })

  it('accepts a saved list and rejects malformed summaries', () => {
    const summary = {
      id: 'abc12345',
      savedAt: '2026-11-24T00:00:00.000Z',
      domain: 'example.com',
      path: '/pricing',
      changes: 1,
      from: '20240101000000',
      to: '20250101000000',
    }
    expect(isSavedListBody({ reports: [summary] })).toBe(true)
    expect(isSavedListBody({ reports: [{ ...summary, changes: 'one' }] })).toBe(false)
  })
})

describe('isLiveCheck', () => {
  const live = {
    domain: 'example.com',
    path: '/pricing',
    fetchedAt: '2026-11-24T00:00:00.000Z',
    finalUrl: 'https://example.com/pricing',
    title: 'Pricing',
    h1: 'Simple',
    prices: ['$10/mo'],
    robots: 'allowed',
  }

  it('accepts a complete live check', () => {
    expect(isLiveCheck(live)).toBe(true)
  })

  it('rejects a live check that does not carry the robots verdict', () => {
    expect(isLiveCheck({ ...live, robots: undefined })).toBe(false)
  })
})

describe('compareSnapshot', () => {
  const before = { title: 'Pricing', h1: 'Simple', prices: ['$10/mo', '$20/mo'] }

  it('names each field that differs', () => {
    expect(
      compareSnapshot(before, { title: 'Plans', h1: 'Pick one', prices: ['$10/mo', '$30/mo'] }),
    ).toEqual(['title', 'headline', 'price'])
  })

  it('ignores a reorder-only price list', () => {
    expect(compareSnapshot(before, { ...before, prices: ['$20/mo', '$10/mo'] })).toEqual([])
  })

  it('treats an empty side as a gap, not a deletion', () => {
    expect(compareSnapshot(before, { ...before, prices: [] })).toEqual([])
    expect(compareSnapshot({ ...before, h1: '' }, before)).toEqual([])
  })
})
