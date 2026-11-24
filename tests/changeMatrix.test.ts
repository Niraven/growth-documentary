import { describe, expect, it } from 'vitest'
import type { Capture, Change } from '../shared/timeline'
import { buildChangeMatrix } from '../shared/changeMatrix'

const capture = (ts: string): Capture => ({
  ts,
  label: ts,
  title: '',
  h1: '',
  prices: [],
  url: `https://web.archive.org/web/${ts}/https://example.com/`,
})

const change = (ts: string, field: Change['field']): Change => ({
  ts,
  label: ts,
  field,
  before: 'before',
  after: 'after',
  url: `https://web.archive.org/web/${ts}/https://example.com/`,
})

describe('buildChangeMatrix', () => {
  it('keeps empty calendar months and counts fields by month', () => {
    const matrix = buildChangeMatrix(
      [capture('20241115000000'), capture('20250110000000'), capture('20250301000000')],
      [
        change('20241115000000', 'first capture'),
        change('20250110000000', 'headline'),
        change('20250110000000', 'price'),
        change('20250301000000', 'title'),
      ],
    )
    expect(matrix.months.map((month) => month.key)).toEqual(['2024-11', '2024-12', '2025-01', '2025-02', '2025-03'])
    expect(matrix.rows.find((row) => row.field === 'headline')?.counts).toEqual([0, 0, 1, 0, 0])
    expect(matrix.rows.find((row) => row.field === 'price')?.counts).toEqual([0, 0, 1, 0, 0])
    expect(matrix.rows.find((row) => row.field === 'title')?.counts).toEqual([0, 0, 0, 0, 1])
    expect(matrix.total).toBe(3)
  })

  it('does not invent a matrix without captures', () => {
    expect(buildChangeMatrix([], [])).toEqual({ months: [], rows: [], total: 0 })
  })
})
