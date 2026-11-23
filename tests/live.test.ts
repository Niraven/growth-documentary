import { describe, expect, it } from 'vitest'
import { TimelineError } from '../server/archive'
import type { FetchLike } from '../server/core'
import { fetchLive, isPublicAddress, robotsAllows } from '../server/live'

const htmlResponse = (html: string, headers: Record<string, string> = {}) => ({
  ok: true,
  status: 200,
  headers: {
    get: (name: string) => headers[name.toLowerCase()] ?? null,
  },
  json: async () => null,
  text: async () => html,
})

const robots404 = {
  ok: false,
  status: 404,
  headers: { get: () => null },
  json: async () => null,
  text: async () => '',
}

const lookup = async () => [{ address: '93.184.216.34', family: 4 }]

describe('isPublicAddress', () => {
  it.each(['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111'])('accepts %s', (address) => {
    expect(isPublicAddress(address)).toBe(true)
  })

  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.16.5.4',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '198.51.100.1',
    '224.0.0.1',
    '0.0.0.0',
    '::1',
    '::',
    '::127.0.0.1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
    'fec0::1',
    'fd00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('rejects %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
})

describe('robotsAllows', () => {
  const rules = [
    'User-agent: *',
    'Disallow: /private',
    'Allow: /private/public',
    'Disallow: /*.json$',
    '',
  ].join('\n')

  it('allows paths no rule matches', () => {
    expect(robotsAllows(rules, '/pricing')).toBe(true)
  })

  it('disallows a matching path and lets a longer allow win', () => {
    expect(robotsAllows(rules, '/private/secret')).toBe(false)
    expect(robotsAllows(rules, '/private/public/page')).toBe(true)
  })

  it('supports wildcard patterns', () => {
    expect(robotsAllows('User-agent: *\nDisallow: /*.json\n', '/data/prices.json')).toBe(false)
  })

  it('prefers a group that names this agent over the wildcard', () => {
    const text = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: growth-documentary',
      'Allow: /',
      '',
    ].join('\n')
    expect(robotsAllows(text, '/pricing')).toBe(true)
  })

  it('treats an empty disallow as no restriction', () => {
    expect(robotsAllows('User-agent: *\nDisallow:\n', '/pricing')).toBe(true)
  })

  it('matches path plus query, not just the path', () => {
    const text = 'User-agent: *\nDisallow: /pricing?private=1\n'
    expect(robotsAllows(text, '/pricing?private=1')).toBe(false)
    expect(robotsAllows(text, '/pricing?public=1')).toBe(true)
  })

  it('honours a $ end anchor', () => {
    const text = 'User-agent: *\nDisallow: /*.json$\n'
    expect(robotsAllows(text, '/data/prices.json')).toBe(false)
    expect(robotsAllows(text, '/data/prices.json?x=1')).toBe(true)
  })
})

describe('fetchLive', () => {
  it('refuses a host that resolves to a private address', async () => {
    await expect(
      fetchLive('internal.example.com', {
        fetchImpl: (async () => robots404) as FetchLike,
        lookupImpl: async () => [{ address: '10.0.0.9', family: 4 }],
      }),
    ).rejects.toThrow('resolves to a private address')
  })

  it('does not fetch a page robots.txt disallows', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url)
      if (url.endsWith('/robots.txt')) {
        return {
          ...robots404,
          ok: true,
          status: 200,
          text: async () => 'User-agent: *\nDisallow: /pricing\n',
        }
      }
      return htmlResponse('<title>Should not be read</title>')
    }

    await expect(
      fetchLive('deny-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 403 })
    expect(urls.some((url) => url.includes('/pricing') && !url.endsWith('/robots.txt'))).toBe(false)
  })

  it('reads fields once robots.txt is missing or permissive', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) return robots404
      return htmlResponse('<title>Plans & pricing</title><h1>Pick a plan</h1><p>$20/mo</p><p>$50/mo</p>')
    }
    const check = await fetchLive('fields-check.com/pricing', { fetchImpl, lookupImpl: lookup })
    expect(check.title).toBe('Plans & pricing')
    expect(check.h1).toBe('Pick a plan')
    expect(check.prices).toEqual(['$20/mo', '$50/mo'])
    expect(check.domain).toBe('fields-check.com')
    expect(check.path).toBe('/pricing')
    expect(check.robots).toBe('allowed')
  })

  it('reuses robots.txt rules without leaking one path’s verdict into another', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url)
      if (url.endsWith('/robots.txt')) {
        return {
          ...robots404,
          ok: true,
          status: 200,
          text: async () => 'User-agent: *\nDisallow: /private\n',
        }
      }
      return htmlResponse('<title>Allowed</title><h1>Page</h1>')
    }

    const allowed = await fetchLive('cache-path-check.com/pricing', {
      fetchImpl,
      lookupImpl: lookup,
    })
    expect(allowed.title).toBe('Allowed')

    await expect(
      fetchLive('cache-path-check.com/private/secret', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 403 })
    expect(urls.filter((url) => url.endsWith('/robots.txt'))).toHaveLength(1)
    expect(urls.some((url) => url.includes('/private/secret'))).toBe(false)
  })

  it('does not let a disallowed first path poison an allowed one', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) {
        return {
          ...robots404,
          ok: true,
          status: 200,
          text: async () => 'User-agent: *\nDisallow: /private\n',
        }
      }
      return htmlResponse('<title>Allowed</title><h1>Page</h1>')
    }

    await expect(
      fetchLive('cache-order-check.com/private', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 403 })

    const allowed = await fetchLive('cache-order-check.com/pricing', {
      fetchImpl,
      lookupImpl: lookup,
    })
    expect(allowed.title).toBe('Allowed')
  })

  it('fails closed when robots.txt cannot be read', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url)
      if (url.endsWith('/robots.txt')) return { ...robots404, status: 500 }
      return htmlResponse('<title>Should not be read</title>')
    }

    await expect(
      fetchLive('robots-500-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 403 })
    expect(urls.some((url) => url.includes('/pricing') && !url.endsWith('/robots.txt'))).toBe(false)
  })

  it('fails closed when robots.txt redirects off-host', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) {
        return {
          ...robots404,
          status: 302,
          headers: { get: () => 'https://other-check.com/robots.txt' },
        }
      }
      return htmlResponse('<title>Should not be read</title>')
    }

    await expect(
      fetchLive('robots-redirect-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('re-checks robots.txt for the path a same-host redirect lands on', async () => {
    const paths: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) {
        return {
          ...robots404,
          ok: true,
          status: 200,
          text: async () => 'User-agent: *\nDisallow: /private\n',
        }
      }
      const parsed = new URL(url)
      paths.push(parsed.pathname)
      if (parsed.pathname === '/pricing') {
        return {
          ...robots404,
          status: 302,
          headers: { get: () => '/private' },
        }
      }
      return htmlResponse('<title>Private</title>')
    }

    await expect(
      fetchLive('redirect-path-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 403 })
    expect(paths).toContain('/pricing')
    expect(paths).not.toContain('/private')
  })

  it('counts DNS time against the total budget', async () => {
    const started = Date.now()
    const fetchImpl: FetchLike = async () => {
      throw new Error('fetch should not run')
    }
    await expect(
      fetchLive('slow-dns-check.com/pricing', {
        fetchImpl,
        lookupImpl: async () => {
          await new Promise((resolve) => setTimeout(resolve, 300))
          return [{ address: '93.184.216.34', family: 4 }]
        },
        timeoutMs: 60,
      }),
    ).rejects.toMatchObject({ status: 504 })
    expect(Date.now() - started).toBeLessThan(250)
  })

  it('refuses a redirect to another host', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) return robots404
      return {
        ...robots404,
        status: 302,
        headers: { get: () => 'https://evil.test/pricing' },
      }
    }
    await expect(
      fetchLive('redirect-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toThrow('redirected to another site')
  })

  it('refuses a non-HTML response', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) return robots404
      return htmlResponse('%PDF-1.7', { 'content-type': 'application/pdf' })
    }
    await expect(
      fetchLive('pdf-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toMatchObject({ status: 415 })
  })

  it('refuses a page over the byte cap before reading it', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) return robots404
      return htmlResponse('<title>Big</title>', { 'content-length': '3000000' })
    }
    await expect(
      fetchLive('big-check.com/pricing', { fetchImpl, lookupImpl: lookup }),
    ).rejects.toThrow('too large')
  })

  it('surfaces an empty page as unreadable evidence', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) return robots404
      return htmlResponse('<html><body><div></div></body></html>')
    }
    const error = await fetchLive('empty-check.com/pricing', {
      fetchImpl,
      lookupImpl: lookup,
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(TimelineError)
    expect((error as TimelineError).status).toBe(502)
  })
})
