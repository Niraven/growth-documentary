/**
 * The growth brief is a reading of the same report, not a second source.
 *
 * It answers four questions before the long evidence list:
 * what period was read, what moved, how complete the sample is, and what the
 * report cannot prove. Every value is derived from the report or the merged
 * growth timeline; nothing is inferred.
 */

import { monthlyPrices } from './compare.js'
import type { Capture, Timeline } from './timeline.js'
import type { GrowthTimeline } from './growth.js'

export type GrowthBrief = {
  from: string
  to: string
  months: number
  sampled: number
  listed: number
  percent: number
  unsampled: number
  headline: { before: string; after: string; changed: boolean } | null
  price: { before: string; after: string; changed: boolean } | null
  counts: {
    events: number
    pageChanges: number
    siteAdditions: number
    siteMonths: number
    publicSignals: number
    releases: number
  }
  lanes: {
    site: boolean
    publicSignals: boolean
    feeds: boolean
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthLabel = (ts: string): string => {
  const year = Number(ts.slice(0, 4))
  const month = Number(ts.slice(4, 6))
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return ts.slice(0, 10)
  return `${MONTHS[month - 1]} ${year}`
}

const money = (value: number): string =>
  Number.isInteger(value) ? `$${value.toLocaleString('en-US')}` : `$${value.toFixed(2)}`

const priceRange = (values: number[]): string | null => {
  if (values.length === 0) return null
  const min = values[0]!
  const max = values[values.length - 1]!
  return min === max ? `${money(min)}/mo` : `${money(min)}–${money(max)}/mo`
}

const byDate = (captures: Capture[]): Capture[] =>
  [...captures].sort((a, b) => a.ts.localeCompare(b.ts))

const firstLast = (captures: Capture[]): { first: Capture | null; last: Capture | null } => {
  const sorted = byDate(captures)
  return { first: sorted[0] ?? null, last: sorted[sorted.length - 1] ?? null }
}

export function buildGrowthBrief(report: Timeline, growth: GrowthTimeline): GrowthBrief {
  const { first, last } = firstLast(report.captures)
  const firstHeadline = first?.h1.trim() || ''
  const lastHeadline = last?.h1.trim() || ''
  const headline =
    firstHeadline && lastHeadline
      ? {
          before: firstHeadline,
          after: lastHeadline,
          changed: firstHeadline !== lastHeadline,
        }
      : null

  const firstRange = first ? priceRange(monthlyPrices(first.prices)) : null
  const lastRange = last ? priceRange(monthlyPrices(last.prices)) : null
  const price =
    firstRange && lastRange
      ? {
          before: firstRange,
          after: lastRange,
          changed: firstRange !== lastRange,
        }
      : null

  const listed = report.coverage.available
  const sampled = report.coverage.sampled
  const percent = listed > 0 ? Math.round((sampled / listed) * 100) : 0
  const siteMonths = growth.events.filter((event) => event.type === 'site expansion').length

  return {
    from: monthLabel(report.coverage.from),
    to: monthLabel(report.coverage.to),
    months: report.coverage.months,
    sampled,
    listed,
    percent,
    unsampled: Math.max(0, listed - sampled),
    headline,
    price,
    counts: {
      events: growth.events.length,
      pageChanges: growth.counts.pageChanges,
      siteAdditions: growth.counts.siteAdditions,
      siteMonths,
      publicSignals: growth.counts.publicSignals,
      releases: growth.counts.releases,
    },
    lanes: {
      site: growth.sources.site,
      publicSignals: growth.sources.publicSignals,
      feeds: growth.sources.feeds,
    },
  }
}
