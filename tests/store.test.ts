import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Timeline } from '../shared/timeline'
import { ReportStore } from '../server/store'

const timeline = (overrides: Partial<Timeline> = {}): Timeline => ({
  domain: 'example.com',
  path: '/pricing',
  captures: [
    {
      ts: '20240101000000',
      label: '1 Jan 2024',
      title: 'Pricing',
      h1: 'Simple',
      prices: ['$10/mo'],
      url: 'https://web.archive.org/web/20240101000000/example.com/pricing',
    },
    {
      ts: '20250101000000',
      label: '1 Jan 2025',
      title: 'Pricing',
      h1: 'Simple',
      prices: ['$20/mo'],
      url: 'https://web.archive.org/web/20250101000000/example.com/pricing',
    },
  ],
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
      ts: '20250101000000',
      label: '1 Jan 2025',
      field: 'price',
      before: '$10/mo',
      after: '$20/mo',
      url: 'https://web.archive.org/web/20250101000000/example.com/pricing',
    },
  ],
  coverage: {
    from: '20240101000000',
    to: '20250101000000',
    months: 13,
    sampled: 2,
    available: 2,
    strategy: 'adaptive',
  },
  checkedAt: '2026-11-24T00:00:00.000Z',
  ...overrides,
})

const tempStore = async (limit = 200) => {
  const dir = await mkdtemp(join(tmpdir(), 'gd-store-'))
  return { dir, store: new ReportStore(join(dir, 'reports.json'), limit) }
}

describe('ReportStore', () => {
  it('saves, lists and reads back a frozen report', async () => {
    const { store } = await tempStore()
    const { report, created } = await store.save(timeline())
    expect(created).toBe(true)
    expect(report.id).toMatch(/^[A-Za-z0-9_-]{6,24}$/)

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: report.id,
      domain: 'example.com',
      path: '/pricing',
      changes: 1,
      from: '20240101000000',
      to: '20250101000000',
    })

    const read = await store.get(report.id)
    expect(read?.report.domain).toBe('example.com')
    expect(read?.savedAt).toBe(report.savedAt)
  })

  it('is idempotent for the same report snapshot', async () => {
    const { store } = await tempStore()
    const first = await store.save(timeline())
    const second = await store.save(timeline())
    expect(second.created).toBe(false)
    expect(second.report.id).toBe(first.report.id)
    expect(await store.list()).toHaveLength(1)
  })

  it('keeps distinct snapshots of the same page', async () => {
    const { store } = await tempStore()
    await store.save(timeline())
    await store.save(timeline({ checkedAt: '2026-11-25T00:00:00.000Z' }))
    expect(await store.list()).toHaveLength(2)
  })

  it('prunes to the configured limit, newest first', async () => {
    const { store } = await tempStore(2)
    const one = await store.save(timeline({ checkedAt: '2026-11-20T00:00:00.000Z' }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    const two = await store.save(timeline({ checkedAt: '2026-11-21T00:00:00.000Z' }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    const three = await store.save(timeline({ checkedAt: '2026-11-22T00:00:00.000Z' }))

    const list = await store.list()
    expect(list.map((entry) => entry.id)).toEqual([three.report.id, two.report.id])
    expect(await store.get(one.report.id)).toBeNull()
  })

  it('removes a report and reports a missing id', async () => {
    const { store } = await tempStore()
    const { report } = await store.save(timeline())
    expect(await store.remove(report.id)).toBe(true)
    expect(await store.get(report.id)).toBeNull()
    expect(await store.remove(report.id)).toBe(false)
  })

  it('refuses an unreadable store instead of overwriting it', async () => {
    const { dir, store } = await tempStore()
    await writeFile(join(dir, 'reports.json'), 'not json')
    await expect(store.save(timeline())).rejects.toThrow('Saved reports are unreadable')
    expect(await readFile(join(dir, 'reports.json'), 'utf8')).toBe('not json')
  })

  it('writes a file that can be read again by a new store', async () => {
    const { dir, store } = await tempStore()
    const { report } = await store.save(timeline())
    const reopened = new ReportStore(join(dir, 'reports.json'))
    expect((await reopened.get(report.id))?.report.path).toBe('/pricing')
  })
})
