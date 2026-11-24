import { useRef } from 'react'
import type { Capture, Change } from '../../shared/timeline'
import { buildChangeMatrix } from '../../shared/changeMatrix'

export function ChangeMatrix({ captures, changes }: { captures: Capture[]; changes: Change[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const scroll = (direction: number) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: direction * Math.max(54, el.clientWidth - 96) })
  }
  const matrix = buildChangeMatrix(captures, changes)
  return (
    <section data-testid="change-matrix" className="matrix">
      <h3 className="section-title">Field changes by month</h3>
      <p>
        {matrix.total} observations across {matrix.months.length} months
        {matrix.months.length > 0 &&
          ` · ${matrix.months[0].label} to ${matrix.months[matrix.months.length - 1].label}`}
        .
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          1 = one observed change in that field. A dash means no observed change, not an unchanged
          page.
        </p>
        <div className="matrix-controls">
          <button onClick={() => scroll(-1)} aria-label="Scroll to earlier months">
            ← Earlier
          </button>
          <button onClick={() => scroll(1)} aria-label="Scroll to later months">
            Later →
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="matrix-scroll"
        role="region"
        aria-label="Scrollable change matrix"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">Number of observed changes by field and month</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              {matrix.months.map((m) => (
                <th key={m.key} scope="col">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((r) => (
              <tr key={r.field}>
                <th scope="row">{r.label}</th>
                {r.counts.map((n, i) => (
                  <td key={matrix.months[i].key} data-read={n > 0}>
                    {n || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
