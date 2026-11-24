import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { isSiteGraph, type SiteGraph } from '../../shared/sitegraph'
import { isSignalsReport, type SignalsReport } from '../../shared/signals'

type ContextState = {
  graph: SiteGraph | null
  signals: SignalsReport | null
  graphFailed: boolean
  signalsFailed: boolean
}

const TYPE_LABEL: Record<string, string> = {
  pricing: 'Pricing',
  product: 'Product',
  compare: 'Compare',
  integrations: 'Integrations',
  changelog: 'Changelog',
  careers: 'Careers',
  docs: 'Docs',
  blog: 'Blog',
  other: 'Other',
}

export function SourceContextPanel({ domain, path }: { domain: string; path: string }) {
  const [state, setState] = useState<ContextState>({
    graph: null,
    signals: null,
    graphFailed: false,
    signalsFailed: false,
  })
  const target = `${domain}${path}`

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      const [graphResponse, signalsResponse] = await Promise.allSettled([
        fetch(`/api/sitegraph?url=${encodeURIComponent(target)}`, { signal: controller.signal }),
        fetch(`/api/signals?url=${encodeURIComponent(target)}`, { signal: controller.signal }),
      ])
      if (graphResponse.status === 'fulfilled') {
        try {
          const payload: unknown = await graphResponse.value.json()
          if (graphResponse.value.ok && isSiteGraph(payload)) {
            setState((current) => ({ ...current, graph: payload }))
          } else setState((current) => ({ ...current, graphFailed: true }))
        } catch {
          setState((current) => ({ ...current, graphFailed: true }))
        }
      } else setState((current) => ({ ...current, graphFailed: true }))
      if (signalsResponse.status === 'fulfilled') {
        try {
          const payload: unknown = await signalsResponse.value.json()
          if (signalsResponse.value.ok && isSignalsReport(payload)) {
            setState((current) => ({ ...current, signals: payload }))
          } else setState((current) => ({ ...current, signalsFailed: true }))
        } catch {
          setState((current) => ({ ...current, signalsFailed: true }))
        }
      } else setState((current) => ({ ...current, signalsFailed: true }))
    }
    void load()
    return () => controller.abort()
  }, [target])

  const { graph, signals } = state
  const pageTypes = graph
    ? Object.entries(graph.pageTypes)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a)
    : []
  const jobs = signals?.jobs
  const jobsLabel = !jobs
    ? state.signalsFailed
      ? 'unread'
      : 'reading'
    : jobs.status === 'read'
      ? `${jobs.openRoles ?? 0} open`
      : jobs.status === 'empty'
        ? 'not detected'
        : 'unread'
  const feedLabel = !signals?.feeds
    ? state.signalsFailed
      ? 'unread'
      : 'reading'
    : signals.feeds.status === 'read'
      ? `${signals.feeds.entries.length} entries`
      : signals.feeds.status === 'empty'
        ? 'empty'
        : 'unavailable — not zero'

  return (
    <section id="context" tabIndex={-1} aria-labelledby="context-title" className="report-section">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="metadata">Public surface & current signals</span>
          <h2 id="context-title">More context, still sourced</h2>
        </div>
        <Badge variant="outline">current snapshot</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-medium">Site surface</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {graph ? `${graph.fetched} pages read` : state.graphFailed ? 'unread' : 'reading'}
            </span>
          </div>
          {!graph ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {state.graphFailed
                ? 'The same-origin page graph could not be read. No page types are inferred.'
                : 'Reading public pages and sitemap discovery.'}
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pageTypes.map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {TYPE_LABEL[type] ?? type} {count}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                {graph.discovered} URLs discovered · {graph.fetched} pages read. Same-origin public
                pages only.
              </p>
              {graph.notes.length > 0 && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {graph.notes[0]}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                {graph.sitemapUrl && (
                  <a
                    href={graph.sitemapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    Sitemap <ArrowUpRight className="size-3" />
                  </a>
                )}
                {graph.pages[0] && (
                  <a
                    href={graph.pages[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    First page <ArrowUpRight className="size-3" />
                  </a>
                )}
              </div>
            </>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-medium">Hiring snapshot</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {jobsLabel}
            </span>
          </div>
          {!jobs ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {state.signalsFailed
                ? 'The public jobs lane could not be read. No hiring claim is made.'
                : 'Reading public ATS boards.'}
            </p>
          ) : jobs.status !== 'read' ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{jobs.note}</p>
          ) : (
            <>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                {jobs.provider ?? 'Public ATS'} · {jobs.openRoles ?? 0} open role
                {jobs.openRoles === 1 ? '' : 's'} in this snapshot.
              </p>
              {jobs.roles.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {jobs.roles.slice(0, 4).map((role) => (
                    <li key={role.url}>
                      <a
                        href={role.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 text-[12px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                      >
                        {role.title}
                        {role.location && <span className="text-[10px]">· {role.location}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {signals?.feeds && (
            <p className="mt-3 border-t border-border pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Release feed: {feedLabel}
            </p>
          )}
        </article>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        The site graph is a bounded same-origin read, not a full crawl. The hiring card is a current
        public snapshot, not a historical series. Neither is a growth metric.
      </p>
    </section>
  )
}
