/**
 * Client-safe comparisons between two readable captures.
 *
 * Nothing here fetches or infers a date. It answers a narrower question: given
 * two archived snapshots the tool already read, which visible fields differ,
 * and where do the words differ?
 */

import type { Capture, ChangeField } from './timeline.js'

export type DiffPart = { text: string; kind: 'same' | 'removed' | 'added' }

const merge = (parts: DiffPart[], separator = ' '): DiffPart[] => {
  const out: DiffPart[] = []
  for (const part of parts) {
    if (!part.text) continue
    const last = out[out.length - 1]
    if (last && last.kind === part.kind) last.text = `${last.text}${separator}${part.text}`
    else out.push({ ...part })
  }
  // Deletions read before insertions at the same position: "the old" then
  // "the new", never an insertion followed by its replacement.
  for (let index = 0; index < out.length - 1; index += 1) {
    if (out[index].kind === 'added' && out[index + 1].kind === 'removed') {
      const swap = out[index]
      out[index] = out[index + 1]
      out[index + 1] = swap
    }
  }
  return out
}

/** Shared LCS walk for words and characters. */
const walkDiff = (a: string[], b: string[], separator: string): DiffPart[] => {
  if (a.length === 0 || b.length === 0) {
    return merge(
      [
        ...a.map((text) => ({ text, kind: 'removed' as const })),
        ...b.map((text) => ({ text, kind: 'added' as const })),
      ],
      separator,
    )
  }

  const table = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  )
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      table[i][j] =
        a[i - 1] === b[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1])
    }
  }

  const reversed: DiffPart[] = []
  let i = a.length
  let j = b.length
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      reversed.push({ text: a[i - 1], kind: 'same' })
      i -= 1
      j -= 1
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      reversed.push({ text: a[i - 1], kind: 'removed' })
      i -= 1
    } else {
      reversed.push({ text: b[j - 1], kind: 'added' })
      j -= 1
    }
  }
  while (i > 0) {
    reversed.push({ text: a[i - 1], kind: 'removed' })
    i -= 1
  }
  while (j > 0) {
    reversed.push({ text: b[j - 1], kind: 'added' })
    j -= 1
  }

  return merge(reversed.reverse(), separator)
}

/**
 * Word-level difference, computed with a longest-common-subsequence table.
 * Headlines are short (max 160 chars), so the quadratic table is bounded and
 * far easier to verify than a heuristic diff.
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ text: before, kind: 'same' }] : []
  return walkDiff(
    before.trim().split(/\s+/).filter(Boolean),
    after.trim().split(/\s+/).filter(Boolean),
    ' ',
  )
}

/**
 * Character-level difference for short, punctuation-shaped edits such as
 * `Basecamp: Pricing` → `Basecamp — Pricing`. A word diff cannot see the colon
 * and reads the whole first word as replaced.
 */
export function charDiff(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ text: before, kind: 'same' }] : []
  return walkDiff(Array.from(before), Array.from(after), '')
}

export type PriceDelta = {
  before: string[]
  after: string[]
  added: string[]
  removed: string[]
  /** False when either side has no prices: a gap, not a change. */
  comparable: boolean
}

const priceAmount = (price: string): number => {
  const amount = Number(price.replace(/[^0-9.]/g, ''))
  return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY
}

const sorted = (prices: string[]): string[] =>
  Array.from(new Set(prices)).sort((x, y) => priceAmount(x) - priceAmount(y) || x.localeCompare(y))

export function priceDelta(before: string[], after: string[]): PriceDelta {
  const b = sorted(before)
  const a = sorted(after)
  const removed = b.filter((price) => !a.includes(price))
  const added = a.filter((price) => !b.includes(price))
  return {
    before: b,
    after: a,
    added,
    removed,
    comparable: b.length > 0 && a.length > 0,
  }
}

export type CaptureComparison = {
  before: Capture
  after: Capture
  fields: ChangeField[]
  titleChanged: boolean
  headlineChanged: boolean
  price: PriceDelta
  changed: boolean
}

/** Compare two captures using the same rules as the timeline diff. */
export function compareCaptures(before: Capture, after: Capture): CaptureComparison {
  const titleChanged = Boolean(before.title && after.title && before.title !== after.title)
  const headlineChanged = Boolean(before.h1 && after.h1 && before.h1 !== after.h1)
  const price = priceDelta(before.prices, after.prices)
  const priceChanged = price.comparable && (price.added.length > 0 || price.removed.length > 0)

  const fields: ChangeField[] = []
  if (titleChanged) fields.push('title')
  if (headlineChanged) fields.push('headline')
  if (priceChanged) fields.push('price')

  return {
    before,
    after,
    fields,
    titleChanged,
    headlineChanged,
    price,
    changed: fields.length > 0,
  }
}

/**
 * Numeric monthly prices, for the price trail. Annual, one-time and per-seat
 * amounts are deliberately excluded: plotting them against a monthly amount
 * would invent a comparison the page never made.
 */
export function monthlyPrices(prices: string[]): number[] {
  const out: number[] = []
  for (const price of prices) {
    // Per-seat rates are still "/mo" strings; plotting them beside plan prices
    // would compare different units. The caption says they are excluded.
    if (
      /\bper\s+(?!(?:month|mo|year|yr|quarter|week|day|annum)\b)[a-z][a-z-]*|\/\s*(?:seat|user|member|admin|employee|agent|workspace)\b/i.test(
        price,
      )
    ) {
      continue
    }
    const match = /^\$\s*([\d,]+(?:\.\d+)?)\s*\/\s*(?:mo|month)\b/i.exec(price.trim())
    if (!match) continue
    const amount = Number(match[1].replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount < 1 || amount > 100_000) continue
    if (!out.includes(amount)) out.push(amount)
  }
  return out.sort((a, b) => a - b)
}
