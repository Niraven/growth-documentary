import { Suspense, lazy, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Documentary } from '@/components/Documentary'
import { GrowthTimelineReport } from '@/components/GrowthTimeline'
import { OutcomesPanel } from '@/components/OutcomesPanel'
import { SourceContextPanel } from '@/components/SourceContextPanel'
import { Toaster, toast } from 'sonner'
import { Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlyphBackground } from '@/components/ui/backgrounds-glyph'
import { Separator } from '@/components/ui/separator'
import {
  isErrorBody,
  isSavedListBody,
  isSavedReport,
  isTimeline,
  type SavedSummary,
} from '../shared/timeline'
import HowItWorks from '@/components/HowItWorks'
import { EmptyState } from '@/components/EmptyState'
import { LiveLoading, LiveReport, type LiveData } from '@/components/LiveReport'
import { LivePanel } from '@/components/LivePanel'
import { ReportActions } from '@/components/ReportActions'
import { SavedReports } from '@/components/SavedReports'

const Gallery = lazy(() => import('@/components/Gallery'))
const CompareCaptures = lazy(() =>
  import('@/components/CompareCaptures').then((module) => ({ default: module.CompareCaptures })),
)
const ArchivePreview = lazy(() =>
  import('@/components/ArchivePreview').then((module) => ({ default: module.ArchivePreview })),
)

type View = 'report' | 'saved' | 'system' | 'how'

export default function App() {
  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash
    if (hash === '#system') return 'system'
    if (hash === '#how') return 'how'
    if (hash === '#saved') return 'saved'
    return 'report'
  })
  const [skin, setSkin] = useState<'day' | 'paper' | 'night'>(() => {
    const param = new URLSearchParams(window.location.search).get('skin')
    if (param === 'day' || param === 'paper' || param === 'night') return param
    try {
      return (localStorage.getItem('gd-skin') as 'day' | 'paper' | 'night') || 'day'
    } catch {
      return 'day'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    try {
      localStorage.setItem('gd-skin', skin)
    } catch {
      /* storage blocked */
    }
  }, [skin])

  const [savedId, setSavedId] = useState<string | null>(() =>
    window.location.hash.startsWith('#report/')
      ? window.location.hash.slice('#report/'.length)
      : null,
  )
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (view === 'system') window.history.replaceState(null, '', '#system')
    else if (view === 'how') window.history.replaceState(null, '', '#how')
    else if (view === 'saved') window.history.replaceState(null, '', '#saved')
    else if (savedId) window.history.replaceState(null, '', `#report/${savedId}`)
    else window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [view, savedId])

  const [domain, setDomain] = useState('basecamp.com/pricing')
  const [live, setLive] = useState<LiveData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedList, setSavedList] = useState<SavedSummary[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState<string | null>(null)
  const [section, setSection] = useState('growth')

  const build = async (target: string) => {
    setLoading(true)
    setError(null)
    setLive(null)
    setSavedId(null)
    setSavedAt(null)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 120_000)
    try {
      const response = await fetch(`/api/timeline?url=${encodeURIComponent(target)}`, {
        signal: controller.signal,
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(isErrorBody(payload) ? payload.error : 'Could not build the timeline')
      }
      if (!isTimeline(payload)) throw new Error('The server returned an unexpected report')
      setLive(payload)
      const share = new URLSearchParams(window.location.search)
      share.set('url', target)
      window.history.replaceState(null, '', `${window.location.pathname}?${share.toString()}`)
      window.scrollTo(0, 0)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setError('That took too long. The archive may be slow — try again in a minute.')
      } else {
        setError(caught instanceof Error ? caught.message : 'Could not build the timeline')
      }
    } finally {
      window.clearTimeout(timer)
      setLoading(false)
    }
  }

  const run = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = domain.trim()
    if (target) void build(target)
  }

  const refreshSaved = async () => {
    setSavedLoading(true)
    setSavedError(null)
    try {
      const response = await fetch('/api/reports')
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(isErrorBody(payload) ? payload.error : 'Could not load saved reports')
      }
      if (!isSavedListBody(payload)) throw new Error('The server returned an unexpected list')
      setSavedList(payload.reports)
    } catch (caught) {
      setSavedError(caught instanceof Error ? caught.message : 'Could not load saved reports')
    } finally {
      setSavedLoading(false)
    }
  }

  const openSaved = async (id: string) => {
    setLoading(true)
    setError(null)
    setLive(null)
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(id)}`)
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(isErrorBody(payload) ? payload.error : 'Could not open that saved report')
      }
      if (!isSavedReport(payload)) throw new Error('The server returned an unexpected saved report')
      setLive(payload.report)
      setSavedId(payload.id)
      setSavedAt(payload.savedAt)
      setDomain(`${payload.report.domain}${payload.report.path}`)
      setView('report')
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#report/${payload.id}`,
      )
      window.scrollTo(0, 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open that saved report')
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!live || savedAt || saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: `${live.domain}${live.path}` }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(isErrorBody(payload) ? payload.error : 'Could not save the report')
      }
      const id = (payload as { id?: unknown }).id
      const at = (payload as { savedAt?: unknown }).savedAt
      if (typeof id !== 'string' || typeof at !== 'string') {
        throw new Error('The server did not return a saved id')
      }
      setSavedId(id)
      setSavedAt(at)
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#report/${id}`,
      )
      await refreshSaved()
      toast.success('Report saved', {
        description: 'A frozen copy on this machine. The link reopens it.',
        action: {
          label: 'Copy link',
          onClick: () => {
            const url = `${window.location.origin}${window.location.pathname}${window.location.search}#report/${id}`
            void navigator.clipboard.writeText(url)
          },
        },
      })
    } catch (caught) {
      toast.error('Could not save the report', {
        description: caught instanceof Error ? caught.message : 'Try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteSaved = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null)
        throw new Error(isErrorBody(payload) ? payload.error : 'Could not delete that report')
      }
      if (savedId === id) {
        setLive(null)
        setSavedId(null)
        setSavedAt(null)
      }
      await refreshSaved()
      toast.success('Saved report deleted')
    } catch (caught) {
      toast.error('Could not delete the report', {
        description: caught instanceof Error ? caught.message : 'Try again.',
      })
    }
  }

  useEffect(() => {
    void refreshSaved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#report/')) {
      void openSaved(hash.slice('#report/'.length))
      return
    }
    if (hash === '#saved') return
    const preset = new URLSearchParams(window.location.search).get('url')
    if (!preset) return
    setDomain(preset)
    void build(preset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const targetForm = (
    <form onSubmit={run} className="mt-6 max-w-xl">
      <label
        htmlFor="domain"
        className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        Company domain or public page
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="domain"
          name="domain"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="https://basecamp.com/pricing"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button type="submit" disabled={loading || domain.trim().length === 0}>
          {loading ? 'Reading archive…' : 'Build growth timeline'}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        The page record, archived site footprint and public context. Usually 20–40 seconds.
      </p>
    </form>
  )

  return (
    <>
      <Toaster
        position="bottom-right"
        theme={skin === 'night' ? 'dark' : 'light'}
        toastOptions={{ style: { fontFamily: 'inherit' } }}
      />
      <div className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
            <button
              onClick={() => setView('report')}
              className="flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left"
            >
              <img
                src={`${import.meta.env.BASE_URL}icon.svg`}
                width={28}
                height={28}
                alt=""
                className="rounded-[6px]"
              />
              <span className="font-display text-[15px] tracking-[-0.01em]">
                Growth Timeline
              </span>
            </button>

            <nav aria-label="Primary" className="flex items-center gap-2">
              <select
                aria-label="Colour theme"
                value={skin}
                onChange={(e) => setSkin(e.target.value as typeof skin)}
                className="theme-select"
              >
                <option value="day">Day</option>
                <option value="paper">Paper</option>
                <option value="night">Night</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="inline-flex"
                onClick={() => {
                  setView('saved')
                  void refreshSaved()
                }}
              >
                <Bookmark />
                Saved
                {savedList.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                    {savedList.length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => setView('how')}
              >
                How it works
              </Button>
            </nav>
          </div>
        </header>

        {view === 'saved' ? (
          <SavedReports
            reports={savedList}
            loading={savedLoading}
            error={savedError}
            onOpen={(id) => void openSaved(id)}
            onDelete={(id) => void deleteSaved(id)}
            onRefresh={() => void refreshSaved()}
            onBack={() => setView('report')}
          />
        ) : view === 'system' ? (
          <Suspense
            fallback={
              <div className="mx-auto max-w-6xl px-5 py-12 text-sm text-muted-foreground md:px-8">
                Loading the design system…
              </div>
            }
          >
            <Gallery onBack={() => setView('report')} />
          </Suspense>
        ) : view === 'how' ? (
          <HowItWorks onBack={() => setView('report')} />
        ) : (
          <main id="main" className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
            {live ? (
              <>
                <div className="report-heading">
                  <div>
                    <span className="metadata">
                      {savedAt ? 'Saved' : 'Live'} public growth timeline
                    </span>
                    <h1>
                      {live.domain}
                      <wbr />
                      {live.path}
                    </h1>
                    <p>
                      Checked {live.checkedAt.slice(0, 10)} UTC ·{' '}
                      {savedAt ? 'frozen from the archive' : 'live archive read'}
                    </p>
                  </div>
                  <details className="target">
                    <summary>Research another URL</summary>
                    {targetForm}
                  </details>
                </div>
              </>
            ) : (
              <GlyphBackground className="isolate h-auto [&_canvas]:opacity-20">
                <section className="landing relative z-10">
                  <div>
                    <span className="metadata">Open-source growth tool</span>
                    <h1>Reconstruct a company’s public growth.</h1>
                    <p className="intro">
                      Build a dated, sourced growth timeline: what changed on the offer page, when the
                      site expanded, and when the company appeared in public discussion. Then read the
                      same record as a short narrative.
                    </p>
                    {targetForm}
                  </div>
                  {!loading && <EmptyState />}
                </section>
              </GlyphBackground>
            )}
            {loading && <LiveLoading domain={domain} />}
            {error && (
              <div
                role="alert"
                className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-foreground"
              >
                <span className="font-medium">Could not build that timeline.</span> {error}
              </div>
            )}
            {live && !loading && (
              <div className="pt-2">
                <ReportActions
                  report={live}
                  savedId={savedId}
                  savedAt={savedAt}
                  saving={saving}
                  onSave={() => void save()}
                />
              </div>
            )}
            {live && (
              <>
                <nav className="report-nav" aria-label="Report sections">
                  {[
                    ['Timeline', 'growth'],
                    ['Context', 'context'],
                    ['Narrative', 'documentary'],
                    ['Compare', 'compare'],
                    ['Evidence', 'evidence'],
                    ['Changes', 'changes'],
                  ].map(([label, target]) => (
                    <button
                      key={label}
                      className={section === target ? 'is-active' : undefined}
                      aria-current={section === target ? 'location' : undefined}
                      onClick={() => {
                        setSection(target)
                        const el = document.getElementById(target)
                        el?.focus({ preventScroll: true })
                        el?.scrollIntoView()
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <GrowthTimelineReport key={`${live.domain}${live.path}`} report={live} />
                <SourceContextPanel domain={live.domain} path={live.path} />
                <Documentary report={live} />
                <OutcomesPanel />
                <div className="receipts-boundary">
                  <span className="metadata">Receipts</span>
                  <h2>The evidence behind the story</h2>
                  <p>
                    Compare a chosen pair, inspect the sampled captures, and read the dated changes
                    and public-source lanes. The story above does not depend on these counts.
                  </p>
                </div>
                <div id="compare" tabIndex={-1}>
                  <Suspense fallback={null}>
                    <CompareCaptures captures={live.captures} />
                  </Suspense>
                </div>
                <LiveReport data={live} />
                <details className="inspect">
                  <summary>Inspect archived HTML or check the current page</summary>
                  <Suspense fallback={null}>
                    <ArchivePreview captures={live.captures} />
                  </Suspense>
                  <LivePanel report={live} />
                </details>
              </>
            )}
          </main>
        )}

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-[11.5px] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
            <span>
              {live
                ? `Sources: Internet Archive Wayback Machine · ${live.coverage.sampled} of ${live.coverage.available} captures of ${live.domain}${live.path}`
                : 'Sources: Internet Archive Wayback Machine · live check is opt-in and never counted as a change'}
            </span>
            <div className="flex items-center gap-4">
              <button onClick={() => setView('saved')} className="hover:text-foreground">
                Saved reports
              </button>
              <Separator orientation="vertical" className="h-3" />
              <button onClick={() => setView('how')} className="hover:text-foreground">
                How it works
              </button>
              <Separator orientation="vertical" className="h-3" />
              <button onClick={() => setView('system')} className="hover:text-foreground">
                Design system
              </button>
              <Separator orientation="vertical" className="h-3" />
              <a
                href="https://github.com/Niraven/growth-documentary"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                Source · MIT
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
