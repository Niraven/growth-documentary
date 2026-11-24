import type { Capture, Change, Timeline } from './timeline.js'
import { marketingBrief } from './brief.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const fieldLabel: Record<Change['field'], string> = {
  title: 'Page title',
  headline: 'Headline',
  price: 'Price strings',
  'first capture': 'Opening record',
}

const monthLabel = (ts: string): string =>
  `${MONTHS[Number(ts.slice(4, 6)) - 1]} ${ts.slice(0, 4)}`

const priceAmount = (price: string): number => {
  const match = /^(?:US)?\$\s*([\d,]+(?:\.\d+)?)/i.exec(price.trim())
  return match ? Number(match[1].replace(/,/g, '')) : Number.POSITIVE_INFINITY
}

const sortPrices = (prices: string[]): string[] =>
  Array.from(new Set(prices)).sort((a, b) => priceAmount(a) - priceAmount(b) || a.localeCompare(b))

const periodLabel = (first: string, last: string): string => {
  const firstMonth = monthLabel(first)
  const lastMonth = monthLabel(last)
  return firstMonth === lastMonth ? firstMonth : `${firstMonth} — ${lastMonth}`
}

const captureValue = (capture: Capture, field: Change['field']): string => {
  if (field === 'title') return capture.title
  if (field === 'headline') return capture.h1
  if (field === 'price') return sortPrices(capture.prices).join(', ')
  return capture.title || capture.h1 || 'Page captured'
}

const openingText = (capture: Capture | null): string => {
  if (!capture) return 'No readable capture.'
  const parts = [capture.title, capture.h1].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'No title or headline was readable.'
}

const closingText = (capture: Capture | null): string => {
  if (!capture) return 'No readable capture.'
  const parts = [capture.title, capture.h1].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'No title or headline was readable.'
}

export type DocumentaryScene = {
  change: Change
  before: Capture | null
  after: Capture | null
}

export type DocumentaryChapter = {
  year: string
  period: string
  scenes: DocumentaryScene[]
}

/** A page-level documentary: the public offer record, not a performance claim. */
export type GrowthDocumentary = {
  title: string
  headline: string
  domain: string
  path: string
  period: string
  coverage: string
  lede: string
  takeaway: string
  scope: string
  opening: Capture | null
  closing: Capture | null
  chapters: DocumentaryChapter[]
  markdown: string
  note: string
}

/** Build the ordered story from the same captures and change rows as the report. */
export function growthDocumentary(report: Timeline): GrowthDocumentary {
  const captures = [...report.captures].sort((a, b) => a.ts.localeCompare(b.ts))
  const opening = captures[0] ?? null
  const closing = captures[captures.length - 1] ?? null
  const brief = marketingBrief(report)
  const changes = report.changes.filter((change) => change.field !== 'first capture')

  const scenes: DocumentaryScene[] = changes.map((change) => {
    const after = captures.find((capture) => capture.ts === change.ts) ?? null
    const before =
      [...captures]
        .reverse()
        .find(
          (capture) =>
            capture.ts < change.ts && captureValue(capture, change.field) === change.before,
        ) ?? null
    return { change, before, after }
  })

  const chapterMap = new Map<string, DocumentaryChapter>()
  for (const scene of scenes) {
    const year = scene.change.ts.slice(0, 4)
    let chapter = chapterMap.get(year)
    if (!chapter) {
      chapter = { year, period: monthLabel(scene.change.ts), scenes: [] }
      chapterMap.set(year, chapter)
    }
    chapter.scenes.push(scene)
  }
  const chapters = Array.from(chapterMap.values()).map((chapter) => ({
    ...chapter,
    period: periodLabel(chapter.scenes[0].change.ts, chapter.scenes[chapter.scenes.length - 1].change.ts),
  }))

  const title = `${report.domain}${report.path}`
  const brand = report.domain
    .replace(/^www\./i, '')
    .split('.')[0]
    .replace(/[-_]/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
  const headline = `${brand} — the public offer story`
  const period = opening && closing ? periodLabel(opening.ts, closing.ts) : 'No readable period'
  const lede =
    opening && closing
      ? `Across ${brief.coverage}, the page opened with the verbatim line “${
          opening.h1 || opening.title || 'no readable headline'
        }” and closed with “${closing.h1 || closing.title || 'no readable headline'}”. ${
          changes.length
        } observed field change${changes.length === 1 ? '' : 's'} were recorded in the sample.`
      : 'No readable opening and closing record in the sample.'
  const note =
    'This is a dated record of one public offer surface. It shows what the archive was able to read, not traffic, revenue, conversion, or why a change happened.'
  const chapterMarkdown = chapters.flatMap((chapter) => [
    `### ${chapter.period}`,
    ...chapter.scenes.map((scene) => {
      const sources = [
        scene.before ? `[before](<${scene.before.url}>)` : '',
        scene.after ? `[after](<${scene.after.url}>)` : '',
      ].filter(Boolean)
      return `- **${scene.change.label} · ${fieldLabel[scene.change.field]}**: ${scene.change.before || '—'} → ${scene.change.after || '—'}${sources.length ? ` (${sources.join(' · ')})` : ''}`
    }),
  ])
  const markdown = [
    `# ${title} — a public growth documentary`,
    `Period: ${period}`,
    `Coverage: ${brief.coverage}`,
    `Checked: ${report.checkedAt}`,
    '',
    brief.takeaway,
    brief.scope,
    '',
    lede,
    '',
    `## Opening record · ${opening?.label ?? 'unreadable'}`,
    openingText(opening),
    opening?.url ? `[Open capture](<${opening.url}>)` : '',
    '',
    '## Chapters',
    ...(chapterMarkdown.length > 0
      ? chapterMarkdown
      : ['- No comparable field change was observed in the sampled captures.']),
    '',
    `## Closing record · ${closing?.label ?? 'unreadable'}`,
    closingText(closing),
    closing?.url ? `[Open capture](<${closing.url}>)` : '',
    '',
    '## What this record cannot prove',
    note,
    'Gaps are unread, not unchanged. The site footprint and public-attention lanes are separate views in the app.',
    '',
  ].join('\n')

  return {
    title,
    headline,
    domain: report.domain,
    path: report.path,
    period,
    coverage: brief.coverage,
    lede,
    takeaway: brief.takeaway,
    scope: brief.scope,
    opening,
    closing,
    chapters,
    markdown,
    note,
  }
}
