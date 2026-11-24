import type { Change, Timeline } from '../../shared/timeline'
import { growthDocumentary } from '../../shared/documentary'
import { SiteGrowth } from '@/components/SiteGrowth'

const fieldLabel: Record<Change['field'], string> = {
  title: 'Page title',
  headline: 'Headline',
  price: 'Price strings',
  'first capture': 'Opening record',
}

function CaptureLine({
  capture,
  label,
}: {
  capture: NonNullable<ReturnType<typeof growthDocumentary>['opening']>
  label: string
}) {
  return (
    <div className="documentary-capture">
      <div className="documentary-capture-top">
        <span className="metadata">{label}</span>
        <a href={capture.url} target="_blank" rel="noreferrer">
          Open capture ↗
        </a>
      </div>
      <p className="documentary-quote">
        {capture.h1 || capture.title ? `“${capture.h1 || capture.title}”` : 'No headline readable.'}
      </p>
      <p className="documentary-verbatim">
        Verbatim archive text; spelling and grammar are the page’s.
      </p>
      {capture.h1 && capture.title && (
        <p className="documentary-page-title">Page title: {capture.title}</p>
      )}
      <p className="documentary-prices">
        {capture.prices.length > 0
          ? `Price strings read: ${capture.prices.join(' · ')}`
          : 'No price strings were readable in this capture.'}
      </p>
    </div>
  )
}

function Scene({
  scene,
  index,
}: {
  scene: ReturnType<typeof growthDocumentary>['chapters'][number]['scenes'][number]
  index: number
}) {
  const { change, before, after } = scene
  return (
    <li className="documentary-scene">
      <span className="documentary-scene-index">{String(index).padStart(2, '0')}</span>
      <div>
        <div className="documentary-scene-top">
          <span className="metadata">
            {change.label} · {fieldLabel[change.field]}
          </span>
          <div className="documentary-links">
            {before && (
              <a href={before.url} target="_blank" rel="noreferrer">
                Before ↗
              </a>
            )}
            {after && (
              <a href={after.url} target="_blank" rel="noreferrer">
                After ↗
              </a>
            )}
          </div>
        </div>
        <div className="documentary-change">
          <span className="documentary-before">{change.before || '—'}</span>
          <span aria-hidden="true">→</span>
          <span className="documentary-after">{change.after || '—'}</span>
        </div>
      </div>
    </li>
  )
}

/** A documentary reading of the same timeline: opening record, dated chapters, closing record. */
export function Documentary({ report }: { report: Timeline }) {
  const story = growthDocumentary(report)
  const { opening, closing } = story
  let sceneNumber = 0

  return (
    <section
      id="documentary"
      tabIndex={-1}
      className="documentary"
      aria-labelledby="documentary-title"
    >
      <header className="documentary-masthead">
        <div className="documentary-kicker">
          <span className="metadata">Public growth documentary</span>
          <span className="metadata">{story.coverage}</span>
        </div>
        <h2 id="documentary-title">{story.headline}</h2>
        <p className="documentary-period">{story.period}</p>
        <p className="documentary-lede">{story.lede}</p>
      </header>

      <div className="documentary-grid">
        <div className="documentary-story">
          <div className="documentary-act">
            <span className="documentary-act-label">Act I · the opening record</span>
            {opening ? (
              <CaptureLine capture={opening} label={opening.label} />
            ) : (
              <p className="documentary-empty">No readable opening capture.</p>
            )}
          </div>

          <div className="documentary-act">
            <div className="documentary-act-heading">
              <span className="documentary-act-label">Act II · what the record shows</span>
              <span className="metadata">
                {story.chapters.reduce((total, chapter) => total + chapter.scenes.length, 0)} field
                changes
              </span>
            </div>
            {story.chapters.length > 0 ? (
              story.chapters.map((chapter) => (
                <section key={chapter.year} className="documentary-chapter">
                  <div className="documentary-chapter-heading">
                    <h3>{chapter.year}</h3>
                    <span>{chapter.period}</span>
                  </div>
                  <ol>
                    {chapter.scenes.map((scene) => {
                      sceneNumber += 1
                      return (
                        <Scene
                          key={`${scene.change.ts}-${scene.change.field}`}
                          scene={scene}
                          index={sceneNumber}
                        />
                      )
                    })}
                  </ol>
                </section>
              ))
            ) : (
              <p className="documentary-empty">
                No comparable field change was observed in the sampled captures. The opening and
                closing records still show what was readable.
              </p>
            )}
          </div>

          <div className="documentary-act">
            <span className="documentary-act-label">Act III · the closing record</span>
            {closing ? (
              <CaptureLine capture={closing} label={closing.label} />
            ) : (
              <p className="documentary-empty">No readable closing capture.</p>
            )}
          </div>
        </div>

        <aside className="documentary-aside">
          <div className="documentary-aside-heading">
            <span className="metadata">Growth signals</span>
            <p>
              The site’s own archived sitemap is shown beside the offer record. It is self-reported
              page count, not traffic.
            </p>
          </div>
          <SiteGrowth key={`${report.domain}${report.path}`} target={`${report.domain}${report.path}`} />
          <div className="documentary-note">
            <span className="metadata">What this cannot prove</span>
            <p>{story.note}</p>
            <p>
              Public discussion and manual ad-library links are in the{' '}
              <a href="#evidence">evidence ledger</a>. They are context, not page-change evidence.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
