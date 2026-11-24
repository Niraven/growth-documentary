import { normaliseTarget } from './core.js'
import { budget, htmlLinks, publicPage, requestPublic, webUrl, type SignalOptions } from './signal-http.js'
import type { JobRole, JobsSignal } from '../shared/signals.js'

type Board = { provider: 'Greenhouse' | 'Lever' | 'Ashby'; boardUrl: string; endpoint: URL }
const obj = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {}
const str = (v: unknown) => typeof v === 'string' ? v.trim() : ''
export function detectBoard(html: string, base: URL): Board | null {
  for (const { attrs } of htmlLinks(html)) {
    const url = webUrl(attrs.href ?? '', base)
    if (!url || url.protocol !== 'https:' || url.port) continue
    const host = url.hostname.toLowerCase()
    const slug = url.pathname.split('/').filter(Boolean)[0]
    if (!slug || !/^[a-z0-9_-]{1,100}$/i.test(slug)) continue
    let provider: Board['provider']; let endpoint: URL
    if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') {
      provider = 'Greenhouse'; endpoint = new URL(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)
    } else if (host === 'jobs.lever.co') {
      provider = 'Lever'; endpoint = new URL(`https://api.lever.co/v0/postings/${slug}?mode=json`)
    } else if (host === 'jobs.ashbyhq.com') {
      provider = 'Ashby'; endpoint = new URL(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)
    } else continue
    return { provider, endpoint, boardUrl: `https://${host}/${slug}` }
  }
  return null
}
export async function buildJobsSignal(rawTarget: string, options: SignalOptions = {}): Promise<JobsSignal> {
  const target = normaliseTarget(rawTarget)
  const home = new URL('/', target.origin)
  const checkedAt = new Date().toISOString()
  let board: Board | null = null
  const unavailable = (): JobsSignal => ({ status: 'unavailable', provider: board?.provider ?? null, boardUrl: board?.boardUrl ?? null, openRoles: null, roles: [], note: 'Could not read public job data. This lane is unread, not zero.', checkedAt })
  try {
    return await budget(options, async (signal) => {
      board = detectBoard(await publicPage(home, options, signal), home)
      if (!board) return { status: 'empty', provider: null, boardUrl: null, openRoles: null, roles: [], note: 'No supported public job board linked from the homepage; this does not mean there are no open roles.', checkedAt }
      const payload: unknown = JSON.parse(await requestPublic(board.endpoint, options, signal))
      const items = board.provider === 'Lever' ? payload : obj(payload).jobs
      if (!Array.isArray(items)) throw new Error('Unexpected provider response')
      const roles: JobRole[] = items.slice(0, 30).flatMap((item: unknown) => {
        const row = obj(item)
        const title = str(row.title ?? row.text)
        const location = str(obj(row.location).name ?? row.location ?? obj(row.categories).location)
        const url = webUrl(str(row.absolute_url ?? row.hostedUrl ?? row.jobUrl), new URL(board!.boardUrl))
        return title && url ? [{ title, location, url: url.href }] : []
      })
      return { status: items.length ? 'read' : 'empty', provider: board.provider, boardUrl: board.boardUrl, openRoles: items.length, roles, note: 'Public provider job postings; role list capped at 30.', checkedAt }
    })
  } catch { return unavailable() }
}
