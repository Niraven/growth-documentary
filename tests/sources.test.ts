import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../server/archive'
import { buildSources } from '../server/sources'

const fake: FetchLike = async (url) => {
  if (url.includes('hn.algolia.com')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        nbHits: 1,
        hits: [
          {
            objectID: '7',
            title: 'Basecamp pricing',
            url: 'https://basecamp.com/pricing',
            created_at: '2026-01-01T00:00:00Z',
            points: 10,
            num_comments: 2,
            author: 'alice',
          },
        ],
      }),
      text: async () => '',
    }
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      estimated_nr_results: 4,
      response_items: [
        {
          tstamp: '20250101000000',
          originalURL: 'https://basecamp.com/pricing',
          linkToNoFrame: 'https://arquivo.pt/noFrame/replay/20250101000000/https://basecamp.com/pricing',
        },
      ],
    }),
    text: async () => '',
  }
}

describe('buildSources', () => {
  it('returns both public lanes without making one depend on the other', async () => {
    const report = await buildSources('basecamp.com/pricing', { fetchImpl: fake })
    expect(report.domain).toBe('basecamp.com')
    expect(report.mentions.status).toBe('read')
    expect(report.archives.status).toBe('read')
    expect(report.mentions.total).toBe(1)
    expect(report.archives.count).toBe(1)
  })

  it('isolates a failed Hacker News lane from a readable archive lane', async () => {
    const failing: FetchLike = async (url) => {
      if (url.includes('hn.algolia.com')) throw new Error('HN down')
      return fake(url)
    }
    const report = await buildSources('basecamp.com/pricing', { fetchImpl: failing })
    expect(report.mentions.status).toBe('unavailable')
    expect(report.archives.status).toBe('read')
    expect(report.mentions.note).toMatch(/unread, not zero/)
  })
})
