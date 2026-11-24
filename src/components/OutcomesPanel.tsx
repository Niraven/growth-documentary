import { useMemo, useState } from 'react'
import { FileUp, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { parseOutcomeCsv } from '../../shared/outcomes'

const SAMPLE = `date,metric,value
2026-09-01,signups,120
2026-10-01,signups,168
2026-11-01,signups,191`

export function OutcomesPanel() {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseOutcomeCsv(text), [text])

  const readFile = async (file: File | undefined) => {
    if (!file) return
    setText(await file.text())
  }

  return (
    <section id="outcomes" tabIndex={-1} aria-labelledby="outcomes-title" className="report-section">
      <details className="border-y border-border py-4">
        <summary className="cursor-pointer text-[13px] font-medium">
          Add first-party outcomes (CSV)
        </summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
          <div>
            <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
              Import <code className="font-mono text-[11px]">date,metric,value</code> from your own
              analytics, CRM or billing export. This is a local display only: nothing is uploaded,
              fetched, persisted or joined to the public timeline automatically. It does not prove
              cause.
            </p>
            <label htmlFor="outcomes-csv" className="mt-3 block text-[12px] font-medium">
              Paste CSV
            </label>
            <textarea
              id="outcomes-csv"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={SAMPLE}
              className="mt-1 w-full rounded-xl border border-border bg-card p-3 font-mono text-[11px] leading-relaxed outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-muted/30">
                <FileUp className="size-3.5" /> Choose CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => void readFile(event.target.files?.[0])}
                />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setText('')} disabled={!text}>
                Clear
              </Button>
              <Badge variant="outline">
                <ShieldCheck /> local only
              </Badge>
            </div>
          </div>
          <div aria-live="polite">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Parsed
            </p>
            {parsed.points.length === 0 ? (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                No valid rows yet. Keep the dates as YYYY-MM-DD.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[13px]">
                  <strong>{parsed.points.length}</strong> points ·{' '}
                  <strong>{parsed.metrics.length}</strong> metric
                  {parsed.metrics.length === 1 ? '' : 's'}
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-muted/30 font-mono uppercase tracking-[0.08em] text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5">date</th>
                        <th className="px-2 py-1.5">metric</th>
                        <th className="px-2 py-1.5 text-right">value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.points.slice(0, 8).map((point) => (
                        <tr key={`${point.date}-${point.metric}`} className="border-t border-border">
                          <td className="px-2 py-1.5 font-mono">{point.date}</td>
                          <td className="px-2 py-1.5">{point.metric}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{point.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.points.length > 8 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Showing 8 of {parsed.points.length} points.
                  </p>
                )}
              </>
            )}
            {parsed.errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {parsed.errors.slice(0, 5).map((error) => (
                  <li key={error}>· {error}</li>
                ))}
                {parsed.errors.length > 5 && <li>· and {parsed.errors.length - 5} more.</li>}
              </ul>
            )}
          </div>
        </div>
      </details>
    </section>
  )
}
