import { useState } from 'react'
import type { Capture, Change } from '../../shared/timeline'
import { monthlyBuckets } from '../../shared/compare'
import { Card, CardContent } from '@/components/ui/card'
import { priceAxis } from '@/lib/priceAxis'

const W = 720
const H = 260
const PAD = { left: 48, right: 18, top: 30, bottom: 58 }

const money = (amount: number): string => {
  const value = Math.round(amount * 100) / 100
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

const monthLabel = (ts: string): string =>
  new Date(Date.UTC(Number(ts.slice(0, 4)), Number(ts.slice(4, 6)) - 1, 1)).toLocaleDateString(
    'en-GB',
    { month: 'short', year: 'numeric', timeZone: 'UTC' },
  )

const shortMonth = (ts: string): string =>
  new Date(Date.UTC(Number(ts.slice(0, 4)), Number(ts.slice(4, 6)) - 1, 1)).toLocaleDateString(
    'en-GB',
    { month: 'short', timeZone: 'UTC' },
  )

export function PriceTrail({
  captures,
  changes = [],
}: {
  captures: Capture[]
  changes?: Change[]
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const series = monthlyBuckets(captures).map((bucket) => ({
    ...bucket,
    label: monthLabel(bucket.ts),
  }))

  if (series.length === 0) return null

  const all = series.flatMap((bucket) => bucket.values)
  const maxValue = Math.max(...all)
  const minValue = Math.min(...all)
  if (!Number.isFinite(maxValue) || maxValue <= 0) return null

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const plotBottom = PAD.top + plotH
  const latest = series[series.length - 1]
  const selected = series.find((bucket) => bucket.key === selectedKey) ?? latest

  // A readable axis: 3–6 ticks on a 1/2/5 × 10^n ladder, top rounded up.
  const axis = priceAxis(maxValue)
  const axisMax = maxValue
  const ticks = [...axis.ticks.filter((tick) => tick < axisMax - axis.step / 4), axisMax]

  const y = (value: number) => PAD.top + (1 - value / axisMax) * plotH

  const startYear = Number(series[0].ts.slice(0, 4))
  const startMonth = Number(series[0].ts.slice(4, 6))
  const endYear = Number(series[series.length - 1].ts.slice(0, 4))
  const endMonth = Number(series[series.length - 1].ts.slice(4, 6))
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1
  const slot = plotW / Math.max(totalMonths, 1)
  const monthIndex = (ts: string) =>
    (Number(ts.slice(0, 4)) - startYear) * 12 + (Number(ts.slice(4, 6)) - startMonth)
  const monthCenter = (ts: string) => PAD.left + (monthIndex(ts) + 0.5) * slot

  const yearBands: { year: number; left: number; right: number }[] = []
  for (let year = startYear; year <= endYear; year += 1) {
    const firstIndex = Math.max(0, (year - startYear) * 12 - (startMonth - 1))
    const lastIndex = Math.min(totalMonths - 1, (year - startYear) * 12 + (12 - startMonth))
    if (lastIndex < firstIndex) continue
    const left = PAD.left + firstIndex * slot
    const right = PAD.left + (lastIndex + 1) * slot
    yearBands.push({ year, left, right })
  }

  const priceChangeMonths = new Set(
    changes.filter((change) => change.field === 'price').map((change) => change.ts.slice(0, 6)),
  )

  const barWidth = Math.max(4, Math.min(12, slot * 0.45))

  return (
    <Card className="mt-3" data-testid="price-trail">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="section-title">Monthly price range · USD</h3>
          <p className="hidden font-mono text-xs text-muted-foreground sm:block">
            Selected {selected.label} · {money(selected.values[0])}–
            {money(selected.values[selected.values.length - 1])}/mo
          </p>
        </div>

        <figure className="mt-3">
          <label className="block sm:hidden">
            Inspect a month
            <select
              className="block min-h-11 w-full rounded-lg border bg-card px-3"
              value={selected.key}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {series.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label} · {money(b.values[0])}–{money(b.values[b.values.length - 1])}/mo
                </option>
              ))}
            </select>
          </label>
          <div className="plot-key max-sm:hidden" aria-label="Price chart key">
            <span>
              <i className="range-key" />
              Monthly low–high
            </span>
            <span>
              <b aria-hidden="true">▼</b> Price-string change
            </span>
            <span>
              <i className="selected-key" />
              Selected month
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full text-foreground max-sm:hidden"
            role="group"
            aria-label={`Monthly price range: ${series.length} months with monthly price strings, from ${money(minValue)} to ${money(maxValue)} per month. Each bar spans the lowest and highest monthly amount read in that month; a triangle above the plot marks a month with a price-change row.`}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  strokeDasharray="2 4"
                />
                <text
                  x={PAD.left - 10}
                  y={y(tick) + 3}
                  textAnchor="end"
                  className="fill-current font-mono text-[11px] text-muted-foreground"
                  fillOpacity={1}
                >
                  {money(tick)}
                </text>
              </g>
            ))}

            {Array.from({ length: totalMonths }, (_, index) => (
              <line
                key={`grid-${index}`}
                x1={PAD.left + index * slot}
                x2={PAD.left + index * slot}
                y1={PAD.top}
                y2={plotBottom}
                stroke="currentColor"
                strokeOpacity={0.045}
              />
            ))}

            {yearBands.map(({ year, left }) => (
              <g key={year}>
                {left > PAD.left + 1 && (
                  <line
                    x1={left}
                    x2={left}
                    y1={PAD.top}
                    y2={plotBottom}
                    stroke="currentColor"
                    strokeOpacity={0.12}
                    strokeDasharray="2 5"
                  />
                )}
              </g>
            ))}

            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={plotBottom}
              y2={plotBottom}
              stroke="currentColor"
              strokeOpacity={0.3}
            />

            {series.map((bucket) => {
              const isSelected = bucket.key === selected.key
              const cx = monthCenter(bucket.ts)
              const low = bucket.values[0]
              const high = bucket.values[bucket.values.length - 1]
              return (
                <g
                  key={bucket.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${bucket.label}: ${money(low)} to ${money(high)} per month, ${bucket.values.length} distinct monthly amounts`}
                  className="cursor-pointer outline-none"
                  onClick={() => setSelectedKey(bucket.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedKey(bucket.key)
                    }
                  }}
                >
                  <title>{`${bucket.label}: ${money(low)}–${money(high)}/mo`}</title>
                  <rect
                    x={cx - 10}
                    y={y(high) - 4}
                    width={20}
                    height={Math.max(8, y(low) - y(high) + 8)}
                    fill="transparent"
                  />
                  <rect
                    x={cx - barWidth / 2}
                    y={y(high)}
                    width={barWidth}
                    height={Math.max(1, y(low) - y(high))}
                    fill="currentColor"
                    fillOpacity={isSelected ? 1 : 0.62}
                    stroke="currentColor"
                    strokeOpacity={isSelected ? 0.8 : 0.3}
                    strokeWidth={isSelected ? 1 : 0.5}
                  />
                  {Array.from(new Set([low, high])).map((value) => (
                    <line
                      key={`cap-${value}`}
                      x1={cx - barWidth / 2 - 2}
                      x2={cx + barWidth / 2 + 2}
                      y1={y(value)}
                      y2={y(value)}
                      stroke="currentColor"
                      strokeOpacity={isSelected ? 0.95 : 0.55}
                      strokeWidth={1}
                    />
                  ))}
                  <circle
                    cx={cx}
                    cy={y(low)}
                    r={isSelected ? 3 : 1.5}
                    fill="currentColor"
                    fillOpacity={isSelected ? 0.95 : 0.5}
                  />
                  <circle
                    cx={cx}
                    cy={y(high)}
                    r={isSelected ? 3 : 1.5}
                    fill="currentColor"
                    fillOpacity={isSelected ? 0.95 : 0.5}
                  />
                </g>
              )
            })}

            {[...priceChangeMonths].map((key) => {
              const ts = `${key}01000000`
              const index = monthIndex(ts)
              if (!Number.isInteger(index) || index < 0 || index >= totalMonths) return null
              const cx = monthCenter(ts)
              return (
                <g key={`change-${key}`}>
                  <title>{`Price-change row observed in ${monthLabel(ts)}`}</title>
                  <polygon
                    points={`${cx},${PAD.top - 2} ${cx + 3},${PAD.top - 8} ${cx - 3},${PAD.top - 8}`}
                    fill="currentColor"
                    fillOpacity={1}
                  />
                </g>
              )
            })}

            {series.map((bucket, index) => {
              const cx = monthCenter(bucket.ts)
              const labelEvery = slot < 18 ? 2 : 1
              if (index % labelEvery !== 0 && index !== series.length - 1) return null
              const anchor = 'middle'
              return (
                <g key={`tick-${bucket.key}`}>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={plotBottom}
                    y2={plotBottom + 3}
                    stroke="currentColor"
                    strokeOpacity={0.35}
                  />
                  <text
                    x={cx}
                    y={H - 20}
                    textAnchor={anchor}
                    className="fill-current font-mono text-[10px] text-muted-foreground"
                    fillOpacity={1}
                  >
                    {shortMonth(bucket.ts)}
                  </text>
                  <text
                    x={cx}
                    y={H - 9}
                    textAnchor={anchor}
                    className="fill-current font-mono text-[10px] text-muted-foreground"
                    fillOpacity={1}
                  >
                    {`'${bucket.ts.slice(2, 4)}`}
                  </text>
                </g>
              )
            })}
          </svg>

          <figcaption className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-muted-foreground">
            Monthly amounts read in archived copy, not matched plan prices. Annual, one-time and
            per-seat rates are excluded.{' '}
            <span className="max-sm:hidden">Blank months have no monthly read.</span>
          </figcaption>

          <div className="mt-2 space-y-1" aria-live="polite">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Amounts read in {selected.label}: {selected.values.map(money).join(' · ')}
            </p>
          </div>

          <div className="sr-only">
            <table>
              <caption>Monthly price range by month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Lowest</th>
                  <th scope="col">Highest</th>
                  <th scope="col">Distinct monthly amounts</th>
                </tr>
              </thead>
              <tbody>
                {series.map((bucket) => (
                  <tr key={bucket.key}>
                    <th scope="row">{bucket.label}</th>
                    <td>{money(bucket.values[0])}</td>
                    <td>{money(bucket.values[bucket.values.length - 1])}</td>
                    <td>{bucket.values.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      </CardContent>
    </Card>
  )
}
