import type { Capture, Change } from '../../shared/timeline'
import { buildChangeMatrix } from '../../shared/changeMatrix'

export function ChangeMatrix({ captures, changes }: { captures: Capture[]; changes: Change[] }) {
  const matrix = buildChangeMatrix(captures, changes)
  return (
    <section data-testid="change-matrix" className="matrix">
      <h3 className="section-title">Field changes by month</h3>
      <p>Scroll across the months → A dash means no observed change, not an unchanged page.</p>
      <div
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
