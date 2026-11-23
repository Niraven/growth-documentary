import { useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, Radio } from 'lucide-react'
import type { LiveCheck, Timeline } from '../../shared/timeline'
import { compareSnapshot, isLiveCheck } from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const fieldWords: Record<string, string> = {
  title: 'page title',
  headline: 'headline',
  price: 'price',
}

export function LivePanel({ report }: { report: Timeline }) {
  const [check, setCheck] = useState<LiveCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latest = report.captures[report.captures.length - 1]
  const differences = check && latest ? compareSnapshot(latest, check) : []
  const livePrices = check
    ? [...check.prices].sort((a, b) => {
        const value = (price: string) => Number(price.replace(/[^0-9.]/g, '')) || 0
        return value(a) - value(b) || a.localeCompare(b)
      })
    : []

  const run = async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 25_000)
    try {
      const response = await fetch(
        `/api/live?url=${encodeURIComponent(`${report.domain}${report.path}`)}`,
        { signal: controller.signal },
      )
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : 'Could not read the live page',
        )
      }
      if (!isLiveCheck(payload)) throw new Error('The server returned an unexpected live check')
      setCheck(payload)
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === 'AbortError'
          ? 'The live page took too long to answer.'
          : caught instanceof Error
            ? caught.message
            : 'Could not read the live page',
      )
    } finally {
      window.clearTimeout(timer)
      setLoading(false)
    }
  }

  return (
    <Card className="mt-3">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-muted-foreground" />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Current page
            </p>
            <Badge variant="outline">live read</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {loading ? 'Reading page…' : 'Check the live page'}
          </Button>
        </div>

        <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          Reads the page once, now, only after <code>robots.txt</code> allows it. A live read has no
          archive timestamp, so it is never counted as a dated change.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px]">
            {error}
          </p>
        )}

        {check && (
          <div className="mt-4 border-t border-border/70 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Title', check.title || '—'],
                ['Headline', check.h1 || '—'],
                ['Prices', livePrices.length > 0 ? livePrices.join(' · ') : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug break-words">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
              <Badge variant={differences.length > 0 ? 'good' : 'outline'}>
                {differences.length === 0
                  ? 'Same as the latest capture'
                  : `Differs from the latest capture: ${differences.map((field) => fieldWords[field] ?? field).join(', ')}`}
              </Badge>
              {latest && (
                <span className="text-muted-foreground">
                  Compared with {latest.label}
                  {' · '}
                  <a
                    href={latest.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
                  >
                    that capture
                  </a>
                </span>
              )}
              <a
                href={check.finalUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
              >
                Open live page <ExternalLink className="size-3" />
              </a>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Read{' '}
              {new Date(check.fetchedAt).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}.
              A difference against the archived copy is a fact of comparison, not a dated change.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
