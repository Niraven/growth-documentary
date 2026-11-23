import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import { Toaster, toast } from 'sonner'
import {
  ArrowUpRight,
  CalendarRange,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  ShieldCheck,
  TriangleAlert,
  ZoomIn,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import Gallery from '@/components/Gallery'
import HowItWorks from '@/components/HowItWorks'
import { LiveLoading, LiveReport, type LiveData } from '@/components/LiveReport'

const shot = (file: string) => `${import.meta.env.BASE_URL}shots/${file}`

type Confidence = 'high' | 'medium'

type DocEvent = {
  id: string
  dateLabel: string
  title: string
  detail: string
  confidence: Confidence
  datePrecision: string
  image: string
  imageAlt: string
  source: string
  sourceLabel: string
  doesNotProve: string
}

const events: DocEvent[] = [
  {
    id: 'e1',
    dateLabel: '10 Jun 2019',
    title: 'The pay-as-you-go plan is called Integrated',
    detail:
      'Two cards on the page: INTEGRATED at 2.9% + 30¢ per successful card charge, and CUSTOMIZED for volume and interchange pricing.',
    confidence: 'high',
    datePrecision: 'Exact capture date',
    image: shot('2019.png'),
    imageAlt: 'Stripe pricing page captured 10 June 2019, showing INTEGRATED and CUSTOMIZED plans',
    source: 'https://web.archive.org/web/20190610230932/https://stripe.com/pricing',
    sourceLabel: 'Wayback capture · 10 Jun 2019',
    doesNotProve: 'When the plan was first named Integrated, or what it was called before this capture.',
  },
  {
    id: 'e2',
    dateLabel: '3 Jun 2022',
    title: 'Same plan, sharper promise',
    detail:
      'The plan is still INTEGRATED at 2.9% + 30¢, but the headline gains a second line: “Always know what you’ll pay.”',
    confidence: 'high',
    datePrecision: 'Exact capture date',
    image: shot('2022.png'),
    imageAlt: 'Stripe pricing page captured 3 June 2022, showing INTEGRATED plan and new headline',
    source: 'https://web.archive.org/web/20220603144256/https://stripe.com/pricing',
    sourceLabel: 'Wayback capture · 3 Jun 2022',
    doesNotProve: 'That the headline change caused any commercial result. It is a visible copy change only.',
  },
  {
    id: 'e3',
    dateLabel: '1 Jun 2024',
    title: 'Integrated becomes Standard, and IC+ pricing appears',
    detail:
      'The plan card now reads STANDARD, and the custom card lists IC+ pricing alongside volume and multi-product discounts.',
    confidence: 'medium',
    datePrecision: 'Visible by this date — exact change date unknown',
    image: shot('2024.png'),
    imageAlt: 'Stripe pricing page captured 1 June 2024, showing STANDARD plan and IC+ pricing',
    source: 'https://web.archive.org/web/20240601213401/https://stripe.com/pricing',
    sourceLabel: 'Wayback capture · 1 Jun 2024',
    doesNotProve: 'The exact day the rename happened. The page was not observed between Jun 2022 and Jun 2024.',
  },
]

type Capture = { ts: string; label: string }

const captures: Capture[] = [
  { ts: '20190507010838', label: '7 May 2019' },
  { ts: '20191101021053', label: '1 Nov 2019' },
  { ts: '20200503073608', label: '3 May 2020' },
  { ts: '20201102093726', label: '2 Nov 2020' },
  { ts: '20210502020614', label: '2 May 2021' },
  { ts: '20211103162245', label: '3 Nov 2021' },
  { ts: '20220501234601', label: '1 May 2022' },
  { ts: '20221108000635', label: '8 Nov 2022' },
  { ts: '20230505003706', label: '5 May 2023' },
  { ts: '20231104162034', label: '4 Nov 2023' },
  { ts: '20240502190354', label: '2 May 2024' },
  { ts: '20241105142752', label: '5 Nov 2024' },
]

const PAGE_SIZE = 4

function ShareCard() {
  return (
    <div className="aspect-[1200/630] w-full overflow-hidden rounded-xl border border-ink/15 bg-ink p-5 text-paper">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/55">
            Growth Documentary · 001
          </span>
          <span className="rounded-full border border-paper/25 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-paper/70">
            EVIDENCE-BACKED
          </span>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55">
            Stripe · pricing
          </p>
          <p className="mt-1.5 font-display text-[clamp(20px,4.2vw,38px)] leading-[1.02] tracking-[-0.03em]">
            Integrated <span className="text-paper/35">→</span> Standard
          </p>
          <p className="mt-1.5 text-[clamp(9px,1.35vw,11px)] leading-relaxed text-paper/65">
            Visible by 1 Jun 2024. Three archived pages, two verified changes.
          </p>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-1.5">
            {['2019', '2022', '2024'].map((year) => (
              <span
                key={year}
                className="rounded-full border border-paper/25 px-1.5 py-0.5 font-mono text-[9px] text-paper/70"
              >
                {year}
              </span>
            ))}
          </div>
          <span className="font-display text-[11px] italic text-paper/55">
            growthdocumentary.dev
          </span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [selected, setSelected] = useState<DocEvent | null>(null)
  const [zoom, setZoom] = useState(false)
  const [activeId, setActiveId] = useState(events[2].id)
  const [view, setView] = useState<'report' | 'system' | 'how'>(() =>
    window.location.hash === '#system'
      ? 'system'
      : window.location.hash === '#how'
        ? 'how'
        : 'report',
  )
  const [skin, setSkin] = useState<'day' | 'paper' | 'night'>(() => {
    const param = new URLSearchParams(window.location.search).get('skin')
    if (param === 'day' || param === 'paper' || param === 'night') return param
    try {
      return (localStorage.getItem('gd-skin') as 'day' | 'paper' | 'night') || 'day'
    } catch {
      return 'day'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    try {
      localStorage.setItem('gd-skin', skin)
    } catch {
      /* storage blocked */
    }
  }, [skin])

  useEffect(() => {
    if (view === 'system') window.history.replaceState(null, '', '#system')
    else if (view === 'how') window.history.replaceState(null, '', '#how')
    else window.history.replaceState(null, '', window.location.pathname)
  }, [view])

  const active = events.find((event) => event.id === activeId) ?? events[2]
  const isDialogOpen = selected !== null
  const [pageIndex, setPageIndex] = useState(0)
  const pageCount = Math.ceil(captures.length / PAGE_SIZE)
  const pageItems = captures.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE)
  const [domain, setDomain] = useState('')
  const [live, setLive] = useState<LiveData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const heroTitle = live ? live.domain : 'Stripe'
  const heroKicker = live ? 'Live report · public archive' : 'Field report 001 · Pricing pages'
  const heroBlurb = live
    ? `Every archived capture of ${live.domain}${live.path} that could be read, compared line by line. ${Math.max(
        0,
        live.changes.length - 1,
      )} visible changes found across ${live.captures.length} captures.`
    : 'What changed on one pricing page over five years, dated and shown with the page that proves it. No estimate of revenue, no claim about why.'
  const heroStats: [string, string][] = live
    ? [
        [String(live.captures.length), 'captures read'],
        [String(Math.max(0, live.changes.length - 1)), 'visible changes'],
        [live.path || '/', 'page'],
      ]
    : [
        ['3', 'archived pages'],
        ['2', 'verified changes'],
        ['1', 'coverage gap'],
      ]

  const build = async (target: string) => {
    setLoading(true)
    setError(null)
    setLive(null)
    try {
      const response = await fetch(`/api/timeline?url=${encodeURIComponent(target)}`)
      const payload = (await response.json()) as LiveData & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not build the timeline')
      setLive(payload)
      window.setTimeout(
        () => document.getElementById('live')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        120,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not build the timeline')
    } finally {
      setLoading(false)
    }
  }

  const run = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = domain.trim()
    if (target) void build(target)
  }

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get('url')
    if (!preset) return
    setDomain(preset)
    void build(preset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = (event: DocEvent) => {
    setActiveId(event.id)
    setSelected(event)
    setZoom(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.source)
      toast.success('Source link copied', {
        description: active.sourceLabel,
        action: {
          label: 'Open',
          onClick: () => window.open(active.source, '_blank', 'noopener,noreferrer'),
        },
      })
    } catch {
      toast.error('Clipboard not available', {
        description: 'Open the capture directly from the evidence drawer.',
      })
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster position="bottom-right" theme={skin === 'night' ? 'dark' : 'light'} toastOptions={{ style: { fontFamily: 'inherit' } }} />
      <div className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
            <button
              onClick={() => setView('report')}
              className="flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left"
            >
              <img
                src={`${import.meta.env.BASE_URL}icon.svg`}
                width={28}
                height={28}
                alt=""
                className="rounded-[6px]"
              />
              <span className="font-display text-[15px] tracking-[-0.01em]">Growth Documentary</span>
            </button>
            <nav aria-label="Primary" className="flex items-center gap-2">
              <div
                className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
                role="group"
                aria-label="Colour theme"
              >
                {(['day', 'paper', 'night'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setSkin(option)}
                    aria-pressed={skin === option}
                    title={option}
                    className={`h-6 w-6 rounded-full border transition-transform hover:scale-105 ${
                      option === 'day'
                        ? 'border-[#e7e5e4] bg-[#fafaf9]'
                        : option === 'paper'
                          ? 'border-[#e3dac8] bg-[#f3efe4]'
                          : 'border-[#26262a] bg-[#0a0a0b]'
                    } ${skin === option ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}`}
                  >
                    <span className="sr-only">{option} theme</span>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setView('how')}>
                How it works
              </Button>
              <Button size="sm">
                Share
                <ArrowUpRight />
              </Button>
            </nav>
          </div>
        </header>

        {view === 'system' ? (
          <Gallery onBack={() => setView('report')} />
        ) : view === 'how' ? (
          <HowItWorks onBack={() => setView('report')} />
        ) : (
          <main id="main" className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-8 border-b border-border py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            >
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                  {heroKicker}
                </p>
                <h1 className="mt-4 break-words font-display text-[clamp(44px,7vw,84px)] leading-[0.9] tracking-[-0.04em]">
                  {heroTitle}
                </h1>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                  {heroBlurb}
                </p>

                <form onSubmit={run} className="mt-6 max-w-xl">
                  <label htmlFor="domain" className="sr-only">
                    Domain or page URL
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="domain"
                      name="domain"
                      value={domain}
                      onChange={(event) => setDomain(event.target.value)}
                      placeholder="basecamp.com/pricing"
                      autoComplete="off"
                      spellCheck={false}
                      className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                    <Button type="submit" disabled={loading || domain.trim().length === 0}>
                      {loading ? 'Reading archive…' : 'Build timeline'}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    Public archive only. Compares page title, first headline and price strings
                    across up to 12 captures. Takes 15–30 seconds.
                  </p>
                </form>
              </div>
              <div className="flex flex-wrap gap-2.5 md:justify-end">
                {heroStats.map(([value, label]) => (
                  <div
                    key={label}
                    className="min-w-[104px] rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(21,18,16,0.04)]"
                  >
                    <p className="truncate font-display text-[22px] leading-none tracking-[-0.01em]">
                      {value}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </motion.section>

            {loading && <LiveLoading domain={domain} />}
            {error && (
              <div
                role="alert"
                className="mb-10 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-foreground"
              >
                <span className="font-medium">Could not build that timeline.</span> {error}
              </div>
            )}
            {live && <LiveReport data={live} />}
            {!live && (
              <>
                <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section aria-labelledby="record">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id="record" className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="mr-2 text-muted-foreground">01</span>
                    The record
                  </h2>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    <CalendarRange className="size-3.5" />
                    2019 — 2024
                  </span>
                </div>

                <ol className="mt-7 border-l border-border pl-6">
                  {events.map((event, index) => (
                    <li key={event.id} className="relative pb-8 last:pb-0">
                      <span className="absolute -left-[31px] top-2 grid h-3 w-3 place-items-center rounded-full border border-foreground/25 bg-background">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                      </span>
                      <button
                        onClick={() => open(event)}
                        className="group w-full rounded-xl border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-card"
                      >
                        <div className="flex items-start justify-between gap-5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <time className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                                {event.dateLabel}
                              </time>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Badge variant={event.confidence === 'high' ? 'good' : 'warn'}>
                                      <ShieldCheck />
                                      {event.confidence}
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">
                                    {event.confidence === 'high' ? 'High confidence' : 'Medium confidence'}
                                  </p>
                                  <p className="mt-1 text-paper/70">
                                    {event.confidence === 'high'
                                      ? 'A comparable before/after pair, both pages verified in the archive.'
                                      : 'The state is observed, but the exact change date is unknown.'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <h3 className="mt-2.5 font-display text-[23px] leading-[1.16] tracking-[-0.015em]">
                              {event.title}
                            </h3>
                            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
                              {event.detail}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 py-2 text-[12px] font-medium text-accent-foreground">
                              Open evidence
                              <ArrowUpRight className="size-3.5" />
                            </span>
                          </div>
                          <img
                            src={event.image}
                            alt={event.imageAlt}
                            loading={index === 0 ? 'eager' : 'lazy'}
                            className="mt-0.5 hidden h-24 w-36 shrink-0 rounded-lg border border-border object-cover object-top shadow-sm transition-transform duration-300 group-hover:scale-[1.02] sm:block"
                          />
                        </div>
                      </button>
                      {index === 1 && (
                        <div className="mt-1 flex items-start gap-2 rounded-xl border border-dashed border-border bg-card/50 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-accent-foreground" />
                          24 months unobserved — no page capture between Jun 2022 and Jun 2024
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>

              <aside className="lg:sticky lg:top-24 lg:self-start">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                        Record
                      </CardTitle>
                      <ImageIcon className="size-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="evidence">
                      <TabsList className="w-full">
                        <TabsTrigger value="evidence" className="flex-1">
                          Evidence
                        </TabsTrigger>
                        <TabsTrigger value="share" className="flex-1">
                          Share card
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="evidence" className="space-y-4">
                        <img
                          src={active.image}
                          alt={active.imageAlt}
                          className="aspect-[4/3] w-full rounded-lg border border-border bg-white object-contain"
                        />
                        <div>
                          <p className="font-display text-[17px] leading-snug">{active.title}</p>
                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                            {active.sourceLabel} · {active.datePrecision}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => open(active)} className="flex-1">
                            View full page
                          </Button>
                          <Button variant="outline" size="icon" onClick={copy} aria-label="Copy source link">
                            <Copy />
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="share" className="space-y-3">
                        <ShareCard />
                        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                          1200 × 630. Carries the claim, the range and the evidence count — not a
                          chart that implies causation.
                        </p>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card className="mt-4 border-accent/25 bg-accent/60">
                  <CardHeader>
                    <CardTitle className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent-foreground">
                      What this does not prove
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-[12px] leading-relaxed text-ink/75">
                      <li>· That the rename caused any change in revenue or signups.</li>
                      <li>· The exact day of the change — only that it was visible by 1 Jun 2024.</li>
                      <li>· What was shown to other regions, plans or logged-in users.</li>
                    </ul>
                  </CardContent>
                </Card>
              </aside>
            </div>

            <section aria-labelledby="captures" className="mt-14 border-t border-border pt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="captures"
                    className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    <span className="mr-2 text-muted-foreground">02</span>
                    Capture log
                  </h2>
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                    Every archived page behind this report. Open any capture and check the claim
                    yourself — nothing here is a summary of a summary.
                  </p>
                </div>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {captures.length} captures
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
                <ul aria-live="polite" className="divide-y divide-border">
                  {pageItems.map((capture, index) => (
                    <li
                      key={capture.ts}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-secondary font-mono text-[10.5px] text-muted-foreground">
                          {pageIndex * PAGE_SIZE + index + 1}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium">{capture.label}</p>
                          <p className="font-mono text-[10.5px] text-muted-foreground">
                            stripe.com/pricing
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://web.archive.org/web/${capture.ts}/https://stripe.com/pricing`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open capture
                          <ExternalLink />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              <Pagination className="mt-5 justify-start">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                      disabled={pageIndex === 0}
                    />
                  </PaginationItem>
                  {Array.from({ length: pageCount }).map((_, index) => (
                    <PaginationItem key={index}>
                      <PaginationLink
                        isActive={index === pageIndex}
                        onClick={() => setPageIndex(index)}
                        aria-label={`Page ${index + 1}`}
                      >
                        {index + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
                      disabled={pageIndex === pageCount - 1}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </section>
              </>
            )}
          </main>
        )}

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-[11.5px] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
            <span>
              {live
                ? `Sources: Internet Archive Wayback Machine · ${live.captures.length} captures of ${live.domain}${live.path}`
                : 'Sources: Internet Archive Wayback Machine · 3 captures, 2019 – 2024'}
            </span>
            <div className="flex items-center gap-4">
              <button onClick={() => setView('system')} className="hover:text-foreground">
                Components
              </button>
              <Separator orientation="vertical" className="h-3" />
              <span className="font-mono uppercase tracking-[0.14em]">No causal claims</span>
            </div>
          </div>
        </footer>

        <Dialog open={isDialogOpen} onOpenChange={(value) => !value && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription>
                {active.sourceLabel} · {active.datePrecision}
              </DialogDescription>
            </DialogHeader>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-foreground/80">
              {active.detail}
            </p>

            <div className="mt-5 overflow-auto rounded-xl border border-border bg-white">
              <img
                src={active.image}
                alt={active.imageAlt}
                className={`w-full transition-transform duration-300 ${zoom ? 'origin-top-left scale-[1.6]' : ''}`}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setZoom((value) => !value)}>
                <ZoomIn />
                {zoom ? 'Reset zoom' : 'Zoom in'}
              </Button>
              <Button variant="link" asChild>
                <a href={active.source} target="_blank" rel="noreferrer">
                  Open in Wayback
                  <ExternalLink />
                </a>
              </Button>
              <Badge variant={active.confidence === 'high' ? 'good' : 'warn'}>
                {active.confidence} confidence
              </Badge>
              <span className="text-[11.5px] text-muted-foreground">
                {active.confidence === 'medium'
                  ? 'State observed; exact change date unknown'
                  : 'Comparable pair, both pages verified'}
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-secondary/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                What this does not prove
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-foreground/80">
                {active.doesNotProve}
              </p>
            </div>

            <DialogPrimitive.Close className="sr-only">Close</DialogPrimitive.Close>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
