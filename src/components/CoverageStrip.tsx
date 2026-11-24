import type { Capture, Change } from '../../shared/timeline'
import { tsToMs } from '../../shared/timeline'

type Props = {
  captures: Capture[]
  changes: Change[]
}

/**
 * A small, honest picture of the sampling: every dot is a capture that was
 * read, every taller tick is a capture where a change was observed. The gaps
 * between dots are part of the story, so they are visible rather than smoothed.
 */
export function CoverageStrip({ captures, changes }: Props) {
  if (captures.length === 0) return null

  const start = tsToMs(captures[0].ts)
  const end = tsToMs(captures[captures.length - 1].ts)
  const span = Math.max(1, end - start)
  const position = (ts: string) => ((tsToMs(ts) - start) / span) * 100

  const changeTs = new Set(changes.filter((change) => change.field !== 'first capture').map((c) => c.ts))
  const summary = `${captures.length} captures from ${captures[0].label} to ${
    captures[captures.length - 1].label
  }, with ${Math.max(0, changes.length - 1)} observed changes marked.`

  return (
    <div>
      <div
        role="img"
        aria-label={summary}
        className="relative h-12 select-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {captures.map((capture) => {
          const left = `${position(capture.ts)}%`
          const marked = changeTs.has(capture.ts)
          return (
            <span
              key={capture.ts}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left }}
              title={`${capture.label}${marked ? ' · change observed' : ''}`}
            >
              {marked ? (
                <span className="block h-6 w-1 rounded-full bg-foreground" />
              ) : (
                <span className="block size-2.5 rounded-full bg-good" />
              )}
            </span>
          )
        })}
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{captures[0].label}</span>
        <span>{captures[captures.length - 1].label}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-4 font-mono text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-good" /> capture read
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-1 rounded-full bg-foreground" /> day with change
        </span>
      </div>
      <ul className="sr-only">
        {changes.map((change, index) => (
          <li key={`${change.ts}-${change.field}-${index}`}>
            {change.label}: {change.field}
          </li>
        ))}
      </ul>
    </div>
  )
}
