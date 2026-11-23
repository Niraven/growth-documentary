import { ArrowRight, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function HowItWorks({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 md:px-8">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
        How it works
      </p>
      <h1 className="mt-3 font-display text-[clamp(36px,6vw,56px)] leading-[0.95] tracking-[-0.04em]">
        A receipt for every change.
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
        Paste a pricing page. Get a dated list of what changed on it, with the archived page behind
        every line. Built for the moment someone asks “says who?” in a pitch, a board deck or a
        sales call.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button onClick={onBack}>
          Try it on a page <ArrowRight />
        </Button>
        <Button variant="outline" asChild>
          <a href="https://web.archive.org/" target="_blank" rel="noreferrer">
            About the archive <ExternalLink />
          </a>
        </Button>
      </div>

      <Separator className="my-10" />

      <h2 className="font-display text-2xl tracking-[-0.02em]">Who it is for</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Agencies',
            body: 'Show a prospect what changed at their competitor this year, then hand them the receipts.',
          },
          {
            title: 'Founders',
            body: 'Watch a rival’s pricing and positioning without checking their site every week.',
          },
          {
            title: 'Sales teams',
            body: 'A competitor raised prices? That is a call list, with a dated source you can send.',
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-[17px]">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-[13px] leading-relaxed text-muted-foreground">
              {item.body}
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 font-display text-2xl tracking-[-0.02em]">How a report is built</h2>
      <ol className="mt-4 space-y-4">
        {[
          'You give a page URL. Nothing is installed and no account is created.',
          'It asks the Internet Archive which captures exist for that page, then samples up to 24 of them across the last two years: evenly spaced first, then extra reads around the captures where a change appeared.',
          'From each capture it reads three things: the page title, the first headline, and every price string on the page.',
          'It compares consecutive captures and lists only where one of those three changed. The first row is the baseline, not a change.',
          'Every line links to the exact archived page, so you can check it before you quote it.',
          'In parallel it reads the site’s archived sitemap, for a page count and — when the site publishes lastmod dates — a per-month view of pages added.',
        ].map((step, index) => (
          <li key={step} className="flex gap-4">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-card font-mono text-[11px]">
              {index + 1}
            </span>
            <p className="text-[14px] leading-relaxed text-foreground/85">{step}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 font-display text-2xl tracking-[-0.02em]">What it will not tell you</h2>
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-foreground/80">
          <li>· Why a change happened, or whether it worked.</li>
          <li>· Revenue, traffic or conversion impact.</li>
          <li>· The exact day of a change — only that it was visible by the next capture.</li>
          <li>· Anything behind a login, a paywall or an unarchived page.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">Observed, not inferred</Badge>
          <Badge variant="outline">Dates are bounds</Badge>
          <Badge variant="outline">No causal claims</Badge>
        </div>
      </div>

      <h2 className="mt-12 font-display text-2xl tracking-[-0.02em]">Reading a report</h2>
      <div className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Baseline</span> is the first readable capture.
          It is the starting point, not a change, so it does not count toward the change total.
        </p>
        <p>
          <span className="font-medium text-foreground">Coverage</span> shows every capture that was
          read, and marks the days where at least one field changed. The space between dots is
          unread — not unchanged.
        </p>
        <p>
          <span className="font-medium text-foreground">Site size</span> is the page count in the
          site’s archived sitemap. lastmod dates are self-reported; when they cluster, the panel says
          so instead of drawing a growth curve that the data cannot support.
        </p>
        <p>
          <span className="font-medium text-foreground">A missing value</span> is a gap, never a
          deletion. If a capture cannot be read, its era is skipped rather than reported as “they
          removed it”.
        </p>
      </div>

      <Separator className="my-10" />
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Data source: Internet Archive Wayback Machine. Extraction is limited to page title, first
        headline and price strings. It is a reading aid, not a legal record.
      </p>
    </main>
  )
}
