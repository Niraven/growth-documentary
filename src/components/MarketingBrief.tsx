import { marketingBrief } from '../../shared/brief'
import type { Timeline } from '../../shared/timeline'

export function MarketingBrief({ report }: { report: Timeline }) {
  const { rows, latest, takeaway, scope } = marketingBrief(report)
  return (
    <section id="brief" tabIndex={-1} className="receipt" aria-labelledby="brief-title">
      <header>
        <span className="metadata">Marketing brief</span>
        <h2 id="brief-title">What moved</h2>
        <p className="mt-3 max-w-prose leading-relaxed">{takeaway}</p>
      </header>
      <p className="brief-scope">
        {scope} The brief excludes annual, per-seat and one-time amounts; Compare quotes all
        archived price strings.
      </p>
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
      {latest && (
        <p className="brief-context">
          Latest readable capture:{' '}
          <a href={latest.url} target="_blank" rel="noreferrer">
            {latest.label} ↗
          </a>
        </p>
      )}
    </section>
  )
}
