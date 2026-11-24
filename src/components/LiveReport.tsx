import { Suspense, lazy, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import type {
  Change as LiveChange,
  Capture as LiveCapture,
  Timeline as LiveData,
} from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CoverageStrip } from '@/components/CoverageStrip'
import { ChangeMatrix } from '@/components/ChangeMatrix'
import { PriceDiff } from '@/components/PriceDiff'

const PriceTrail = lazy(() =>
  import('@/components/PriceTrail').then((module) => ({ default: module.PriceTrail })),
)
const SourcesBoard = lazy(() =>
  import('@/components/SourcesBoard').then((module) => ({ default: module.SourcesBoard })),
)

export type { LiveCapture, LiveChange, LiveData }

const fieldLabel: Record<LiveChange['field'], string> = {
  title: 'Page title',
  headline: 'Headline',
  price: 'Price string',
  'first capture': 'Baseline',
}

export function LiveLoading({ domain }: { domain: string }) {
  return (
    <Card className="mb-10" role="status" aria-live="polite">
      <CardContent className="flex items-start gap-3 py-6">
        <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" />
        <div>
          <p className="text-[13px] font-medium">Reading the archive for {domain}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Spreading up to 24 captures across the last two years, then reading closer where the
            page changed. This takes 20–40 seconds.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

type Day = { ts: string; label: string; items: LiveChange[] }
type Group = { year: string; days: Day[] }

/** Group by year, then by capture date: a headline and price change on the same
 *  day are one event with two observations, not two separate events. */
const groupChanges = (changes: LiveChange[]): Group[] => {
  const groups: Group[] = []
  for (const change of changes) {
    const year = change.ts.slice(0, 4)
    let group = groups[groups.length - 1]
    if (!group || group.year !== year) {
      group = { year, days: [] }
      groups.push(group)
    }
    let day = group.days[group.days.length - 1]
    if (!day || day.ts !== change.ts) {
      day = { ts: change.ts, label: change.label, items: [] }
      group.days.push(day)
    }
    day.items.push(change)
  }
  return groups
}

function ChangeRow({ change }: { change: LiveChange }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{fieldLabel[change.field]}</Badge>
        <a
          href={change.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex min-h-11 items-center gap-1 text-[12px] font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
        >
          Open capture
          <ExternalLink className="size-3" />
        </a>
      </div>
      {change.field === 'first capture' ? (
        <p className="mt-1.5 text-[14px] leading-relaxed">
          Page read as <span className="font-medium">{change.after}</span> on this date. This is the
          starting point, not a change.
        </p>
      ) : (
        <div className="mt-2 space-y-1 text-[13.5px] leading-relaxed">
          {change.field === 'price' ? (
            <PriceDiff before={change.before} after={change.after} />
          ) : (
            <>
              <div className="flex gap-3">
                <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Before
                </span>
                <span className="text-muted-foreground line-through decoration-border">
                  {change.before || '—'}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  After
                </span>
                <span className="font-medium">{change.after || '—'}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function LiveReport({ data }: { data: LiveData }) {
  const changeCount = Math.max(0, data.changes.length - 1)
  const [field, setField] = useState('all')
  const groups = groupChanges(
    [...data.changes].reverse().filter((row) => field === 'all' || row.field === field),
  )
  return (
    <section
      id="evidence"
      tabIndex={-1}
      aria-labelledby="evidence-title"
      className="report-section"
    >
      <h2 id="evidence-title">Archive evidence</h2>
      <div className="mt-4 border-y border-border py-4">
        <h3>When the page was read</h3>
        <div className="mt-3">
          <CoverageStrip captures={data.captures} changes={data.changes} />
        </div>
        <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          Captures are sampled from up to 400 index entries. Gaps are unread, not unchanged.
        </p>
      </div>
      <Suspense fallback={null}>
        <PriceTrail captures={data.captures} changes={data.changes} />
      </Suspense>

      <div className="mt-4">
        <ChangeMatrix captures={data.captures} changes={data.changes} />
      </div>

      <Suspense fallback={null}>
        <SourcesBoard key={`${data.domain}${data.path}`} timeline={data} />
      </Suspense>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <h2 id="changes" tabIndex={-1}>
          Dated changes
        </h2>
        <label className="flex items-center gap-3 text-sm">
          Show field
          <select
            className="min-h-11 rounded-lg border bg-card px-3"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="all">All fields</option>
            <option value="headline">Headline</option>
            <option value="price">Price strings</option>
            <option value="title">Page title</option>
          </select>
        </label>
      </div>
      {field !== 'all' && groups.length === 0 && <p>No comparable change in this field.</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {changeCount === 0 && (
            <p
              role="note"
              className="mb-5 rounded-xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground"
            >
              {data.captures.length < 2
                ? 'One readable capture for this page. There is nothing to compare it against, so no change can be claimed — only what the page said on that date.'
                : `No comparable change in the fields this tool reads — page title, first headline or price strings — across the ${data.captures.length} sampled captures.`}
            </p>
          )}

          {groups.map((group) => (
            <section
              key={group.year}
              aria-label={`Changes in ${group.year}`}
              className="mb-6 last:mb-0"
            >
              <div className="mb-1 flex items-center gap-3">
                <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                  {group.year}
                </h3>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ol className="divide-y divide-border/70">
                {group.days.map((day) => (
                  <li
                    key={day.ts}
                    className="grid gap-2 py-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4"
                  >
                    <time className="pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                      {day.label}
                    </time>
                    <div className="space-y-3">
                      {day.items.map((change) => (
                        <ChangeRow key={`${change.ts}-${change.field}`} change={change} />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                What this cannot prove
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
              <p>· Why a change happened, or whether it worked.</p>
              <p>· Revenue, traffic or conversion — nothing is estimated.</p>
              <p>· The exact day: only that the page differed by the next capture.</p>
              <p>· What was shown to other regions, plans or logged-in users.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  )
}
