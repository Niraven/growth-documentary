import { Bookmark, Check, Download, Link2, Loader2, Quote } from 'lucide-react'
import { growthDocumentary } from '../../shared/documentary'
import { toast } from 'sonner'
import type { Timeline } from '../../shared/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { downloadFile, reportCsv, reportJson, reportSlug } from '@/lib/export'
import { citationFor } from '@/lib/citation'

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
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Report link copied')
    } catch {
      toast.error('Could not copy the link', { description: url })
    }
  }

  const cite = async () => {
    const base = `${window.location.origin}${window.location.pathname}${window.location.search}`
    const link = savedId ? `${base}#report/${savedId}` : base
    const citation = citationFor(report, { link })
    try {
      await navigator.clipboard.writeText(citation)
      toast.success('Citation copied', {
        description: 'Coverage window, sample size, field changes and source link.',
      })
    } catch {
      toast.error('Could not copy the citation', { description: citation })
    }
  }

  return (
    <div className="report-actions flex flex-wrap items-center gap-2">
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(growthDocumentary(report).markdown)
            toast.success('Documentary copied')
          } catch {
            toast.error('Clipboard unavailable. Select and copy the documentary instead.')
          }
        }}
      >
        Copy documentary
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink}>
        <Link2 /> Copy link
      </Button>
      {savedAt ? (
        <>
          <Badge variant="good">
            <Check /> Saved {savedLabel(savedAt)}
          </Badge>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Bookmark />}
            {saving ? 'Saving…' : 'Save report'}
          </Button>
        </>
      )}

      <details className="exports">
        <summary>Export or cite</summary>
        <div className="flex flex-wrap items-center gap-2 py-2">
          <Button variant="outline" size="sm" onClick={cite}>
            <Quote /> Copy citation
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile(`${slug}.csv`, 'text/csv', reportCsv(report))}
          >
            <Download /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile(`${slug}.json`, 'application/json', reportJson(report))}
          >
            <Download /> Export JSON
          </Button>
        </div>
      </details>
    </div>
  )
}
