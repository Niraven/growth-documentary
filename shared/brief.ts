import type { Capture, Timeline } from './timeline.js'
import { monthlyPrices } from './compare.js'

type Source = Pick<Capture, 'label' | 'url'>
type Observation = { field: string; text: string; sources: Source[] }

/** Only comparable change rows may establish a wording change. A price range
 * belongs to one capture, not to a composite or an inferred product tier. */
export function marketingBrief(report: Timeline) {
  const newest = [...report.captures].reverse()
  const latest = newest[0]
  const rows: Observation[] = (['headline', 'title'] as const).map((field) => {
    const name = field === 'title' ? 'Page title' : 'Headline'
    const key = field === 'title' ? 'title' : 'h1'
    const change = [...report.changes].reverse().find((c) => c.field === field)
    if (change) {
      const prior = newest.find((c) => c.ts < change.ts && c[key] === change.before)
      return {
        field: name,
        text: `“${change.before}” → “${change.after}”`,
        sources: prior ? [prior, change] : [change],
      }
    }
    const observed = newest.find((c) => c[key])
    return {
      field: name,
      text: observed
        ? `“${observed[key]}” · No comparable change observed.`
        : 'No readable value in the sample.',
      sources: observed ? [observed] : latest ? [latest] : [],
    }
  })
  const amounts = latest ? monthlyPrices(latest.prices) : []
  const price =
    amounts.length > 1
      ? `$${amounts[0]}–$${amounts[amounts.length - 1]}/mo`
      : amounts.length
        ? `$${amounts[0]}/mo · One monthly amount, not a range.`
        : 'No comparable monthly amounts in the latest capture.'
  const firstRange = report.captures.find(
    (c) => c.ts !== latest?.ts && monthlyPrices(c.prices).length > 1,
  )
  const endpoints = firstRange ? monthlyPrices(firstRange.prices) : []
  const compareRange = firstRange && amounts.length > 1
  const rangeText = compareRange
    ? endpoints[0] === amounts[0] && endpoints[endpoints.length - 1] === amounts[amounts.length - 1]
      ? `${price} · Same endpoints in these two captures.`
      : `$${endpoints[0]}–$${endpoints[endpoints.length - 1]}/mo → ${price}`
    : amounts.length > 1
      ? `${price} · No earlier comparable range.`
      : price
  rows.push({
    field: 'Monthly prices',
    text: rangeText,
    sources: compareRange ? [firstRange, latest] : latest ? [latest] : [],
  })
  const headline = [...report.changes].reverse().find((c) => c.field === 'headline')
  const takeaway = [
    headline
      ? `The headline changed to “${headline.after}” in the ${headline.label} capture.`
      : 'No comparable headline change was observed.',
    compareRange
      ? `Monthly amounts in the sampled captures ranged from $${endpoints[0]}–$${endpoints[endpoints.length - 1]}/mo in the earlier read and ${price} in the latest. These are not matched plans.`
      : `Monthly amounts in the latest sampled capture: ${rangeText}`,
  ].join(' ')
  const scope =
    'Each row cites its own dates. Wording rows show the latest change in that field; prices compare monthly-only amounts across the first comparable range and the latest capture. Compare uses one pair for every field.'
  const coverage = `${report.coverage.sampled} of ${report.coverage.available} listed captures read · ${report.coverage.months} months`
  const markdown = [
    `# ${report.domain}${report.path}`,
    `Checked: ${report.checkedAt}`,
    `Coverage: ${coverage}`,
    '',
    takeaway,
    scope,
    latest
      ? `Latest readable capture: [${latest.label}](<${latest.url}>)`
      : 'No readable captures.',
    '',
    ...rows.map(
      (r) =>
        `- ${r.field}: ${r.text} ${r.sources.map((s) => `[${s.label}](<${s.url}>)`).join(' · ')}`,
    ),
    '',
    'Archive observations only. Gaps are unread.',
  ].join('\n')
  return { rows, coverage, markdown, latest, scope, takeaway }
}
