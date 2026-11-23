import { describe, expect, it } from 'vitest'
import {
  buildTimeline,
  diffCaptures,
  extractCapture,
  labelFor,
  normaliseTarget,
  pricesIn,
  stripHtml,
  TimelineError,
  type Capture,
  type FetchLike,
} from '../server/core'

const capture = (ts: string, overrides: Partial<Capture> = {}): Capture => ({
  ts,
  label: labelFor(ts),
  title: 'Pricing',
  h1: 'Simple pricing',
  prices: ['$10/mo'],
  url: `https://web.archive.org/web/${ts}/example.com/pricing`,
  ...overrides,
})

describe('labelFor', () => {
  it('formats a Wayback timestamp as a UTC day', () => {
    expect(labelFor('20240104213453')).toBe('4 Jan 2024')
    expect(labelFor('20190610230932')).toBe('10 Jun 2019')
  })
})

describe('stripHtml', () => {
  it('removes scripts, styles and tags, and decodes common entities', () => {
    const html =
      '<style>.x{}</style><script>alert(1)</script><h1>Hello &amp; welcome</h1><p>Fish&nbsp;&amp;&nbsp;chips</p>'
    expect(stripHtml(html)).toBe('Hello & welcome Fish & chips')
  })
})

describe('pricesIn', () => {
  it('keeps real prices, drops per-unit cents, dedupes, caps at six', () => {
    const html = `
      <p>$0.49 per request</p>
      <p>$10/mo</p>
      <p>$10/mo</p>
      <p>$99</p>
      <p>$1,200 /year</p>
      <p>$5</p><p>$6</p><p>$7</p><p>$8</p>
      <p>$999999</p>
    `
    expect(pricesIn(html)).toEqual(['$10/mo', '$99', '$1,200 /year', '$5', '$6', '$7'])
  })

  it('returns nothing when a page has no prices', () => {
    expect(pricesIn('<h1>Talk to us</h1>')).toEqual([])
  })
})

describe('normaliseTarget', () => {
  it('adds https, strips fragments and trailing slashes', () => {
    const url = normaliseTarget('  example.com/pricing/#plans ')
    expect(url.href).toBe('https://example.com/pricing')
    expect(url.pathname).toBe('/pricing')
  })

  it('keeps a bare domain as /', () => {
    expect(normaliseTarget('example.com').pathname).toBe('/')
  })

  it('rejects empty input', () => {
    expect(() => normaliseTarget('   ')).toThrow(TimelineError)
    expect(() => normaliseTarget('   ')).toThrow(/Enter a domain/)
  })

  it('rejects non-http protocols', () => {
    expect(() => normaliseTarget('ftp://example.com')).toThrow(/http and https/)
  })

  it('rejects hostnames without a dot', () => {
    expect(() => normaliseTarget('localhost')).toThrow(/public domain/)
  })

  it('rejects junk', () => {
    expect(() => normaliseTarget('not a url')).toThrow()
  })
})

describe('extractCapture', () => {
  it('reads the title, first h1 and prices without markup', () => {
    const html =
      '<html><head><title>Plans &amp; pricing</title></head><body><h1>Pick a plan</h1><p>$20/mo</p></body></html>'
    const result = extractCapture(html, '20200101000000', 'https://web.archive.org/web/20200101000000/example.com')
    expect(result.title).toBe('Plans & pricing')
    expect(result.h1).toBe('Pick a plan')
    expect(result.prices).toEqual(['$20/mo'])
    expect(result.label).toBe('1 Jan 2020')
  })

  it('uses empty strings when the page lacks a title or h1', () => {
    const result = extractCapture('<p>hello</p>', '20200101000000', 'u')
    expect(result.title).toBe('')
    expect(result.h1).toBe('')
  })
})

describe('diffCaptures', () => {
  it('always records the first capture', () => {
    const changes = diffCaptures([capture('20200101000000')])
    expect(changes).toHaveLength(1)
    expect(changes[0].field).toBe('first capture')
    expect(changes[0].after).toBe('Pricing')
  })

  it('records title, headline and price changes as separate rows', () => {
    const changes = diffCaptures([
      capture('20200101000000'),
      capture('20210101000000', {
        title: 'New pricing',
        h1: 'Plans for teams',
        prices: ['$20/mo'],
      }),
    ])
    expect(changes.map((change) => change.field)).toEqual([
      'first capture',
      'title',
      'headline',
      'price',
    ])
    expect(changes[3].before).toBe('$10/mo')
    expect(changes[3].after).toBe('$20/mo')
  })

  it('does not invent changes when nothing moved', () => {
    const changes = diffCaptures([capture('20200101000000'), capture('20210101000000')])
    expect(changes).toHaveLength(1)
  })

  it('ignores an empty field instead of reporting a deletion', () => {
    const changes = diffCaptures([
      capture('20200101000000'),
      capture('20210101000000', { title: '' }),
    ])
    expect(changes).toHaveLength(1)
  })
})

const mockFetch = (pages: Record<string, string>, cdx: string[][]): FetchLike => {
  return async (url) => {
    if (url.includes('/cdx/search/cdx')) {
      return {
        ok: true,
        status: 200,
        json: async () => cdx,
        text: async () => JSON.stringify(cdx),
      }
    }
    const key = Object.keys(pages).find((needle) => url.includes(needle))
    if (!key) {
      return { ok: false, status: 404, json: async () => null, text: async () => '' }
    }
    return { ok: true, status: 200, json: async () => null, text: async () => pages[key] }
  }
}

describe('buildTimeline', () => {
  const cdx = [
    ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode'],
    ['com,example)/pricing', '20200101000000', 'https://example.com/pricing', 'text/html', '200'],
    ['com,example)/pricing', '20210101000000', 'https://example.com/pricing', 'text/html', '200'],
  ]
  const pages = {
    '20200101000000id_': '<title>Pricing</title><h1>Simple pricing</h1><p>$10/mo</p>',
    '20210101000000id_': '<title>Pricing</title><h1>Simple pricing</h1><p>$20/mo</p>',
  }

  it('builds a timeline from the archive and diffs it', async () => {
    const timeline = await buildTimeline('example.com/pricing', {
      fetchImpl: mockFetch(pages, cdx),
      delayMs: 0,
    })
    expect(timeline.domain).toBe('example.com')
    expect(timeline.path).toBe('/pricing')
    expect(timeline.captures).toHaveLength(2)
    expect(timeline.changes.some((change) => change.field === 'price')).toBe(true)
    expect(timeline.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('skips snapshots that fail to load', async () => {
    const timeline = await buildTimeline('example.com/pricing', {
      fetchImpl: mockFetch({ '20200101000000id_': pages['20200101000000id_'] }, cdx),
      delayMs: 0,
    })
    expect(timeline.captures).toHaveLength(1)
    expect(timeline.changes).toHaveLength(1)
  })

  it('throws 404 when the page and site have no captures', async () => {
    await expect(
      buildTimeline('example.com/pricing', {
        fetchImpl: mockFetch({}, [['urlkey', 'timestamp']]),
        delayMs: 0,
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('maps a timeout to a 504', async () => {
    const failing: FetchLike = async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    }
    await expect(
      buildTimeline('example.com/pricing', { fetchImpl: failing, delayMs: 0 }),
    ).rejects.toMatchObject({ status: 504 })
  })

  it('rejects a private-looking host before any network call', async () => {
    let called = false
    const spy: FetchLike = async () => {
      called = true
      throw new Error('should not run')
    }
    await expect(buildTimeline('localhost:3000', { fetchImpl: spy })).rejects.toMatchObject({
      status: 400,
    })
    expect(called).toBe(false)
  })

  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '192.168.1.10',
    '169.254.1.1',
    '100.64.0.1',
    'printer.local',
    'api.internal',
    'http://[::1]/pricing',
  ])('rejects %s without a fetch', async (host) => {
    let called = false
    const spy: FetchLike = async () => {
      called = true
      throw new Error('should not run')
    }
    await expect(buildTimeline(host, { fetchImpl: spy })).rejects.toMatchObject({ status: 400 })
    expect(called).toBe(false)
  })

  it('does not report a price deletion when a capture is an empty shell', async () => {
    const rows = [
      ['urlkey', 'timestamp'],
      ['com,example)/pricing', '20200101000000'],
      ['com,example)/pricing', '20210101000000'],
    ]
    const timeline = await buildTimeline('example.com/pricing', {
      fetchImpl: mockFetch(
        {
          '20200101000000id_': '<title>Pricing</title><h1>Simple</h1><p>$10/mo</p>',
          '20210101000000id_': '<html><body></body></html>',
        },
        rows,
      ),
      delayMs: 0,
    })
    expect(timeline.captures).toHaveLength(1)
    expect(timeline.changes.some((change) => change.field === 'price')).toBe(false)
  })

  it('does not claim a price change when the later capture has no prices', async () => {
    const rows = [
      ['urlkey', 'timestamp'],
      ['com,example)/pricing', '20200101000000'],
      ['com,example)/pricing', '20210101000000'],
    ]
    const timeline = await buildTimeline('example.com/pricing', {
      fetchImpl: mockFetch(
        {
          '20200101000000id_': '<title>Pricing</title><h1>Simple</h1><p>$10/mo</p>',
          '20210101000000id_': '<title>Pricing</title><h1>Simple</h1>',
        },
        rows,
      ),
      delayMs: 0,
    })
    expect(timeline.captures).toHaveLength(2)
    expect(timeline.changes.some((change) => change.field === 'price')).toBe(false)
  })

  it('refuses an off-site redirect without following it', async () => {
    let calls = 0
    const redirecting: FetchLike = async () => {
      calls += 1
      return {
        ok: false,
        status: 302,
        headers: { get: () => 'https://evil.example/collect' },
        json: async () => null,
        text: async () => '',
      }
    }
    await expect(
      buildTimeline('example.com/pricing', { fetchImpl: redirecting, delayMs: 0 }),
    ).rejects.toMatchObject({ status: 502 })
    expect(calls).toBe(1)
  })

  it('returns 502 when captures exist but none can be read', async () => {
    const rows = [
      ['urlkey', 'timestamp'],
      ['com,example)/pricing', '20200101000000'],
      ['com,example)/pricing', '20210101000000'],
    ]
    await expect(
      buildTimeline('example.com/pricing', { fetchImpl: mockFetch({}, rows), delayMs: 0 }),
    ).rejects.toMatchObject({ status: 502 })
  })
})
