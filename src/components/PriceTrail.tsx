import { tsToMs, type Capture } from '../../shared/timeline'
import { monthlyPrices } from '../../shared/compare'
import { Card, CardContent } from '@/components/ui/card'

const W = 720
const H = 210
const PAD = { left: 46, right: 18, top: 18, bottom: 34 }

const money = (amount: number): string =>
  amount >= 1000 ? `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(amount)}`

const monthLabel = (ts: string): string =>
  new Date(Date.UTC(Number(ts.slice(0, 4)), Number(ts.slice(4, 6)) - 1, 1)).toLocaleDateString(
    'en-GB',
    { month: 'short', year: 'numeric', timeZone: 'UTC' },
  )

type Bucket = { key: string; ts: string; label: string; values: number[] }

/**
 * One bar per month, not per capture: several captures in the same month would
 * otherwise sit on top of each other and imply a series that cannot be read.
 * Values inside a bar are the union of monthly strings read that month.
 */
const byMonth = (captures: Capture[]): Bucket[] => {
  const buckets = new Map<string, Bucket>()
  for (const capture of captures) {
    const values = monthlyPrices(capture.prices)
    if (values.length === 0) continue
    const key = capture.ts.slice(0, 6)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, ts: `${key}01000000`, label: monthLabel(capture.ts), values: [] }
      buckets.set(key, bucket)
    }
    for (const value of values) if (!bucket.values.includes(value)) bucket.values.push(value)
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({ ...bucket, values: bucket.values.sort((a, b) => a - b) }))
}

export function PriceTrail({ captures }: { captures: Capture[] }) {
  const series = byMonth(captures)
  if (series.length < 2) return null

  const all = series.flatMap((bucket) => bucket.values)
  const maxValue = Math.max(...all)
  const minValue = Math.min(...all)
  if (!Number.isFinite(maxValue) || maxValue <= 0) return null

  const start = tsToMs(series[0].ts)
  const end = tsToMs(series[series.length - 1].ts)
  const span = Math.max(1, end - start)
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const latest = series[series.length - 1]
  const axisMax = Math.max(50, Math.ceil(maxValue / 50) * 50)
  const step = axisMax > 200 ? 100 : 50
  const ticks = Array.from({ length: Math.floor(axisMax / step) + 1 }, (_, index) => index * step)
  if (ticks[ticks.length - 1] !== axisMax) ticks.push(axisMax)

  const x = (ts: string) => PAD.left + ((tsToMs(ts) - start) / span) * plotW
  const y = (value: number) => PAD.top + (1 - value / axisMax) * plotH

  return (
    <Card className="mt-3" data-testid="price-trail">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Monthly price range · by month
          </p>
          <p className="font-mono text-[10.5px] text-muted-foreground">
            Latest {money(latest.values[0])}–{money(latest.values[latest.values.length - 1])}/mo
          </p>
        </div>

        <figure className="mt-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full text-foreground"
            role="img"
            aria-label={`Monthly price range: ${series.length} months with monthly price strings, from ${money(minValue)} to ${money(maxValue)} per month. Each bar groups the captures read in one month and spans its lowest and highest monthly amount.`}
          >
            <text
              x={PAD.left - 8}
              y={PAD.top - 6}
              textAnchor="end"
              className="fill-current font-mono text-[8.5px] text-muted-foreground"
              fillOpacity={0.5}
            >
              USD/mo
            </text>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  strokeDasharray="2 4"
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick) + 3}
                  textAnchor="end"
                  className="fill-current font-mono text-[9px] text-muted-foreground"
                  fillOpacity={0.55}
                >
                  {money(tick)}
                </text>
              </g>
            ))}

            {series.map((bucket, index) => {
              const isLatest = index === series.length - 1
              const cx = x(bucket.ts)
              const low = bucket.values[0]
              const high = bucket.values[bucket.values.length - 1]
              return (
                <g key={bucket.key}>
                  <title>{`${bucket.label}: ${money(low)}–${money(high)}/mo`}</title>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={y(low)}
                    y2={y(high)}
                    stroke="currentColor"
                    strokeOpacity={isLatest ? 0.65 : 0.38}
                    strokeWidth={isLatest ? 2.5 : 2}
                  />
                  {[low, high].map((value) => (
                    <line
                      key={`cap-${value}`}
                      x1={cx - 4}
                      x2={cx + 4}
                      y1={y(value)}
                      y2={y(value)}
                      stroke="currentColor"
                      strokeOpacity={isLatest ? 0.8 : 0.5}
                      strokeWidth={1.5}
                    />
                  ))}
                </g>
              )
            })}

            <text
              x={PAD.left}
              y={H - 10}
              className="fill-current font-mono text-[9px] text-muted-foreground"
              fillOpacity={0.55}
            >
              {series[0].label}
            </text>
            <text
              x={W - PAD.right}
              y={H - 10}
              textAnchor="end"
              className="fill-current font-mono text-[9px] text-muted-foreground"
              fillOpacity={0.55}
            >
              {series[series.length - 1].label}
            </text>
          </svg>

          <figcaption className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-muted-foreground">
            Each bar groups the captures read in one month: its lowest and highest{' '}
            <em>monthly</em> price string. Annual, one-time and per-seat amounts are excluded. Tiers
            change, so this is a range per month — not a price index or a single price over time.
          </figcaption>

          <table className="sr-only">
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
        </figure>
      </CardContent>
    </Card>
  )
}
