import { useEffect, useState } from 'react'
import { ChartColumn, Loader2 } from 'lucide-react'
import { isErrorBody, isSiteInfo, type SiteInfo } from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Contiguous `YYYY-MM` keys between two months, so missing months read as zero. */
function monthRange(first: string, last: string): string[] {
  const [fy, fm] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  const out: string[] = []
  for (let month = fy * 12 + fm - 1; month <= ly * 12 + lm - 1; month += 1) {
    out.push(`${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}`)
  }
  return out
}

function monthLabel(month: string): string {
  const [year, value] = month.split('-').map(Number)
  return `${new Date(Date.UTC(year, value - 1, 1)).toLocaleString('en', {
    month: 'short',
    timeZone: 'UTC',
  })} ${String(year).slice(2)}`
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function SiteGrowth({ target }: { target: string }) {
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const response = await fetch(`/api/site?url=${encodeURIComponent(target)}`, {
          signal: controller.signal,
        })
        const payload: unknown = await response.json()
        if (!response.ok) {
          throw new Error(isErrorBody(payload) ? payload.error : 'Sitemap check failed')
        }
        if (!isSiteInfo(payload)) throw new Error('Unexpected sitemap report')
        setSite(payload)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setFailed(true)
      }
    }

    void load()
    return () => controller.abort()
  }, [target])

  const months =
    site && site.months.length > 0
      ? (() => {
          const range = monthRange(site.months[0].month, site.months[site.months.length - 1].month)
          const counts = new Map(site.months.map((entry) => [entry.month, entry.added]))
          return range.slice(-18).map((month) => ({ month, added: counts.get(month) ?? 0 }))
        })()
      : []
  const peak = Math.max(1, ...months.map((entry) => entry.added))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <ChartColumn className="size-3.5" />
          Site footprint
        </CardTitle>
        {site?.sitemapUrl ? <Badge variant="outline">sitemap</Badge> : null}
      </CardHeader>
      <CardContent className="pt-4">
        {!site && !failed && (
          <div className="flex items-center gap-2 py-4 text-[12.5px] text-muted-foreground" role="status">
            <Loader2 className="size-3.5 animate-spin" />
            Reading the archived sitemap…
          </div>
        )}

        {failed && (
          <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            The sitemap check did not finish. The timeline above does not depend on it.
          </p>
        )}

        {site && site.sitemapUrl === null && (
          <div className="space-y-2 py-1">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{site.note}</p>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground/80">
              Site growth needs a sitemap. The timeline above is unaffected.
            </p>
          </div>
        )}

        {site && site.sitemapUrl !== null && (
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-[34px] leading-none tracking-[-0.02em]">
                  {site.pages.toLocaleString()}
                </p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  pages in the archived sitemap
                </p>
              </div>
              <p className="text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                {site.dated !== site.pages ? (
                  <>
                    {site.dated.toLocaleString()} dated
                    <br />
                  </>
                ) : null}
                {site.archivedAt ? dayLabel(site.archivedAt) : ''}
              </p>
            </div>

            {months.length >= 4 ? (
              <div className="mt-5">
                <div
                  className="flex h-20 items-end gap-[3px]"
                  role="img"
                  aria-label={`Pages added per month from ${monthLabel(months[0].month)} to ${monthLabel(
                    months[months.length - 1].month,
                  )}`}
                >
                  {months.map((entry) => (
                    <div
                      key={entry.month}
                      className="group relative flex-1"
                      title={`${monthLabel(entry.month)}: ${entry.added} page${
                        entry.added === 1 ? '' : 's'
                      }`}
                    >
                      <div
                        className={`w-full rounded-t-[2px] transition-colors ${
                          entry.added > 0
                            ? 'bg-foreground/25 group-hover:bg-foreground/45'
                            : 'bg-border'
                        }`}
                        style={{ height: `${entry.added > 0 ? Math.max(6, (entry.added / peak) * 80) : 2}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{monthLabel(months[0].month)}</span>
                  <span>{monthLabel(months[months.length - 1].month)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {site.months.length > 0
                  ? `The site’s lastmod dates cluster in ${site.months
                      .slice(-3)
                      .map((entry) => monthLabel(entry.month))
                      .join(', ')}. A clustered sitemap cannot time growth — it still shows how many pages exist.`
                  : 'This sitemap has no usable lastmod dates, so additions cannot be placed in time.'}
              </div>
            )}

            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">{site.note}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground/80">
              The page above is one of these pages. Counts come from the site’s own sitemap and its
              self-reported <code>lastmod</code> dates — a floor, not a promise.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
