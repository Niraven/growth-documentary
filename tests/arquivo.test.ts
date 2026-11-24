import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../server/archive'
import { buildArquivoInfo } from '../server/arquivo'

const payload = {
  estimated_nr_results: 42,
  response_items: [
    {
      tstamp: '20251209041311',
      originalURL: 'https://basecamp.com/pricing/',
      linkToNoFrame: 'https://arquivo.pt/noFrame/replay/20251209041311/https://basecamp.com/pricing/',
    },
    {
      tstamp: '20190912105854',
      originalURL: 'https://basecamp.com/pricing',
      linkToNoFrame: 'https://arquivo.pt/noFrame/replay/20190912105854/https://basecamp.com/pricing',
    },
    {
      tstamp: '20240101000000',
      originalURL: 'https://notbasecamp.com/pricing',
      linkToNoFrame: 'https://arquivo.pt/noFrame/replay/20240101000000/https://notbasecamp.com/pricing',
    },
  ],
}

const fake = (body: unknown, status = 200): FetchLike => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => '',
})

describe('buildArquivoInfo', () => {
  it('keeps captures for the target host and reports the provider estimate', async () => {
    const archive = await buildArquivoInfo('https://basecamp.com/pricing', { fetchImpl: fake(payload) })
    expect(archive.status).toBe('read')
    expect(archive.count).toBe(2)
    expect(archive.last).toBe('20251209041311')
    expect(archive.first).toBe('20190912105854')
    expect(archive.captures).toHaveLength(2)
    expect(archive.note).toMatch(/estimates 42 captures; 2 unique rows/)
    expect(archive.captures[0].url).toMatch(/^https:\/\/arquivo\.pt\/noFrame\/replay\//)
  })

  it('reports an empty lane and an unavailable lane separately', async () => {
    const empty = await buildArquivoInfo('basecamp.com', {
      fetchImpl: fake({ estimated_nr_results: 0, response_items: [] }),
    })
    expect(empty.status).toBe('empty')

    const unavailable = await buildArquivoInfo('basecamp.com', {
      fetchImpl: fake({ error: 'down' }, 503),
    })
    expect(unavailable.status).toBe('unavailable')
    expect(unavailable.note).toMatch(/unread, not zero/)
  })
})
