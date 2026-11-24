import { priceDelta } from '../../shared/compare'

const PRICE =
  /(?:US)?\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|year|yr|user|seat|member)(?:\s*\/\s*(?:mo|month|year|yr))?)?/gi

const tokens = (value: string): string[] => {
  const found = value.match(PRICE) ?? []
  return [...new Set(found.map((token) => token.trim().replace(/[.,;:]+$/, '')))]
}

/**
 * A price change is a set of exact strings, not a sentence. Show the removed
 * and added amounts as chips so a reader can see the move without parsing a
 * comma-separated wall of text.
 */
export function PriceDiff({
  before,
  after,
  heading = 'Price strings',
}: {
  before: string
  after: string
  heading?: string
}) {
  const beforePrices = tokens(before)
  const afterPrices = tokens(after)
  const delta = priceDelta(beforePrices, afterPrices)
  if (!delta.comparable || (delta.added.length === 0 && delta.removed.length === 0)) return null

  return (
    <div className="price-delta" aria-label={`${heading}: ${delta.removed.length} removed, ${delta.added.length} added`}>
      {delta.removed.length > 0 && (
        <div className="price-delta-row">
          <span className="price-delta-label">Removed strings</span>
          <span className="price-chips">
            {delta.removed.map((price) => (
              <span key={`removed-${price}`} className="price-chip is-removed">
                {price}
              </span>
            ))}
          </span>
        </div>
      )}
      {delta.added.length > 0 && (
        <div className="price-delta-row">
          <span className="price-delta-label">Added strings</span>
          <span className="price-chips">
            {delta.added.map((price) => (
              <span key={`added-${price}`} className="price-chip is-added">
                {price}
              </span>
            ))}
          </span>
        </div>
      )}
      <p className="price-delta-note">
        Exact archived strings, set against the previous capture. These are not a plan-to-plan
        mapping.
      </p>
      <details className="price-raw">
        <summary>View exact archived strings</summary>
        <p>
          {before || '—'} → {after || '—'}
        </p>
      </details>
    </div>
  )
}
