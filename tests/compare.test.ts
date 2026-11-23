import { describe, expect, it } from 'vitest'
import {
  charDiff,
  compareCaptures,
  monthlyPrices,
  priceDelta,
  wordDiff,
} from '../shared/compare'
import type { Capture } from '../shared/timeline'

const capture = (overrides: Partial<Capture> = {}): Capture => ({
  ts: '20240101000000',
  label: '1 Jan 2024',
  title: 'Pricing',
  h1: 'Simple pricing',
  prices: ['$10/mo', '$20/mo'],
  url: 'https://web.archive.org/web/20240101000000/example.com/pricing',
  ...overrides,
})

describe('wordDiff', () => {
  it('marks a single replaced word and keeps the shared words', () => {
    const parts = wordDiff('Pick a plan', 'Pick the plan')
    expect(parts).toEqual([
      { text: 'Pick', kind: 'same' },
      { text: 'a', kind: 'removed' },
      { text: 'the', kind: 'added' },
      { text: 'plan', kind: 'same' },
    ])
  })

  it('handles an addition at the end without rewording the rest', () => {
    const parts = wordDiff('Simple pricing', 'Simple pricing for teams')
    expect(parts).toEqual([
      { text: 'Simple pricing', kind: 'same' },
      { text: 'for teams', kind: 'added' },
    ])
  })

  it('returns one unchanged part for identical text', () => {
    expect(wordDiff('Same', 'Same')).toEqual([{ text: 'Same', kind: 'same' }])
  })

  it('treats an empty side as all added or all removed', () => {
    expect(wordDiff('', 'New headline')).toEqual([{ text: 'New headline', kind: 'added' }])
    expect(wordDiff('Old headline', '')).toEqual([{ text: 'Old headline', kind: 'removed' }])
  })
})

describe('charDiff', () => {
  it('isolates a punctuation swap inside a title', () => {
    const parts = charDiff('Basecamp: Pricing', 'Basecamp — Pricing')
    expect(parts.some((part) => part.text === ':' && part.kind === 'removed')).toBe(true)
    expect(parts.some((part) => part.text.includes('—') && part.kind === 'added')).toBe(true)
    expect(parts.some((part) => part.text.includes('Basecamp') && part.kind === 'same')).toBe(true)
    expect(parts.some((part) => part.text.includes('Pricing') && part.kind === 'same')).toBe(true)
  })
})

describe('priceDelta', () => {
  it('reports additions and removals as sets, ignoring order', () => {
    const delta = priceDelta(['$20/mo', '$10/mo'], ['$10/mo', '$30/mo'])
    expect(delta.added).toEqual(['$30/mo'])
    expect(delta.removed).toEqual(['$20/mo'])
    expect(delta.comparable).toBe(true)
  })

  it('does not call an empty side a change', () => {
    const delta = priceDelta(['$10/mo'], [])
    expect(delta.comparable).toBe(false)
    expect(delta.added).toEqual([])
    expect(delta.removed).toEqual(['$10/mo'])
  })
})

describe('compareCaptures', () => {
  it('names every differing field', () => {
    const comparison = compareCaptures(
      capture(),
      capture({ title: 'Plans', h1: 'Pick one', prices: ['$10/mo', '$30/mo'] }),
    )
    expect(comparison.fields).toEqual(['title', 'headline', 'price'])
    expect(comparison.changed).toBe(true)
  })

  it('reports no change for an order-only price shuffle', () => {
    const comparison = compareCaptures(capture(), capture({ prices: ['$20/mo', '$10/mo'] }))
    expect(comparison.fields).toEqual([])
    expect(comparison.changed).toBe(false)
  })

  it('treats a missing headline as a gap', () => {
    const comparison = compareCaptures(capture(), capture({ h1: '' }))
    expect(comparison.headlineChanged).toBe(false)
  })
})

describe('monthlyPrices', () => {
  it('parses monthly amounts with commas and spacing', () => {
    expect(monthlyPrices(['$1,200 /mo', '$99 / month', '$49/mo'])).toEqual([49, 99, 1200])
  })

  it('excludes annual, one-time and malformed amounts', () => {
    expect(monthlyPrices(['$99/yr', '$50', 'Custom', '$0/mo'])).toEqual([])
  })

  it('excludes per-seat rates even when they carry a monthly suffix', () => {
    expect(
      monthlyPrices([
        '$15/mo per seat',
        '$8.75/user/mo',
        '$15/mo per admin',
        '$15/mo per employee',
        '$15/mo per agent',
        '$15/mo, per seat',
        '$15/mo per 2 seats',
        '$49/mo',
      ]),
    ).toEqual([49])
  })

  it('accepts a US$ prefix', () => {
    expect(monthlyPrices(['US$49/mo', 'US$15/mo per seat'])).toEqual([49])
  })

  it('dedupes repeated amounts', () => {
    expect(monthlyPrices(['$10/mo', '$10/mo'])).toEqual([10])
  })
})
