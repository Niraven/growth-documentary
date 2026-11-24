/**
 * Coverage is a diagnostic, not a growth score.
 *
 * It answers a narrower question: did this run actually have enough independent
 * public evidence to support a narrative? A high count from one source is not
 * stronger than several source families.
 */

export type CoverageInput = {
  pageHistory: boolean
  siteMap: boolean
  publicSignals: boolean
  /** Optional lanes added in later slices. */
  feeds?: boolean
  jobs?: boolean
  siteGraph?: boolean
  /** Number of readable page captures sampled in the page-history lane. */
  sampled?: number
  /** Number of pages listed by the page-history index. */
  listed?: number
  /** Number of public roles seen in the current jobs snapshot. */
  openRoles?: number
  /** A user-supplied CSV outcome series, never fetched. */
  firstParty?: boolean
}

export type CoverageAssessment = {
  level: 'strong' | 'partial' | 'thin'
  sourceCount: number
  sources: {
    pageHistory: boolean
    siteMap: boolean
    publicSignals: boolean
    feeds: boolean
    jobs: boolean
    siteGraph: boolean
    firstParty: boolean
  }
  counts: { sampled: number; listed: number; openRoles: number }
  canNarrate: boolean
  caveats: string[]
}

/**
 * The gate is intentionally conservative. `strong` requires page history plus
 * at least two independent context lanes and a sampled history larger than one
 * accidental capture. It never implies that the public record is complete.
 */
export function assessCoverage(input: CoverageInput): CoverageAssessment {
  const sources = {
    pageHistory: input.pageHistory,
    siteMap: input.siteMap,
    publicSignals: input.publicSignals,
    feeds: input.feeds ?? false,
    jobs: input.jobs ?? false,
    siteGraph: input.siteGraph ?? false,
    firstParty: input.firstParty ?? false,
  }
  const sourceCount = Object.values(sources).filter(Boolean).length
  const sampled = input.sampled ?? 0
  const listed = input.listed ?? 0
  const openRoles = sources.jobs ? (input.openRoles ?? 0) : 0

  const contextLanes = [sources.siteMap, sources.publicSignals, sources.feeds, sources.jobs].filter(
    Boolean,
  ).length
  const level: CoverageAssessment['level'] =
    sources.pageHistory && sampled >= 8 && contextLanes >= 2
      ? 'strong'
      : sources.pageHistory
        ? 'partial'
        : 'thin'

  const caveats = [
    sources.pageHistory
      ? `${sampled} of ${listed} listed captures were sampled. Gaps are unread, not unchanged.`
      : 'No dated page history was read. The report cannot make a before/after claim.',
    sources.siteMap
      ? 'Sitemap entries are the site’s own `lastmod` claims; they are not traffic or quality.'
      : 'No archived sitemap was read; site expansion is absent, not zero.',
    sources.publicSignals
      ? 'Hacker News counts submitted links, not every discussion or a launch claim.'
      : 'Hacker News was unread or empty; that is not proof of zero public signals.',
    sources.feeds
      ? 'Feed entries are published by the site; a missing feed is unread, not a quiet period.'
      : 'No public feed was read; release cadence is unknown.',
    sources.jobs
      ? `The jobs lane is a current snapshot (${openRoles} open role${
          openRoles === 1 ? '' : 's'
        }), not historical hiring.`
      : 'No public jobs board was read; hiring history is unknown.',
    sources.firstParty
      ? 'First-party CSV metrics are user-supplied and local; they are not public evidence or causal proof.'
      : 'No first-party outcomes were supplied; this report cannot measure growth performance.',
    'No revenue, traffic, conversion, ROAS or causal claim is made.',
  ]

  return {
    level,
    sourceCount,
    sources,
    counts: { sampled, listed, openRoles },
    canNarrate: sources.pageHistory && sampled > 0,
    caveats,
  }
}
