import { useEffect, useState } from 'react'
import { ArrowUpRight, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  buildGrowthTimeline,
  growthMarkdown,
  isGrowthTimeline,
  type GrowthEvent,
  type GrowthTimeline,
} from '../../shared/growth'
import { chapterize, missingMonths } from '../../shared/chapters'
import { assessCoverage } from '../../shared/coverage'
import type { Timeline } from '../../shared/timeline'

type Filter = 'all' | 'page' | 'site' | 'launch' | 'release'

const filterLabel: Record<Filter, string> = {
  all: 'All signals',
  page: 'Page changes',
  site: 'Site expansion',
  launch: 'Public signals',
  release: 'Releases',
}

const typeLabel: Record<GrowthEvent['type'], string> = {
  'page change': 'Page change',
  'site expansion': 'Site expansion',
  'public signal': 'Public signal',
  release: 'Release',
}

const typeFilter: Record<GrowthEvent['type'], Filter> = {
  'page change': 'page',
  'site expansion': 'site',
  'public signal': 'launch',
  release: 'release',
}

function EventRow({ event }: { event: GrowthEvent }) {
  return (
    <li className="grid gap-2 border-b border-border/70 py-4 last:border-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
      <div>
        <time className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {event.label}
        </time>
        <Badge variant="secondary" className="mt-2">
          {typeLabel[event.type]}
        </Badge>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="max-w-[62ch] text-[14px] font-medium leading-snug">{event.title}</h3>
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[12px] font-medium text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
          >
            {event.source}
            <ArrowUpRight className="size-3" />
          </a>
        </div>
        {event.before !== undefined && event.after !== undefined ? (
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed">
            <div className="flex gap-3">
              <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Before
              </span>
              <span className="min-w-0 break-words text-muted-foreground line-through decoration-border">
                {event.before || '—'}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                After
              </span>
              <span className="min-w-0 break-words font-medium">{event.after || '—'}</span>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {event.beforeUrl && (
                <a
                  href={event.beforeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  Before capture
                </a>
              )}
              {event.afterUrl && (
                <a
                  href={event.afterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  After capture
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-1.5 max-w-[70ch] break-words text-[13px] leading-relaxed text-muted-foreground">
            {event.detail}
          </p>
        )}
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {event.evidence} · {event.note}
        </p>
      </div>
    </li>
  )
}

export function GrowthTimelineReport({ report }: { report: Timeline }) {
  const [growth, setGrowth] = useState<GrowthTimeline | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const target = `${report.domain}${report.path}`
    const load = async () => {
      try {
        const response = await fetch(`/api/growth?url=${encodeURIComponent(target)}`, {
          signal: controller.signal,
        })
        const payload: unknown = await response.json()
        if (!response.ok || !isGrowthTimeline(payload)) {
          throw new Error('The growth timeline could not be read')
        }
        setGrowth(payload)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setFailed(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [report.domain, report.path])

  const current = growth ?? buildGrowthTimeline(report)
  const visible =
    filter === 'all' ? current.events : current.events.filter((event) => typeFilter[event.type] === filter)
  const chapters = chapterize(visible)
  const coverage = assessCoverage({
    pageHistory: current.sources.page,
    siteMap: current.sources.site,
    publicSignals: current.sources.publicSignals,
    feeds: current.sources.feeds,
    sampled: current.coverage.sampled,
    listed: current.coverage.listed,
  })
  const caveats = [...new Set([...current.caveats, ...coverage.caveats])]
  const sourceNames = [
    growth?.sources.page ? 'page' : null,
    growth?.sources.site ? 'sitemap' : null,
    growth?.sources.publicSignals ? 'HN' : null,
    growth?.sources.feeds ? 'feed' : null,
  ].filter(Boolean)
  const samplePercent = coverage.counts.listed
    ? Math.round((coverage.counts.sampled / coverage.counts.listed) * 100)
    : 0
  const unsampled = Math.max(0, coverage.counts.listed - coverage.counts.sampled)
  const releasesLabel = growth?.sources.feeds
    ? `${growth.counts.releases} releases`
    : 'releases unread'
  const siteEventCount = growth?.events.filter((event) => event.type === 'site expansion').length ?? 0
  const missing = growth ? missingMonths(growth.events, growth.period.from, growth.period.to) : []

  const copy = async () => {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(growthMarkdown(current))
    } catch {
      toast.error('Could not copy the timeline')
    } finally {
      setCopying(false)
    }
  }

  return (
    <section id="growth" tabIndex={-1} aria-labelledby="growth-title" className="report-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="metadata">Open-source growth timeline</span>
          <h2 id="growth-title">Public growth timeline</h2>
          <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-muted-foreground">
            Every dated signal this tool can source, in one place: offer changes, site expansion
            and public signals. A missing lane is unread, not zero.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {growth ? (
              <>
                <Badge
                  variant={
                    coverage.level === 'multi-source'
                      ? 'good'
                      : coverage.level === 'thin'
                        ? 'warn'
                        : 'outline'
                  }
                >
                  {coverage.level} public record
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {sourceNames.join(', ')} · {coverage.counts.sampled} of{' '}
                  {coverage.counts.listed} captures ({samplePercent}%)
                  {unsampled > 0 ? ` · ${unsampled} listed captures not sampled` : ''}
                </span>
              </>
            ) : (
              <Badge variant="outline">{failed ? 'coverage unread' : 'reading coverage'}</Badge>
            )}
          </div>
          {growth && coverage.level === 'thin' && (
            <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
              Not enough dated public history for a confident narrative. The events below are what
              was actually readable; the gate does not fill the gaps.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => void copy()} disabled={copying || !growth}>
          {copying ? <Loader2 className="animate-spin" /> : <Copy />}
          {copying ? 'Copying…' : 'Copy timeline'}
        </Button>
      </div>

      <p className="mt-4 font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
        {growth
          ? `${growth.events.length} dated events · ${growth.counts.pageChanges} page changes · ${siteEventCount} site-expansion month${siteEventCount === 1 ? '' : 's'} (${growth.counts.siteAdditions} pages dated) · ${growth.counts.publicSignals} HN links · ${releasesLabel}`
          : `${current.counts.pageChanges} page changes · site and public lanes ${
              failed ? 'unread' : 'reading'
            }`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(Object.keys(filterLabel) as Filter[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-11 rounded-full border px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
              filter === value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground'
            }`}
          >
            {filterLabel[value]}
          </button>
        ))}
        {!growth && !failed && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-3 animate-spin" /> reading site and public lanes
          </span>
        )}
        {failed && (
          <span className="text-[11px] text-muted-foreground">
            Public lanes are unread; page changes still shown.
          </span>
        )}
      </div>

      <div data-testid="growth-events" className="mt-2">
        {visible.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            No {filter === 'all' ? 'dated' : filterLabel[filter].toLowerCase()} signal in this
            sample. That is not proof nothing happened.
          </p>
        ) : (
          chapters.map((chapter) => (
            <section key={chapter.id} className="mt-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                <h3 className="font-display text-[19px] tracking-[-0.02em]">{chapter.label}</h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {chapter.title} · {chapter.events.length}
                </span>
              </div>
              <ol>
                {chapter.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      {missing.length > 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          No dated event in {missing.slice(0, 8).join(', ')}
          {missing.length > 8 ? ` and ${missing.length - 8} more month${missing.length - 8 === 1 ? '' : 's'}` : ''}. Gaps are unread, not unchanged.
        </p>
      )}

      <details className="mt-5 border-t border-border pt-3">
        <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground">
          What this timeline does not prove
        </summary>
        <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {caveats.map((caveat) => (
            <li key={caveat}>· {caveat}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
