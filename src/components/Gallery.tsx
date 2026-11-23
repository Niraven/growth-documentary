import { useState } from 'react'
import { ArrowUpRight, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function Gallery({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(1)
  const pages = 5
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 md:px-8">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            System sheet
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.02em]">Components</h1>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to report
        </Button>
      </div>

      <section className="mt-10 space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="mr-2 text-muted-foreground">01</span>Type
        </p>
        <Card>
          <CardContent className="grid gap-8 pt-1 md:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="font-display text-[56px] leading-[0.9] tracking-[-0.04em]">
                Fraunces
                <span className="block text-[26px] italic text-muted-foreground">for the claim</span>
              </p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Display · variable · 400–700
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-[15px] leading-relaxed">
                Instrument Sans carries the body. Tall x-height, narrow counters — readable at 13px
                in dense evidence notes.
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                10 Jun 2019 · 2.9% + 30¢ · [E1]
              </p>
              <div className="flex items-center gap-3">
                <img src={`${import.meta.env.BASE_URL}icon.svg`} width={48} height={48} alt="" />
                <img src={`${import.meta.env.BASE_URL}icon.svg`} width={28} height={28} alt="" />
                <img src={`${import.meta.env.BASE_URL}icon.svg`} width={18} height={18} alt="" />
                <span className="text-[12px] text-muted-foreground">Mark at three sizes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="mr-2 text-muted-foreground">02</span>Buttons
        </p>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-1">
            <Button>
              Default
              <ArrowUpRight />
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">
              <Plus /> Small
            </Button>
            <Button size="icon" aria-label="Add">
              <Plus />
            </Button>
            <Button disabled>Disabled</Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="mr-2 text-muted-foreground">03</span>Badges
        </p>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-1">
            <Badge variant="good">
              <ShieldCheck /> High confidence
            </Badge>
            <Badge variant="warn">
              <ShieldCheck /> Medium confidence
            </Badge>
            <Badge variant="outline">Example · not verified</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="default">Default</Badge>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="mr-2 text-muted-foreground">04</span>Tabs, tooltip, toast
        </p>
        <Card>
          <CardContent className="space-y-6 pt-1">
            <Tabs defaultValue="one">
              <TabsList>
                <TabsTrigger value="one">Evidence</TabsTrigger>
                <TabsTrigger value="two">Share card</TabsTrigger>
                <TabsTrigger value="three" disabled>
                  Disabled
                </TabsTrigger>
              </TabsList>
              <TabsContent value="one" className="text-[13px] text-muted-foreground">
                Tab panels inherit the same border and radius tokens.
              </TabsContent>
              <TabsContent value="two" className="text-[13px] text-muted-foreground">
                Second panel.
              </TabsContent>
            </Tabs>
            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Hover for tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">High confidence</p>
                  <p className="mt-1 text-paper/70">
                    A comparable before/after pair, both pages verified in the archive.
                  </p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success('Source link copied', {
                    description: 'Wayback capture · 2 May 2024',
                    action: { label: 'Open', onClick: () => undefined },
                  })
                }
              >
                Fire a toast
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="mr-2 text-muted-foreground">05</span>Pagination
        </p>
        <Card>
          <CardContent className="space-y-4 pt-1">
            <p className="text-[13px] text-muted-foreground">
              Page {page} of {pages}. Current page carries <code className="font-mono text-[12px]">aria-current=&quot;page&quot;</code>.
            </p>
            <Pagination className="justify-start">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={page === 1}
                  />
                </PaginationItem>
                {Array.from({ length: pages }).map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      isActive={page === index + 1}
                      onClick={() => setPage(index + 1)}
                      aria-label={`Page ${index + 1}`}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((value) => Math.min(pages, value + 1))}
                    disabled={page === pages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="mr-2 text-muted-foreground">06</span>Cards
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Evidence card</CardTitle>
            </CardHeader>
            <CardContent className="text-[13px] leading-relaxed text-muted-foreground">
              20px radius, one hairline border, a 1px shadow. No nested cards.
            </CardContent>
          </Card>
          <Card className="border-accent/25 bg-accent/60">
            <CardHeader>
              <CardTitle className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent-foreground">
                Caveat card
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[12px] leading-relaxed text-ink/75">
              States what the evidence cannot support. Never optional.
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
