/**
 * Chapters are a presentation layer over the merged events, not a new data
 * source. A chapter is one calendar month; its title describes the kinds of
 * signals present, never why they happened.
 */

import type { GrowthEvent } from './growth.js'

export type GrowthChapter = {
  /** `YYYY-MM`; stable for React keys and deep links. */
  id: string
  label: string
  events: GrowthEvent[]
  counts: { pageChanges: number; siteExpansions: number; publicSignals: number }
  /** A neutral description of the signal mix, e.g. "Pricing and site expansion". */
  title: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthLabel = (month: string): string => {
  const [year, value] = month.split('-').map(Number)
  return `${MONTHS[value - 1]} ${year}`
}

const chapterTitle = (counts: GrowthChapter['counts']): string => {
  const parts: string[] = []
  if (counts.pageChanges > 0) parts.push('Page changes')
  if (counts.siteExpansions > 0) parts.push('Site expansion')
  if (counts.publicSignals > 0) parts.push('Public signals')
  return parts.join(' and ')
}

/**
 * Group newest-first events into month chapters. The input order is preserved
 * inside a chapter, so dates and sources stay exactly as the timeline reported
 * them. Missing months are not invented.
 */
export function chapterize(events: GrowthEvent[]): GrowthChapter[] {
  const groups = new Map<string, GrowthEvent[]>()
  for (const event of events) {
    const month = event.date.slice(0, 7)
    const group = groups.get(month)
    if (group) group.push(event)
    else groups.set(month, [event])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([id, rows]) => {
      const counts = {
        pageChanges: rows.filter((event) => event.type === 'page change').length,
        siteExpansions: rows.filter((event) => event.type === 'site expansion').length,
        publicSignals: rows.filter((event) => event.type === 'public signal').length,
      }
      return {
        id,
        label: monthLabel(id),
        events: rows,
        counts,
        title: chapterTitle(counts),
      }
    })
}
