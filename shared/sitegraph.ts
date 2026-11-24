export const PAGE_TYPES = ['pricing', 'product', 'compare', 'integrations', 'changelog', 'careers', 'docs', 'blog', 'other'] as const
export type PageType = typeof PAGE_TYPES[number]
export type SiteGraphPage = { url: string; type: PageType; title: string; h1: string; description: string; links: string[] }
export type SiteGraph = {
  domain: string
  checkedAt: string
  robotsUrl: string | null
  sitemapUrl: string | null
  pages: SiteGraphPage[]
  pageTypes: Record<PageType, number>
  discovered: number
  fetched: number
  skipped: number
  notes: string[]
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
export function isSiteGraph(value: unknown): value is SiteGraph {
  if (!record(value) || typeof value.domain !== 'string' || typeof value.checkedAt !== 'string' ||
    !(value.robotsUrl === null || typeof value.robotsUrl === 'string') ||
    !(value.sitemapUrl === null || typeof value.sitemapUrl === 'string') ||
    !count(value.discovered) || !count(value.fetched) || !count(value.skipped) || !strings(value.notes) ||
    !record(value.pageTypes) || !PAGE_TYPES.every((key) => count((value.pageTypes as Record<string, unknown>)[key])) ||
    !Array.isArray(value.pages)) return false
  return value.pages.every((p: unknown) => record(p) && typeof p.url === 'string' &&
    typeof p.type === 'string' && (PAGE_TYPES as readonly string[]).includes(p.type) &&
    typeof p.title === 'string' && typeof p.h1 === 'string' && typeof p.description === 'string' && strings(p.links))
}
