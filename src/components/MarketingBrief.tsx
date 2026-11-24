import { marketingBrief } from '../../shared/brief'
import type { Timeline } from '../../shared/timeline'

export function MarketingBrief({ report }: { report: Timeline }) {
  const { rows } = marketingBrief(report)
  return (
    <section id="brief" tabIndex={-1} className="receipt" aria-labelledby="brief-title">
      <header>
        <span className="metadata">Marketing brief</span>
        <h2 id="brief-title">What moved</h2>
        <p className="mt-2 text-sm">Wording changes and monthly amounts in the sampled captures.</p>
      </header>
      <dl>
        {rows.map((row) => (
          <div key={row.field} className="receipt-row">
            <dt>{row.field}</dt>
            <dd>
              {row.text}
              <small>
                {row.sources.map((source, i) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    {row.sources.length > 1 ? (i ? 'After · ' : 'Before · ') : 'Capture · '}
                    {source.label} ↗
                  </a>
                ))}
              </small>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
