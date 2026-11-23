import { describe, expect, it } from 'vitest'
import type { Timeline } from '../shared/timeline'
import { reportCsv, reportJson, reportSlug } from '../src/lib/export'

const report: Timeline = {
  domain: 'www.example.com',
  path: '/pricing',
  captures: [],
  changes: [
    {
      ts: '20240101000000',
      label: '1 Jan 2024',
      field: 'first capture',
      before: '',
      after: 'Pricing',
      url: 'https://web.archive.org/web/20240101000000/example.com/pricing',
    },
    {
      ts: '20240102000000',
      label: '2 Jan 2024',
      field: 'headline',
      before: 'Simple, "honest" pricing',
      after: '=HYPERLINK("https://evil.test")',
      url: 'https://web.archive.org/web/20240102000000/example.com/pricing',
    },
  ],
  coverage: {
    from: '20240101000000',
    to: '20240102000000',
    months: 1,
    sampled: 2,
    available: 2,
    strategy: 'adaptive',
  },
  checkedAt: '2026-11-24T00:00:00.000Z',
}

describe('reportCsv', () => {
  it('writes a header, a baseline label and one row per change', () => {
    const lines = reportCsv(report).trim().split('\r\n')
    expect(lines[0]).toBe('date,timestamp,field,before,after,capture_url')
    expect(lines[1]).toContain('baseline')
    expect(lines[2]).toContain('headline')
    expect(lines).toHaveLength(3)
  })

  it('escapes quotes and commas', () => {
    expect(reportCsv(report)).toContain('"Simple, ""honest"" pricing"')
  })

  it('neutralises a formula in a field value', () => {
    expect(reportCsv(report)).toContain(`"'=HYPERLINK(""https://evil.test"")"`)
  })
})

describe('reportJson', () => {
  it('exports the full report with an export timestamp', () => {
    const parsed = JSON.parse(reportJson(report)) as {
      source: string
      exportedAt: string
      report: Timeline
    }
    expect(parsed.source).toBe('growth-documentary')
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false)
    expect(parsed.report.domain).toBe('www.example.com')
  })
})

describe('reportSlug', () => {
  it('produces a filesystem-safe name', () => {
    expect(reportSlug(report)).toBe('example-com-pricing')
  })
})
