import type { SourceStatus } from './sources.js'

export type FeedEntry = { title: string; url: string; publishedAt: string | null; summary: string }
export type FeedSignal = { status: SourceStatus; entries: FeedEntry[]; note: string; checkedAt: string }
export type JobRole = { title: string; location: string; url: string }
export type JobsSignal = { status: SourceStatus; provider: 'Greenhouse' | 'Lever' | 'Ashby' | null; boardUrl: string | null; openRoles: number | null; roles: JobRole[]; note: string; checkedAt: string }
export type SignalsReport = { domain: string; checkedAt: string; feeds: FeedSignal; jobs: JobsSignal }

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): v is string => typeof v === 'string'
const status = (v: unknown) => v === 'read' || v === 'empty' || v === 'unavailable'
export function isFeedSignal(v: unknown): v is FeedSignal {
  return record(v) && status(v.status) && str(v.note) && str(v.checkedAt) && Array.isArray(v.entries) && v.entries.every((e: unknown) => record(e) && str(e.title) && str(e.url) && (e.publishedAt === null || str(e.publishedAt)) && str(e.summary))
}
export function isJobsSignal(v: unknown): v is JobsSignal {
  return record(v) && status(v.status) && (v.provider === null || v.provider === 'Greenhouse' || v.provider === 'Lever' || v.provider === 'Ashby') && (v.boardUrl === null || str(v.boardUrl)) && (v.openRoles === null || (typeof v.openRoles === 'number' && Number.isSafeInteger(v.openRoles) && v.openRoles >= 0)) && str(v.note) && str(v.checkedAt) && Array.isArray(v.roles) && v.roles.every((e: unknown) => record(e) && str(e.title) && str(e.location) && str(e.url))
}
export function isSignalsReport(v: unknown): v is SignalsReport {
  return record(v) && str(v.domain) && str(v.checkedAt) && isFeedSignal(v.feeds) && isJobsSignal(v.jobs)
}
