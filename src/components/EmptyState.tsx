import { ArrowRight, CalendarRange, ExternalLink, ScanSearch, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const steps = [
  {
    icon: CalendarRange,
    title: 'Find the captures',
    body: 'The Internet Archive index is asked for every snapshot of that exact URL, query string included.',
  },
  {
    icon: ScanSearch,
    title: 'Read up to 24',
    body: 'Captures are spaced across two years, then read closer around the moments the page changed.',
  },
  {
    icon: ShieldCheck,
    title: 'Diff only what is visible',
    body: 'Page title, first headline, price strings. Every row links to the capture that proves it.',
  },
]

const EXAMPLE = {
  baseline: {
    ts: '20241214215555',
    label: '14 Dec 2024',
    value: 'Basecamp: Pricing',
    url: 'https://web.archive.org/web/20241214215555/https://basecamp.com/pricing',
  },
  change: {
    ts: '20260529184639',
    label: '29 May 2026',
    value: 'Pick a package and try Basecamp for free.',
    before: 'Pick the package that fits you best.',
    url: 'https://web.archive.org/web/20260529184639/https://basecamp.com/pricing',
  },
}

export function EmptyState({ onPick }: { onPick: (target: string) => void }) {
  return (
    <div className="pt-10">
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              What you get
            </p>
            <Badge variant="outline">From a real run · basecamp.com/pricing</Badge>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid gap-1.5 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {EXAMPLE.baseline.label}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Baseline</Badge>
                  <a
                    href={EXAMPLE.baseline.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
                  >
                    Open capture
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  Page read as <span className="font-medium text-foreground">{EXAMPLE.baseline.value}</span>{' '}
                  on this date.
                </p>
              </div>
            </div>

            <div className="grid gap-1.5 border-t border-border/70 pt-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {EXAMPLE.change.label}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Headline</Badge>
                  <a
                    href={EXAMPLE.change.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
                  >
                    Open capture
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <div className="mt-2 space-y-1 text-[13.5px] leading-relaxed">
                  <div className="flex gap-3">
                    <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Before
                    </span>
                    <span className="text-muted-foreground line-through decoration-border">
                      {EXAMPLE.change.before}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      After
                    </span>
                    <span className="font-medium">{EXAMPLE.change.value}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/70 pt-3">
            <Button variant="outline" size="sm" onClick={() => onPick('basecamp.com/pricing')}>
              Run this report
              <ArrowRight />
            </Button>
            <span className="text-[11.5px] text-muted-foreground">
              Two rows from a real run. Values are quoted exactly as archived.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <step.icon className="size-4 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                0{index + 1}
              </span>
            </div>
            <p className="mt-3 text-[13.5px] font-medium">{step.title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          Try:
          {['basecamp.com/pricing', 'stripe.com/pricing', 'linear.app'].map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => onPick(target)}
              className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10.5px] text-foreground transition-colors hover:border-foreground/30"
            >
              {target}
            </button>
          ))}
        </span>
        <span>Archive only · no account · no estimates.</span>
      </div>
    </div>
  )
}
