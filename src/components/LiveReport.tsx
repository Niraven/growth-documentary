import { ExternalLink, FileSearch, Loader2 } from 'lucide-react'
import type { Change as LiveChange, Capture as LiveCapture, Timeline as LiveData } from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export type { LiveCapture, LiveChange, LiveData }

const fieldLabel: Record<LiveChange['field'], string> = {
  title: 'Page title',
  headline: 'Headline',
  price: 'Price string',
  'first capture': 'First capture',
}

export function LiveLoading({ domain }: { domain: string }) {
  return (
    <Card className="mb-10" role="status" aria-live="polite">
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <div>
          <p className="text-[13px] font-medium">Reading the archive for {domain}</p>
          <p className="text-[12px] text-muted-foreground">
            Fetching up to 12 captures and comparing title, headline and price strings. About 15–30
            seconds.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function LiveReport({ data }: { data: LiveData }) {
  const first = data.captures[0]
  const last = data.captures[data.captures.length - 1]

  return (
    <section aria-labelledby="live" className="mb-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Live report · {new Date(data.checkedAt).toLocaleString()}
          </p>
          <h2 id="live" className="mt-2 font-display text-3xl tracking-[-0.02em]">
            {data.domain}
            <span className="text-muted-foreground">{data.path}</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{data.captures.length} captures</Badge>
          <Badge variant={data.changes.length > 1 ? 'good' : 'outline'}>
            {Math.max(0, data.changes.length - 1)} changes
          </Badge>
        </div>
      </div>

      {data.captures.length < 2 && (
        <p
          role="note"
          className="mb-4 rounded-xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground"
        >
          One readable capture for this page. There is nothing to compare it against, so no change
          can be claimed — only what the page said on that date.
        </p>
      )}
      {data.captures.length > 1 && data.changes.length <= 1 && (
        <p
          role="note"
          className="mb-4 rounded-xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground"
        >
          No comparable change in the fields this tool reads — page title, first headline or price
          strings — across the {data.captures.length} sampled captures.
        </p>
      )}

      <ol className="border-l border-border pl-6">
          {data.changes.map((change, index) => (
            <li key={`${change.ts}-${change.field}-${index}`} className="relative pb-7 last:pb-0">
              <span className="absolute -left-[31px] top-2 grid h-3 w-3 place-items-center rounded-full border border-foreground/25 bg-background">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
              </span>
              <div className="rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-card">
                <div className="flex flex-wrap items-center gap-2">
                  <time className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    {change.label}
                  </time>
                  <Badge variant="secondary">{fieldLabel[change.field]}</Badge>
                </div>
                {change.field === 'first capture' ? (
                  <p className="mt-2 text-[14px] leading-relaxed">
                    Page captured as <span className="font-medium">{change.after}</span>
                  </p>
                ) : (
                  <div className="mt-2 space-y-1 text-[13.5px] leading-relaxed">
                    <p className="text-muted-foreground line-through decoration-border">
                      {change.before || '—'}
                    </p>
                    <p className="font-medium">{change.after || '—'}</p>
                  </div>
                )}
                <a
                  href={change.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 py-2 text-[12px] font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  Open this capture
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <FileSearch className="size-4" />
          Extracted from archived HTML: page title, first H1, and price strings. Not a full visual
          diff.
        </div>
        {first && last && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {first.label} — {last.label}
          </span>
        )}
      </div>
    </section>
  )
}
