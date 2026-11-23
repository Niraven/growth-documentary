import { Bookmark, Check, Download, Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Timeline } from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { downloadFile, reportCsv, reportJson, reportSlug } from '@/lib/export'

type Props = {
  report: Timeline
  savedId: string | null
  savedAt: string | null
  saving: boolean
  onSave: () => void
}

const savedLabel = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

export function ReportActions({ report, savedId, savedAt, saving, onSave }: Props) {
  const slug = reportSlug(report)

  const copyLink = async () => {
    if (!savedId) return
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#report/${savedId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Saved link copied', { description: 'The frozen report is behind this link.' })
    } catch {
      toast.error('Could not copy the link', { description: url })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
      {savedAt ? (
        <>
          <Badge variant="good">
            <Check /> Saved {savedLabel(savedAt)}
          </Badge>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Link2 /> Copy link
          </Button>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            Frozen copy · building again makes a new report
          </span>
        </>
      ) : (
        <>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Bookmark />}
            {saving ? 'Saving…' : 'Save report'}
          </Button>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            Stores this exact copy on this machine
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadFile(`${slug}.csv`, 'text/csv', reportCsv(report))}
        >
          <Download /> CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadFile(`${slug}.json`, 'application/json', reportJson(report))}
        >
          <Download /> JSON
        </Button>
      </div>
    </div>
  )
}
