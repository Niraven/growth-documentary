import { useState } from 'react'
import { ExternalLink, Eye } from 'lucide-react'
import type { Capture } from '../../shared/timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isArchiveUrl } from '@/lib/archiveUrl'

const selectClass =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

/**
 * A free visual view of an archived capture. It renders the archived HTML in a
 * sandboxed iframe — not a pixel screenshot, and not a paid screenshot API.
 * The user opts in because archived pages can pull many assets.
 */
export function ArchivePreview({ captures }: { captures: Capture[] }) {
  const [selectedTs, setSelectedTs] = useState(captures[captures.length - 1]?.ts ?? '')
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  if (captures.length === 0) return null
  const capture = captures.find((entry) => entry.ts === selectedTs) ?? captures[captures.length - 1]
  const archiveUrl = isArchiveUrl(capture.url) ? capture.url : null

  const load = () => {
    setLoading(true)
    setLoaded(true)
  }
  return (
    <Card className="mt-3" data-testid="archive-preview">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Archived page view
            </p>
          </div>
          <span className="text-[10.5px] text-muted-foreground">Internet Archive · archived HTML</span>
        </div>

        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
          Opens the Internet Archive&apos;s copy of this page in a sandboxed frame. It is not a
          pixel-perfect screenshot: scripts, fonts or external assets may be missing, and some
          pages refuse to render.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Capture
            </span>
            <select
              className={selectClass}
              value={capture.ts}
              onChange={(event) => {
                setSelectedTs(event.target.value)
                setLoading(true)
              }}
            >
              {[...captures].reverse().map((entry) => (
                <option key={entry.ts} value={entry.ts}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            {!loaded && (
              <Button variant="outline" onClick={load} disabled={!archiveUrl}>
                <Eye />
                Load archived view
              </Button>
            )}
            {archiveUrl && (
              <a
                href={archiveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
              >
                Open capture <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>

        {!loaded && (
          <div className="mt-3 flex h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
            <Eye className="size-5 text-muted-foreground" />
            <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              The archived page loads here. No screenshot service and no key: this is the Internet
              Archive&apos;s own copy, rendered in a sandboxed frame.
            </p>
          </div>
        )}

        {loaded && archiveUrl && (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted/30">
            <iframe
              key={capture.ts}
              src={archiveUrl}
              title={`Archived page for ${capture.label}`}
              className="h-[520px] w-full bg-white"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              onLoad={() => setLoading(false)}
            />
          </div>
        )}

        {loaded && !archiveUrl && (
          <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-3 text-[12px] text-muted-foreground">
            This capture has no fixed Internet Archive URL, so it is not loaded.
          </p>
        )}

        {loaded && loading && (
          <p className="mt-2 text-[11px] text-muted-foreground" role="status">
            Loading the archived page. Large pages can take a few seconds.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
