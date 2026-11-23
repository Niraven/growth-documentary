import { describe, expect, it } from 'vitest'
import type { Timeline } from '../shared/timeline'
import { citationFor } from '../src/lib/citation'

const report: Timeline = {
  domain: 'basecamp.com',
  path: '/pricing',
  captures: [
    {
      ts: '20241214215555',
      label: '14 Dec 2024',
      title: 'Basecamp: Pricing',
      h1: 'Simple pricing',
      prices: ['$99/mo'],
      url: 'https://web.archive.org/web/20241214215555/https://basecamp.com/pricing',
    },
    {
      ts: '20261118020945',
      label: '18 Nov 2026',
      title: 'Basecamp — Pricing',
      h1: 'Clear pricing',
      prices: ['$99/mo'],
      url: 'https://web.archive.org/web/20261118020945/https://basecamp.com/pricing',
    },
  ],
  changes: [
    {
      ts: '20241214215555',
      label: '14 Dec 2024',
      field: 'first capture',
      before: '',
      after: 'Basecamp: Pricing',
      url: 'https://web.archive.org/web/20241214215555/https://basecamp.com/pricing',
    },
    {
      ts: '20261118020945',
      label: '18 Nov 2026',
      field: 'title',
      before: 'Basecamp: Pricing',
      after: 'Basecamp — Pricing',
      url: 'https://web.archive.org/web/20261118020945/https://basecamp.com/pricing',
    },
  ],
  coverage: {
    from: '20241214215555',
    to: '20261118020945',
    months: 24,
    sampled: 17,
    available: 392,
    strategy: 'adaptive',
  },
  checkedAt: '2026-11-24T00:00:00.000Z',
}

describe('citationFor', () => {
  it('states the window, sample size, field changes and access date', () => {
    const citation = citationFor(report, {
      accessed: new Date('2026-11-24T06:00:00.000Z'),
      link: 'https://example.test/#report/abc12345',
    })
    expect(citation).toContain('"basecamp.com/pricing"')
    expect(citation).toContain('14 Dec 2024 to 18 Nov 2026')
    expect(citation).toContain('17 archived captures read; 1 field change')
    expect(citation).toContain('Internet Archive Wayback Machine')
    expect(citation).toContain('Accessed 24 Nov 2026')
    expect(citation).toContain('https://example.test/#report/abc12345')
  })

  it('falls back to the last capture when no link is supplied', () => {
    expect(citationFor(report, { accessed: new Date('2026-11-24T00:00:00.000Z') })).toContain(
      report.captures[1].url,
    )
  })
})
