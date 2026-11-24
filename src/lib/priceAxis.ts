export type PriceAxis = {
  step: number
  max: number
  ticks: number[]
}

/**
 * A 1/2/5 × 10^n axis with roughly four intervals. The top is rounded up so
 * the highest bar never sits on the top gridline.
 */
export function priceAxis(maxValue: number): PriceAxis {
  const rough = maxValue / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  const max = Math.max(step, Math.ceil(maxValue / step) * step)
  const count = Math.round(max / step)
  return { step, max, ticks: Array.from({ length: count + 1 }, (_, index) => index * step) }
}
