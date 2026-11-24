import { describe, expect, it } from 'vitest'
import { chapterize } from '../shared/chapters'
import { assessCoverage } from '../shared/coverage'
import { parseOutcomeCsv } from '../shared/outcomes'
import type { GrowthEvent } from '../shared/growth'

const event = (
  id: string,
  date: string,
  type: GrowthEvent['type'],
  title: string,
): GrowthEvent => ({
  id,
  date,
  label: date,
  type,
  title,
  detail: 'detail',
  source:
    type === 'page change'
      ? 'Internet Archive'
      : type === 'site expansion'
        ? 'Archived sitemap'
        : 'Hacker News',
  sourceUrl: 'https://example.com/source',
  evidence:
    type === 'page change' ? 'dated capture' : type === 'site expansion' ? 'self-reported' : 'public post',
  note: 'note',
})

describe('growth chapters', () => {
  it('groups newest-first events by calendar month without inventing months', () => {
    const chapters = chapterize([
      event('a', '2026-10-24', 'page change', 'Price changed'),
      event('b', '2026-10-02', 'public signal', 'A public post'),
      event('c', '2026-08-01', 'site expansion', 'Site grew'),
    ])
    expect(chapters.map((chapter) => chapter.id)).toEqual(['2026-10', '2026-08'])
    expect(chapters[0].counts).toEqual({ pageChanges: 1, siteExpansions: 0, publicSignals: 1 })
    expect(chapters[0].title).toBe('Page changes and Public signals')
    expect(chapters[0].events.map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('returns no chapters for an empty timeline', () => {
    expect(chapterize([])).toEqual([])
  })
})

describe('coverage gate', () => {
  it('is thin without page history', () => {
    const coverage = assessCoverage({
      pageHistory: false,
      siteMap: true,
      publicSignals: true,
      sampled: 0,
      listed: 10,
    })
    expect(coverage.level).toBe('thin')
    expect(coverage.canNarrate).toBe(false)
    expect(coverage.caveats.join(' ')).toContain('No dated page history')
  })

  it('is partial with one page-history lane', () => {
    const coverage = assessCoverage({
      pageHistory: true,
      siteMap: false,
      publicSignals: false,
      sampled: 17,
      listed: 392,
    })
    expect(coverage.level).toBe('partial')
    expect(coverage.sourceCount).toBe(1)
    expect(coverage.canNarrate).toBe(true)
  })

  it('is strong only with a meaningful sample and two context lanes', () => {
    const coverage = assessCoverage({
      pageHistory: true,
      siteMap: true,
      publicSignals: true,
      sampled: 17,
      listed: 392,
      openRoles: 12,
    })
    expect(coverage.level).toBe('strong')
    expect(coverage.sources.siteMap).toBe(true)
    expect(coverage.counts.openRoles).toBe(0)
    expect(coverage.caveats.join(' ')).toContain('17 of 392')
  })

  it('does not call a first-party CSV public evidence', () => {
    const coverage = assessCoverage({
      pageHistory: true,
      siteMap: false,
      publicSignals: false,
      sampled: 2,
      listed: 2,
      firstParty: true,
    })
    expect(coverage.level).toBe('partial')
    expect(coverage.caveats.join(' ')).toContain('user-supplied and local')
  })
})

describe('first-party outcomes', () => {
  it('parses and sorts date, metric, value rows', () => {
    const result = parseOutcomeCsv(
      'date,metric,value\n2026-01-02, signups ,12\n2026-01-01,signups,10\n2026-01-01,revenue,99.5',
    )
    expect(result.errors).toEqual([])
    expect(result.metrics).toEqual(['revenue', 'signups'])
    expect(result.points.map((point) => `${point.date}:${point.metric}:${point.value}`)).toEqual([
      '2026-01-01:revenue:99.5',
      '2026-01-01:signups:10',
      '2026-01-02:signups:12',
    ])
  })

  it('rejects malformed rows and reports the exact line', () => {
    const result = parseOutcomeCsv('date,metric,value\n01/02/2026,signups,12\n2026-01-02,,12\n2026-01-02,signups,nope')
    expect(result.points).toEqual([])
    expect(result.errors).toHaveLength(3)
    expect(result.errors[0]).toContain('Line 2')
  })

  it('keeps the first duplicate and reports the later one', () => {
    const result = parseOutcomeCsv('date,metric,value\n2026-01-01,signups,10\n2026-01-01,signups,20')
    expect(result.points).toHaveLength(1)
    expect(result.errors[0]).toContain('duplicate')
  })
})
