import { useEffect, useState } from 'react'
import type * as React from 'react'
import {
  Archive,
  ArrowUpRight,
  CircleAlert,
  ExternalLink,
  Globe2,
  Loader2,
  Megaphone,
  MessagesSquare,
} from 'lucide-react'
import type { Timeline } from '../../shared/timeline'
import { isErrorBody } from '../../shared/timeline'
import { isSourcesReport, type SourceStatus, type SourcesReport } from '../../shared/sources'
import { Badge } from '@/components/ui/badge'
import { adLibraryLinks } from '@/lib/adLinks'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const shortMonth = (key: string): string => {
  const [year, month] = key.split('-').map(Number)
  return `${MONTHS[month - 1]} ${String(year).slice(2)}`
}

const lastMonths = (count: number): string[] => {
  const today = new Date()
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end)
    date.setUTCMonth(date.getUTCMonth() - (count - 1 - index))
    return monthKey(date)
  })
}

const statusCopy: Record<SourceStatus, { label: string; variant: 'good' | 'outline' | 'warn' }> = {
  read: { label: 'read', variant: 'good' },
  empty: { label: 'no rows', variant: 'outline' },
  unavailable: { label: 'unread', variant: 'warn' },
}

const pendingStatus: { label: string; variant: 'good' | 'outline' | 'warn' } = {
  label: 'reading',
  variant: 'outline',
}

function Lane({
  icon,
  title,
  status,
  children,
  footer,
}: {
  icon: React.ReactNode
  title: string
  status: { label: string; variant: 'good' | 'outline' | 'warn' }
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <h4 className="font-mono text-[10px] uppercase tracking-[0.16em]">{title}</h4>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <div className="mt-3 flex-1">{children}</div>
      {footer ? <div className="mt-3 border-t border-border/70 pt-2">{footer}</div> : null}
    </article>
  )
}

function NumberLine({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[30px] leading-none tracking-[-0.02em]">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{label}</p>
    </div>
  )
}

/** Public-source lanes. The timeline stays the only source of dated page changes. */
export function SourcesBoard({ timeline }: { timeline: Timeline }) {
  const [sources, setSources] = useState<SourcesReport | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(`/api/sources?url=${encodeURIComponent(`${timeline.domain}${timeline.path}`)}`, {
          signal: controller.signal,
        })
        const payload: unknown = await response.json()
        if (!response.ok) throw new Error(isErrorBody(payload) ? payload.error : 'Public-source check failed')
        if (!isSourcesReport(payload)) throw new Error('Unexpected public-source report')
        setSources(payload)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setFailed(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [timeline.domain, timeline.path])

  const mentions = sources?.mentions
  const archives = sources?.archives
  const mentionMonths = lastMonths(25)
  const counts = new Map(mentions?.months.map((month) => [month.month, month.count]) ?? [])
  const peak = Math.max(1, ...mentionMonths.map((month) => counts.get(month) ?? 0))
  const adLinks = adLibraryLinks(timeline.domain)

  return (
    <section aria-labelledby="sources-heading" data-testid="sources-board" className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Beyond the page
          </p>
          <h3 id="sources-heading" className="mt-1 font-display text-2xl tracking-[-0.02em]">
            Evidence lanes
          </h3>
        </div>
        <p className="max-w-md text-right text-[11px] leading-relaxed text-muted-foreground">
          Each lane is read separately. A missing answer stays unread — never a zero. Lanes are
          checked now; only the Wayback timeline is frozen in a saved report.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Lane
          icon={<Archive className="size-3.5" />}
          title="Internet Archive"
          status={timeline.captures.length > 0 ? statusCopy.read : statusCopy.empty}
          footer={
            <p className="text-[10.5px] leading-snug text-muted-foreground">
              Dated page evidence. The only lane that feeds the change rows.
            </p>
          }
        >
          <NumberLine
            value={`${timeline.coverage.sampled}/${timeline.coverage.available}`}
            label="captures read / listed in the index"
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {timeline.captures[0]?.label} — {timeline.captures[timeline.captures.length - 1]?.label}
          </p>
        </Lane>

        <Lane
          icon={<Globe2 className="size-3.5" />}
          title="Arquivo.pt"
          status={archives ? statusCopy[archives.status] : failed ? statusCopy.unavailable : pendingStatus}
          footer={
            <p className="text-[10.5px] leading-snug text-muted-foreground">
              {archives?.note ?? (failed ? 'Second archive check did not finish.' : 'Reading a second public archive…')}
            </p>
          }
        >
          {!sources && !failed ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : archives?.status === 'read' ? (
            <>
              <NumberLine value={archives.count.toLocaleString()} label="unique captures inspected" />
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                {archives.last ? `Newest ${archives.last.slice(6, 8)} ${MONTHS[Number(archives.last.slice(4, 6)) - 1]} ${archives.last.slice(0, 4)}` : ''}
                {archives.captures[0] ? (
                  <a
                    href={archives.captures[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    open <ArrowUpRight className="size-3" />
                  </a>
                ) : null}
              </p>
            </>
          ) : (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {archives?.note ?? 'No second-archive rows were returned.'}
            </p>
          )}
        </Lane>

        <Lane
          icon={<MessagesSquare className="size-3.5" />}
          title="Hacker News"
          status={mentions ? statusCopy[mentions.status] : failed ? statusCopy.unavailable : pendingStatus}
          footer={
            <p className="text-[10.5px] leading-snug text-muted-foreground">
              {mentions?.note ?? (failed ? 'Public-discussion check did not finish.' : 'Reading public story titles…')}
            </p>
          }
        >
          {!sources && !failed ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : mentions?.status === 'read' ? (
            <>
              <NumberLine value={String(mentions.total)} label={mentions.truncated ? 'matched stories (lower bound)' : 'matched public stories, last two years'} />
              <div className="mt-2 flex h-12 items-end gap-[3px]" data-testid="mentions-chart" role="img" aria-label={`Matched Hacker News stories per month; ${mentions.total} in total`}>
                {mentionMonths.map((month) => {
                  const count = counts.get(month) ?? 0
                  return (
                    <div key={month} className="flex-1" title={`${shortMonth(month)}: ${count} ${count === 1 ? 'story' : 'stories'}`}>
                      <div
                        className={count > 0 ? 'w-full rounded-t-[2px] bg-foreground/55' : 'w-full rounded-t-[2px] bg-border'}
                        style={{ height: `${count > 0 ? Math.max(5, (count / peak) * 44) : 2}px` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                <span>{shortMonth(mentionMonths[0])}</span>
                <span>{shortMonth(mentionMonths[mentionMonths.length - 1])}</span>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                Monthly count over the last 25 calendar months; bars sum to {mentions.total} across{' '}
                {mentions.months.length} month{mentions.months.length === 1 ? '' : 's'} with at
                least one story.
              </p>
            </>
          ) : (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {mentions?.note ?? 'No public story links were read.'}
            </p>
          )}
        </Lane>

        <Lane
          icon={<Megaphone className="size-3.5" />}
          title="Ad libraries"
          status={{ label: 'manual', variant: 'outline' }}
          footer={
            <p className="text-[10.5px] leading-snug text-muted-foreground">
              No free official API for general US commercial ads. Open a library yourself; no scraping.
            </p>
          }
        >
          <NumberLine value={String(adLinks.length)} label="public libraries, pre-filled with the domain" />
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {adLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
              >
                {link.id} <ExternalLink className="size-2.5" />
              </a>
            ))}
          </div>
        </Lane>
      </div>

      {mentions?.status === 'read' && mentions.stories.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Public stories · evidence, not a score
            </p>
            <span className="text-[10.5px] text-muted-foreground">
              Top {mentions.stories.length} by points{mentions.stories.length < mentions.total ? ` · ${mentions.stories.length} of ${mentions.total} shown` : ''}
            </span>
          </div>
          <div className="mt-2 divide-y divide-border/70">
            {mentions.stories.map((story) => (
              <a
                key={story.id}
                href={story.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-muted/20"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium leading-snug">{story.title}</span>
                  <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                    {story.createdAt.slice(0, 10)} · {story.points} points · {story.comments} comments
                  </span>
                </span>
                <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {failed ? (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <CircleAlert className="size-3.5" /> The extra public-source check failed. The archive timeline
          above is still usable; the other lanes are unread, not zero.
        </p>
      ) : null}
    </section>
  )
}
