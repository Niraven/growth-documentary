import { describe, expect, it } from 'vitest'
import { adLibraryLinks } from '../src/lib/adLinks'

describe('adLibraryLinks', () => {
  it('builds four free public library links for a domain', () => {
    const links = adLibraryLinks('example.com')
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.id)).toEqual(['meta', 'google', 'tiktok', 'linkedin'])
    for (const link of links) {
      expect(link.href.startsWith('https://')).toBe(true)
      expect(link.href).toContain('example.com')
    }
  })

  it('strips www and encodes the domain', () => {
    const [meta] = adLibraryLinks('www.example.com/path?q=1')
    expect(meta.href).toContain('example.com%2Fpath%3Fq%3D1')
    expect(meta.href).not.toContain('www.example.com')
  })

  it('trims whitespace', () => {
    const [meta] = adLibraryLinks('  example.com  ')
    expect(meta.href).toContain('q=example.com&')
  })
})
