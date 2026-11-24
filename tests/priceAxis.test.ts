import { describe, expect, it } from 'vitest'
import { priceAxis } from '../src/lib/priceAxis'

describe('priceAxis', () => {
  it.each([
    [3, 1, 3],
    [5, 2, 6],
    [349, 100, 400],
    [1500, 500, 1500],
    [2500, 1000, 3000],
    [3000, 1000, 3000],
    [5000, 2000, 6000],
    [9500, 5000, 10000],
  ])('keeps %i readable with step %i and top %i', (maxValue, step, max) => {
    const axis = priceAxis(maxValue)
    expect(axis.step).toBe(step)
    expect(axis.max).toBe(max)
    expect(axis.ticks[0]).toBe(0)
    expect(axis.ticks[axis.ticks.length - 1]).toBe(max)
    expect(axis.ticks.length).toBeLessThanOrEqual(7)
    expect(axis.max).toBeGreaterThanOrEqual(maxValue)
  })
})
