import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../server/archive'
import { buildMentions } from '../server/mentions'

const payload = {
  nbHits: 3,
  hits: [
    {
      objectID: '1',
      title: 'Basecamp pricing, revisited',
      url: 'https://basecamp.com/pricing',
      created_at: '2026-01-12T10:00:00Z',
      points: 120,
      num_comments: 40,
      author: 'alice',
    },
    {
      objectID: '2',
      title: 'A Basecamp story',
      url: 'https://www.basecamp.com/agents',
      created_at: '2026-01-28T10:00:00Z',
      points: 20,
      num_comments: 4,
      author: 'bob',
    },
    {
      objectID: '3',
      title: 'Not the same host',
      url: 'https://notbasecamp.com/pricing',
      created_at: '2026-02-01T10:00:00Z',
      points: 999,
      num_comments: 1,
      author: 'mallory',
    },
  ],
}

const fake = (body: unknown, status = 200): FetchLike => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => '',
})

describe('buildMentions', () => {
  it('counts only stories whose submitted URL is on the target host', async () => {
    const mentions = await buildMentions('https://basecamp.com/pricing', { fetchImpl: fake(payload) })
    expect(mentions.status).toBe('read')
    expect(mentions.total).toBe(2)
    expect(mentions.truncated).toBe(false)
    expect(mentions.stories.map((story) => story.id)).toEqual(['1', '2'])
    expect(mentions.months).toEqual([
      { month: '2026-01', count: 2 },
    ])
    expect(mentions.stories[0].url).toBe('https://news.ycombinator.com/item?id=1')
  })

  it('flags a capped result as a lower bound', async () => {
    const mentions = await buildMentions('basecamp.com', {
      fetchImpl: fake({ ...payload, nbHits: 250 }),
    })
    expect(mentions.total).toBe(2)
    expect(mentions.truncated).toBe(true)
  })

  it('distinguishes an empty lane from an unavailable provider', async () => {
    const empty = await buildMentions('basecamp.com', {
      fetchImpl: fake({ nbHits: 0, hits: [] }),
    })
    expect(empty.status).toBe('empty')
    expect(empty.total).toBe(0)

    const unavailable = await buildMentions('basecamp.com', {
      fetchImpl: fake({ error: 'rate limited' }, 429),
    })
    expect(unavailable.status).toBe('unavailable')
    expect(unavailable.note).toMatch(/unread, not zero/)
  })
})
