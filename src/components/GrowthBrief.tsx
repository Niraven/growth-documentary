import { ArrowDownRight, ArrowUpRight, ArrowRight, Loader2 } from 'lucide-react'
import type { GrowthBrief } from '../../shared/growthBrief'

type CoverageLevel = 'multi-source' | 'limited' | 'thin'

type Props = {
  brief: GrowthBrief
  coverage: CoverageLevel
  pending: boolean
  failed: boolean
  onCopy?: () => void
  copying?: boolean
  canCopy?: boolean
}

const lane = (ok: boolean, pending: boolean, failed: boolean, read: string, unread: string): string => {
  if (ok) return read
  if (pending) return 'reading'
  return failed ? 'unread' : unread
}

function SampleBar({ percent }: { percent: number }) {
  const width = Math.max(2, Math.min(100, percent))
  return (
    <div className="sample-bar" aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  )
}

export function GrowthBriefPanel({
  brief,
  coverage,
  pending,
  failed,
  onCopy,
  copying = false,
  canCopy = false,
}: Props) {
  const changed = Boolean(
    brief.headline?.changed || brief.price?.changed || brief.counts.pageChanges > 0,
  )
  const pageLabel = pending
    ? 'reading'
    : lane(true, pending, failed, `${brief.counts.pageChanges} page-field edits`, 'no page-field edits')
  const siteLabel = lane(
    brief.lanes.site,
    pending,
    failed,
    brief.counts.siteAdditions > 0
      ? `${brief.counts.siteAdditions.toLocaleString()} sitemap-dated pages`
      : 'site surface read; no dated additions',
    'site surface unread',
  )
  const signalLabel = lane(
    brief.lanes.publicSignals,
    pending,
    failed,
    `${brief.counts.publicSignals} Hacker News links`,
    'Hacker News unread',
  )
  const releaseLabel = lane(
    brief.lanes.feeds,
    pending,
    failed,
    `${brief.counts.releases} release entries`,
    'release feed unread',
  )

  return (
    <section id="growth-brief" className="growth-brief" aria-labelledby="growth-brief-title" data-testid="growth-brief">
      <header className="growth-brief-header">
        <div>
          <span className="metadata">At a glance · observed public record</span>
          <h2 id="growth-brief-title">What changed, and what this sample can support.</h2>
        </div>
        <span className={`brief-level brief-level-${coverage}`}>{coverage.replace('-', ' ')} public record</span>
      </header>

      <div className="growth-brief-grid">
        <div className="growth-brief-reading">
          <p className="growth-brief-lede">
            {changed ? (
              <>
                In <strong>{brief.sampled} of {brief.listed}</strong> listed captures across{' '}
                <strong>{brief.months} months</strong> ({brief.from} → {brief.to}), this record shows{' '}
                {brief.counts.pageChanges} page-field edits.
                {brief.price?.changed && (
                  <>
                    {' '}
                    The lowest–highest monthly price read moved from{' '}
                    <strong className="price-range">{brief.price.before}</strong> to{' '}
                    <strong className="price-range">{brief.price.after}</strong>.
                  </>
                )}
                {brief.headline?.changed && (
                  <>
                    {' '}
                    The latest sampled headline reads <q>{brief.headline.after}</q>
                  </>
                )}
              </>
            ) : (
              <>
                In <strong>{brief.sampled} of {brief.listed}</strong> listed captures across{' '}
                <strong>{brief.months} months</strong> ({brief.from} → {brief.to}), the fields this
                tool reads did not change. That is a sampled result, not proof nothing happened.
              </>
            )}
          </p>

          <dl className="growth-brief-points">
            <div>
              <dt>Page record</dt>
              <dd>{pageLabel}</dd>
            </div>
            <div>
              <dt>Site surface</dt>
              <dd>{siteLabel}</dd>
            </div>
            <div>
              <dt>Public signals</dt>
              <dd>{signalLabel}</dd>
            </div>
            <div>
              <dt>Release feed</dt>
              <dd>{releaseLabel}</dd>
            </div>
          </dl>
        </div>

        <aside className="growth-brief-evidence" aria-label="Sample coverage">
          <div className="growth-brief-evidence-head">
            <span className="metadata">Sample coverage</span>
            <span className="growth-brief-fraction">
              {brief.sampled} <span>/ {brief.listed}</span>
            </span>
          </div>
          <SampleBar percent={brief.percent} />
          <p className="growth-brief-sample">
            {brief.percent}% of listed captures read
            {brief.unsampled > 0 ? ` · ${brief.unsampled.toLocaleString()} not sampled` : ''}.
            Gaps are unread, not unchanged.
          </p>
          <p className="growth-brief-total">
            {brief.counts.events} dated observations · {brief.counts.pageChanges} page edits ·{' '}
            {brief.counts.siteAdditions.toLocaleString()} sitemap-dated pages in{' '}
            {brief.counts.siteMonths} months · {brief.counts.publicSignals} HN links
          </p>
          <p className="growth-brief-note">
            Public evidence is not revenue, traffic, conversion or cause. A missing lane is unread,
            never zero.
          </p>
        </aside>
      </div>

      <div className="growth-brief-actions">
        <a href="#growth-events">
          Read the dated record <ArrowDownRight aria-hidden="true" />
        </a>
        <a href="#evidence">
          Inspect the evidence <ArrowRight aria-hidden="true" />
        </a>
        {onCopy && (
          <button type="button" className="brief-copy" onClick={onCopy} disabled={!canCopy || copying}>
            {copying ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {copying ? 'Copying…' : 'Copy timeline'}
          </button>
        )}
        <span className="growth-brief-actions-note">
          <ArrowUpRight aria-hidden="true" /> The dated rows below link to their sources.
        </span>
      </div>
    </section>
  )
}
