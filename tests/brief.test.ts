import { describe, expect, it } from 'vitest'
import type { Timeline, Capture } from '../shared/timeline'
import { marketingBrief } from '../shared/brief'

const capture = (ts: string, h1: string, prices: string[]): Capture => ({
  ts,
  label: ts.slice(0, 8),
  title: 'Pricing',
  h1,
  prices,
  url: `https://web.archive.org/web/${ts}/https://example.com`,
})
const a = capture('20250101000000', 'Earlier', ['$30/mo'])
const b = capture('20250301000000', 'Later', ['$20/mo', '$80/mo', '$400/year', '$5/user/mo'])
const report: Timeline = {
  domain: 'example.com',
  path: '/pricing',
  checkedAt: '2025-03-02T00:00:00Z',
  captures: [a, b],
  coverage: { from: a.ts, to: b.ts, sampled: 2, available: 10, months: 3, strategy: 'adaptive' },
  changes: [{ ...b, field: 'headline', before: a.h1, after: b.h1 }],
}

describe('marketing brief', () => {
  it('ties both wording observations to their own capture', () => {
    const r = marketingBrief(report).rows[0]
    expect(r.text).toBe('“Earlier” → “Later”')
    expect(r.sources.map((s) => s.url)).toEqual([a.url, b.url])
  })
  it('distinguishes no comparable change from a missing field', () => {
    expect(marketingBrief(report).rows[1].text).toContain('No comparable change')
    expect(marketingBrief({ ...report, captures: [{ ...b, title: '' }] }).rows[1].text).toContain(
      'No readable value',
    )
  })
  it('excludes other units and cites the latest capture alone', () => {
    const r = marketingBrief(report).rows[2]
    expect(r.text).toBe('$20–$80/mo · No earlier comparable range.')
    expect(r.sources).toEqual([b])
  })
  it('cites both range endpoints when two reads have a range', () => {
    const prior = { ...a, prices: ['$30/mo', '$40/mo'] }
    const row = marketingBrief({ ...report, captures: [prior, b] }).rows[2]
    expect(row.text).toBe('$30–$40/mo → $20–$80/mo')
    expect(row.sources).toEqual([prior, b])
  })
  it('does not carry an older monthly price across a gap', () => {
    expect(
      marketingBrief({ ...report, captures: [a, { ...b, prices: [] }] }).rows[2].text,
    ).toContain('No comparable monthly')
  })
  it('does not invent a range from one amount', () => {
    expect(marketingBrief({ ...report, captures: [a] }).rows[2].text).toContain(
      'One monthly amount',
    )
  })
  it('exports the target, checked time, coverage and linked dates', () => {
    const md = marketingBrief(report).markdown
    for (const text of ['example.com/pricing', report.checkedAt, '2 of 10', a.url, b.url, b.label])
      expect(md).toContain(text)
  })
})
