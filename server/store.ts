/**
 * Saved reports, stored as one JSON file.
 *
 * A single-process store with an atomic write and a serialised queue. That is
 * the deliberate ceiling: this app self-hosts as one process, and a database
 * would add a deployment dependency before anyone has asked for one. Upgrade
 * trigger: more than one writer process, or a need to query beyond "list".
 */

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  isSavedReport,
  type SavedReport,
  type SavedSummary,
  type Timeline,
} from '../shared/timeline.js'
import { TimelineError } from './archive.js'

const FILE_VERSION = 1
const MAX_REPORTS = 200
/** A single frozen report over ~800 kB is not a report any more. */
const MAX_REPORT_BYTES = 800_000

type StoreFile = { version: number; reports: SavedReport[] }

export function defaultReportFile(): string {
  const dir = process.env.GD_DATA_DIR ?? 'data'
  return process.env.GD_REPORTS_FILE ?? join(dir, 'reports.json')
}

const makeId = (): string => randomBytes(6).toString('base64url')

const summaryOf = ({ id, savedAt, report }: SavedReport): SavedSummary => ({
  id,
  savedAt,
  domain: report.domain,
  path: report.path,
  changes: report.changes.filter((change) => change.field !== 'first capture').length,
  from: report.coverage.from,
  to: report.coverage.to,
})

export class ReportStore {
  private readonly file: string
  private readonly limit: number
  private queue: Promise<unknown> = Promise.resolve()

  constructor(file = defaultReportFile(), limit = MAX_REPORTS) {
    this.file = file
    this.limit = limit
  }

  private async load(): Promise<StoreFile> {
    let raw: string
    try {
      raw = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: FILE_VERSION, reports: [] }
      }
      throw new TimelineError('Saved reports are unavailable', 500)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new TimelineError('Saved reports are unreadable', 500)
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as StoreFile).version !== FILE_VERSION ||
      !Array.isArray((parsed as StoreFile).reports) ||
      !(parsed as StoreFile).reports.every(isSavedReport)
    ) {
      throw new TimelineError('Saved reports are unreadable', 500)
    }
    return parsed as StoreFile
  }

  private async persist(data: StoreFile): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 })
    await rename(temporary, this.file)
  }

  /** Serialise mutations: two saves must not read-modify-write the same file. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async save(report: Timeline): Promise<{ report: SavedReport; created: boolean }> {
    return this.enqueue(async () => {
      const data = await this.load()
      const existing = data.reports.find(
        (entry) =>
          entry.report.domain === report.domain &&
          entry.report.path === report.path &&
          entry.report.checkedAt === report.checkedAt,
      )
      if (existing) return { report: existing, created: false }

      if (Buffer.byteLength(JSON.stringify(report)) > MAX_REPORT_BYTES) {
        throw new TimelineError('That report is too large to save', 413)
      }

      let id = makeId()
      while (data.reports.some((entry) => entry.id === id)) id = makeId()

      const entry: SavedReport = { id, savedAt: new Date().toISOString(), report }
      const next: StoreFile = {
        version: FILE_VERSION,
        reports: [entry, ...data.reports].slice(0, this.limit),
      }
      await this.persist(next)
      return { report: entry, created: true }
    })
  }

  async list(): Promise<SavedSummary[]> {
    const data = await this.load()
    return [...data.reports]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .map(summaryOf)
  }

  async get(id: string): Promise<SavedReport | null> {
    if (!/^[A-Za-z0-9_-]{6,24}$/.test(id)) return null
    const data = await this.load()
    return data.reports.find((entry) => entry.id === id) ?? null
  }

  async remove(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      if (!/^[A-Za-z0-9_-]{6,24}$/.test(id)) return false
      const data = await this.load()
      const next = data.reports.filter((entry) => entry.id !== id)
      if (next.length === data.reports.length) return false
      await this.persist({ version: FILE_VERSION, reports: next })
      return true
    })
  }
}
