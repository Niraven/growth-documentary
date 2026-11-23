import { describe, expect, it } from 'vitest'
import { isArchiveUrl } from '../src/lib/archiveUrl'

describe('isArchiveUrl', () => {
  it('accepts a fixed Wayback capture URL', () => {
    expect(isArchiveUrl('https://web.archive.org/web/20241214215555/https://basecamp.com/pricing')).toBe(true)
  })

  it('rejects a live page, a lookalike host, and a script URL', () => {
    expect(isArchiveUrl('https://basecamp.com/pricing')).toBe(false)
    expect(isArchiveUrl('https://web.archive.org.evil.example/web/2024/https://x.test')).toBe(false)
    expect(isArchiveUrl('javascript:alert(1)')).toBe(false)
  })
})
