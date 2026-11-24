import { Grid3X3 } from 'lucide-react'
import type { Capture, Change } from '../../shared/timeline'
import { buildChangeMatrix } from '../../shared/changeMatrix'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const W = 720
const LABEL_W = 92
const ROW_H = 28
const TOP = 30
const HEADER_H = 20
const H = TOP + ROW_H * 3 + 10

const cellOpacity = (count: number): number => {
  if (count === 0) return 0.08
  if (count === 1) return 0.28
  if (count === 2) return 0.5
  return 0.76
}

/**
 * A change is a field observation on a date, not a continuous measurement.
 * The matrix makes the shape of the record visible without inventing a line
 * between months that were never read.
 *
 * It is drawn as one SVG so every cell and label shares the same x scale; an
 * HTML table lets long month labels resize the columns.
 */
export function ChangeMatrix({ captures, changes }: { captures: Capture[]; changes: Change[] }) {
  const matrix = buildChangeMatrix(captures, changes)
  const slot = matrix.months.length > 0 ? (W - LABEL_W - 8) / matrix.months.length : 0
  const cellW = Math.max(4, slot - 3)

  return (
    <Card data-testid="change-matrix" className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <Grid3X3 className="size-3.5" />
          Change matrix
        </CardTitle>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {matrix.total} observation{matrix.total === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {matrix.total === 0 ? (
          <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            No comparable field changes in this span. The matrix is empty; it is not a claim that
            nothing happened between the captures.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto pb-1">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-auto w-full min-w-[660px] text-foreground"
                role="img"
                aria-label={`Change matrix for page title, headline and price string from ${
                  matrix.months[0]?.label ?? ''
                } to ${matrix.months[matrix.months.length - 1]?.label ?? ''}. ${matrix.total} observations.`}
              >
                <title>Field changes by calendar month</title>
                {matrix.months.map((month, index) => {
                  if (index % 3 !== 0 && index !== matrix.months.length - 1) return null
                  const x = LABEL_W + index * slot + 1.5 + cellW / 2
                  return (
                    <g key={`label-${month.key}`}>
                      <text
                        x={x}
                        y={14}
                        textAnchor="middle"
                        className="fill-current text-[9px] uppercase tracking-[0.06em] text-muted-foreground"
                      >
                        {month.label}
                      </text>
                      <line
                        x1={x}
                        x2={x}
                        y1={16}
                        y2={20}
                        stroke="currentColor"
                        strokeOpacity={0.2}
                      />
                    </g>
                  )
                })}
                {matrix.rows.map((row, rowIndex) => {
                  const y = TOP + rowIndex * ROW_H
                  return (
                    <g key={row.field}>
                      <text
                        x={0}
                        y={y + 13}
                        className="fill-current text-[11.5px] font-medium text-muted-foreground"
                      >
                        {row.label}
                      </text>
                      {row.counts.map((count, index) => {
                        const x = LABEL_W + index * slot + 1.5
                        const month = matrix.months[index]
                        return (
                          <g key={`${row.field}-${month.key}`}>
                            <title>
                              {`${row.label} · ${month.label}: ${count} observation${count === 1 ? '' : 's'}`}
                            </title>
                            <rect
                              x={x}
                              y={y}
                              width={cellW}
                              height={18}
                              rx={2}
                              fill="currentColor"
                              fillOpacity={cellOpacity(count)}
                              stroke="currentColor"
                              strokeOpacity={count === 0 ? 0.16 : 0.05}
                              strokeWidth={1}
                            />
                            {count > 0 ? (
                              <text
                                x={x + cellW / 2}
                                y={y + 12.5}
                                textAnchor="middle"
                                className="text-[8.5px] font-medium"
                                fill="var(--background)"
                              >
                                {count}
                              </text>
                            ) : null}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
                {matrix.months.map((month, index) => {
                  if (index === 0 || !month.key.endsWith('-01')) return null
                  const x = LABEL_W + index * slot
                  return (
                    <line
                      key={`year-${month.key}`}
                      x1={x}
                      x2={x}
                      y1={HEADER_H}
                      y2={H - 8}
                      stroke="currentColor"
                      strokeOpacity={0.16}
                      strokeDasharray="2 3"
                    />
                  )
                })}
              </svg>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <p>One cell per calendar month; empty months stay visible.</p>
              <div className="flex items-center gap-2">
                <span>Fewer</span>
                <span className="size-3 rounded-[2px] border border-border bg-foreground/[0.08]" />
                <span className="size-3 rounded-[2px] bg-foreground/[0.28]" />
                <span className="size-3 rounded-[2px] bg-foreground/50" />
                <span className="size-3 rounded-[2px] bg-foreground/75" />
                <span>More</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
