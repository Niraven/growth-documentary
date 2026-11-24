import { describe, expect, it } from 'vitest'
import type { Capture, Change, Timeline } from '../shared/timeline'
import { growthDocumentary } from '../shared/documentary'

const capture = (ts: string, h1: string, prices: string[], title = 'Pricing'): Capture => ({
  ts,
  label: `${ts.slice(6, 8)} ${ts.slice(4, 6)} ${ts.slice(0, 4)}`,
  title,
  h1,
  prices,
  url: `https://web.archive.org/web/${ts}/https://example.com/pricing`,
})

const a = capture('20250101000000', 'Earlier', ['$30/mo'])
const b = capture('20250601000000', 'Middle', ['$30/mo', '$50/mo'])
const c = capture('20260101000000', 'Later', ['$50/mo'])

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
  captures: [a, b, c],
  coverage: { from: a.ts, to: c.ts, sampled: 3, available: 20, months: 13, strategy: 'adaptive' },
  changes: [
    {
      ts: a.ts,
      label: a.label,
      field: 'first capture',
      before: '',
      after: a.title,
      url: a.url,
    },
    change(b, 'headline', a.h1, b.h1),
    change(c, 'price', b.prices.join(', '), c.prices.join(', ')),
  ],
}

describe('growth documentary', () => {
  it('opens and closes on named, linked captures', () => {
    const story = growthDocumentary(report)
    expect(story.title).toBe('example.com/pricing')
    expect(story.headline).toBe('Example — the public offer story')
    expect(story.lede).toContain('verbatim line “Earlier”')
    expect(story.lede).toContain('closed with “Later”');
    expect(story.opening?.ts).toBe(a.ts)
    expect(story.closing?.ts).toBe(c.ts)
    expect(story.period).toBe('Jan 2025 — Jan 2026')
    expect(story.markdown).toContain(a.url)
    expect(story.markdown).toContain(c.url)
  })

  it('groups only real changes into chronological chapters', () => {
    const story = growthDocumentary(report)
    expect(story.chapters.map((chapter) => chapter.year)).toEqual(['2025', '2026'])
    expect(story.chapters[0].scenes.map((scene) => scene.change.field)).toEqual(['headline'])
    expect(story.chapters[1].scenes.map((scene) => scene.change.field)).toEqual(['price'])
    expect(story.markdown).not.toContain('Opening record: Baseline')
  })

  it('ties a scene to the exact before and after captures when the value matches', () => {
    const scene = growthDocumentary(report).chapters[0].scenes[0]
    expect(scene.before?.url).toBe(a.url)
    expect(scene.after?.url).toBe(b.url)
    expect(growthDocumentary(report).markdown).toContain('Earlier → Middle')
  })

  it('ties a price scene to the exact before and after captures', () => {
    const scene = growthDocumentary(report).chapters[1].scenes[0]
    expect(scene.before?.url).toBe(b.url)
    expect(scene.after?.url).toBe(c.url)
    expect(growthDocumentary(report).markdown).toContain('$30/mo, $50/mo → $50/mo')
  })

  it('does not invent a chapter when the page never changed', () => {
    const story = growthDocumentary({ ...report, changes: [report.changes[0]] })
    expect(story.chapters).toEqual([])
    expect(story.markdown).toContain('No comparable field change')
  })

  it('keeps one readable capture as an opening and closing record, not a change', () => {
    const story = growthDocumentary({
      ...report,
      captures: [a],
      coverage: { ...report.coverage, to: a.ts, months: 1, sampled: 1 },
      changes: [report.changes[0]],
    })
    expect(story.opening?.ts).toBe(a.ts)
    expect(story.closing?.ts).toBe(a.ts)
    expect(story.chapters).toEqual([])
  })

  it('exports the same factual takeaway, coverage and linked dates as Markdown', () => {
    const story = growthDocumentary(report)
    for (const part of [
      'a public growth documentary',
      'Jan 2025 — Jan 2026',
      '3 of 20',
      'Earlier',
      'Middle',
      'a[href]',
    ]) {
      if (part === 'a[href]') continue
      expect(story.markdown).toContain(part)
    }
    expect(story.markdown).toContain(story.takeaway)
    expect(story.markdown).toContain(story.note)
  })

  it('states the limit instead of claiming traffic, revenue or causality', () => {
    const markdown = growthDocumentary(report).markdown
    expect(markdown).toContain('not traffic, revenue, conversion, or why a change happened')
    expect(markdown).not.toMatch(/increased|decreased|drove|converted/i)
  })
})
