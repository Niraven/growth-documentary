import { useState } from 'react'
import { ArrowLeft, Bookmark, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import type { SavedSummary } from '../../shared/timeline'
import { tsToMs } from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  reports: SavedSummary[]
  loading: boolean
  error: string | null
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onRefresh: () => void
  onBack: () => void
}

const day = (ts: string): string =>
  new Date(tsToMs(ts)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const savedAtLabel = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

export function SavedReports({ reports, loading, error, onOpen, onDelete, onRefresh, onBack }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <main id="main" className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
      <div className="border-b border-border py-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to search
        </button>
        <h1 className="mt-4 font-display text-[clamp(30px,4vw,44px)] leading-[1.02] tracking-[-0.03em]">
          Saved reports
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Frozen copies of reports you saved, stored as one file on this machine. Nothing is
          uploaded. A saved copy never changes — build the page again to get a newer report, saved
          as a separate copy.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh
          </Button>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {reports.length} saved
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px]"
        >
          {error}
        </div>
      )}

      {!error && !loading && reports.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <Bookmark className="size-5 text-muted-foreground" />
            <p className="text-[15px] font-medium">Nothing saved yet</p>
            <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
              Build a report, then choose <span className="font-medium text-foreground">Save report</span>.
              The copy stays here and gets a link you can reopen later.
            </p>
            <Button variant="outline" size="sm" onClick={onBack}>
              Build a report
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-[17px] leading-tight tracking-[-0.01em]">
                    {report.domain}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {report.path}
                  </p>
                </div>
                <Badge variant={report.changes > 0 ? 'good' : 'outline'}>
                  {report.changes} field changes
                </Badge>
              </div>

              <p className="mt-3 text-[12px] text-muted-foreground">
                {day(report.from)} → {day(report.to)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Saved {savedAtLabel(report.savedAt)}
              </p>

              <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
                <Button size="sm" variant="outline" onClick={() => onOpen(report.id)}>
                  Open
                </Button>
                {confirmId === report.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setConfirmId(null)
                        onDelete(report.id)
                      }}
                    >
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-muted-foreground"
                    onClick={() => setConfirmId(report.id)}
                  >
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
