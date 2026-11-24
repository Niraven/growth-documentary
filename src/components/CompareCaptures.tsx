import { useState } from 'react'
import { GitCompareArrows } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { Capture } from '../../shared/timeline'
import { compareCaptures, charDiff, wordDiff, type DiffPart } from '../../shared/compare'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

function DiffSide({
  label,
  capture,
  parts,
  spaced = true,
}: {
  label: string
  capture: Capture
  parts: DiffPart[]
  spaced?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {label} · {capture.label}
      </p>
      <p aria-hidden className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">
        {parts.map((part, index) => (
          <span key={`${part.kind}-${index}-${part.text}`}>
            {part.kind === 'removed' ? (
              <del className="rounded-[2px] bg-destructive/10 text-foreground/80 decoration-destructive decoration-2">
                {part.text}
              </del>
            ) : part.kind === 'added' ? (
              <ins className="rounded-[2px] bg-foreground/10 px-0.5 font-medium text-foreground no-underline">
                {part.text}
              </ins>
            ) : (
              part.text
            )}
            {spaced && index < parts.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    </div>
  )
}

function FieldDiff({
  label,
  before,
  after,
  captureBefore,
  captureAfter,
  mode = 'word',
}: {
  label: string
  before: string
  after: string
  captureBefore: Capture
  captureAfter: Capture
  mode?: 'word' | 'char'
}) {
  const raw = mode === 'char' ? charDiff(before, after) : wordDiff(before, after)
  let beforeParts = raw.filter((part) => part.kind !== 'added')
  let afterParts = raw.filter((part) => part.kind !== 'removed')

  if (mode === 'word') {
    const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
    const shared = raw
      .filter((part) => part.kind === 'same')
      .reduce((total, part) => total + words(part.text), 0)
    const longest = Math.max(words(before), words(after))
    // Incidental shared words ("up", "sign") should not make a wholesale
    // replacement look like a partial edit. Mark the two states whole.
    if (longest > 0 && shared / longest < 0.35) {
      beforeParts = [{ text: before, kind: 'removed' }]
      afterParts = [{ text: after, kind: 'added' }]
    }
  }
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="sr-only">
        Before: {before || 'empty'} — after: {after || 'empty'}
      </p>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <DiffSide
          label="Before"
          capture={captureBefore}
          parts={beforeParts}
          spaced={mode === 'word'}
        />
        <DiffSide
          label="After"
          capture={captureAfter}
          parts={afterParts}
          spaced={mode === 'word'}
        />
      </div>
    </div>
  )
}

const selectClass =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

export function CompareCaptures({ captures }: { captures: Capture[] }) {
  const [fromIndex, setFromIndex] = useState(0)
  const [toIndex, setToIndex] = useState(Math.max(0, captures.length - 1))
  const reduce = useReducedMotion()

  if (captures.length < 2) return <p>Comparing dates takes two readable captures. This report has fewer than two.</p>

  const before = captures[fromIndex] ?? captures[0]
  const after = captures[toIndex] ?? captures[captures.length - 1]
  const comparison = compareCaptures(before, after)

  const changeFrom = (next: number) => {
    setFromIndex(next)
    if (next >= toIndex) setToIndex(Math.min(captures.length - 1, next + 1))
  }

  const changeTo = (next: number) => {
    setToIndex(next)
    if (next <= fromIndex) setFromIndex(Math.max(0, next - 1))
  }

  return (
    <Card className="mt-3" data-testid="compare-captures">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="size-4 text-muted-foreground" />
            <h2 className="section-title">Compare captures</h2>
          </div>
          <Badge variant={comparison.changed ? 'good' : 'outline'}>
            {comparison.changed
              ? `${comparison.fields.length} ${comparison.fields.length === 1 ? 'field differs' : 'fields differ'}`
              : 'No comparable difference'}
          </Badge>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Before
            </span>
            <select
              className={selectClass}
              value={fromIndex}
              onChange={(event) => changeFrom(Number(event.target.value))}
            >
              {captures.slice(0, -1).map((capture, index) => (
                <option key={capture.ts} value={index}>
                  {capture.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              After
            </span>
            <select
              className={selectClass}
              value={toIndex}
              onChange={(event) => changeTo(Number(event.target.value))}
            >
              {captures.slice(1).map((capture, index) => (
                <option key={capture.ts} value={index + 1}>
                  {capture.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div aria-live="polite" className="mt-4 border-t border-border/70 pt-4">
          <motion.div
            key={`${before.ts}-${after.ts}`}
            initial={reduce ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {!comparison.changed ? (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                These two captures match in the fields this tool reads. That is not proof nothing
                changed between them — only proof that these three fields did not.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                  <del className="rounded-[2px] bg-destructive/5 px-1 decoration-destructive/50">
                    removed text
                  </del>
                  <ins className="rounded-[2px] bg-foreground/10 px-1 no-underline">
                    added text
                  </ins>
                </div>
                {comparison.titleChanged && (
                  <FieldDiff
                    label="Page title"
                    before={before.title}
                    after={after.title}
                    captureBefore={before}
                    captureAfter={after}
                    mode="char"
                  />
                )}
                {comparison.headlineChanged && (
                  <FieldDiff
                    label="Headline"
                    before={before.h1}
                    after={after.h1}
                    captureBefore={before}
                    captureAfter={after}
                  />
                )}
                {comparison.price.comparable &&
                  (comparison.price.added.length > 0 || comparison.price.removed.length > 0) && (
                    <div>
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                        Price strings
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {comparison.price.removed.map((price) => (
                          <span
                            key={`removed-${price}`}
                            className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground"
                          >
                            Removed
                            <span className="font-mono text-[11.5px] line-through decoration-destructive/50">
                              {price}
                            </span>
                          </span>
                        ))}
                        {comparison.price.added.map((price) => (
                          <span
                            key={`added-${price}`}
                            className="inline-flex items-baseline gap-1.5 rounded-md border border-foreground/20 bg-foreground/5 px-2 py-0.5 text-[10px]"
                          >
                            Added
                            <span className="font-mono text-[11.5px] font-medium">{price}</span>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                          <span className="font-mono uppercase tracking-[0.12em]">Before · </span>
                          {comparison.price.before.join(', ') || '—'}
                        </p>
                        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                          <span className="font-mono uppercase tracking-[0.12em]">After · </span>
                          {comparison.price.after.join(', ') || '—'}
                        </p>
                      </div>
                      <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                        Strings are quoted exactly as archived, including any amount without a
                        billing period.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </motion.div>
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Two archived captures, compared field by field. This is not a claim about what happened
          between them.{' '}
          <a
            href={before.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Before capture
          </a>{' '}
          ·{' '}
          <a
            href={after.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-4 hover:text-foreground"
          >
            After capture
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
