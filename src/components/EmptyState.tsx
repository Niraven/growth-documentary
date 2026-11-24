export function EmptyState() {
  return (
    <aside className="sample receipt" aria-label="Sample report excerpt">
      <header>
        <span className="metadata">Field receipt / Basecamp</span>
        <h2>A change in the pitch</h2>
      </header>
      <div className="sample-quote">
        <a
          className="metadata"
          href="https://web.archive.org/web/20260417062356/https://basecamp.com/pricing"
          target="_blank"
          rel="noreferrer"
        >
          17 Apr 2026 capture ↗
        </a>
        <p>“Pick the package that fits you best.”</p>
      </div>
      <div className="sample-quote">
        <a
          className="metadata"
          href="https://web.archive.org/web/20260529184639/https://basecamp.com/pricing"
          target="_blank"
          rel="noreferrer"
        >
          29 May 2026 capture ↗
        </a>
        <p>“Pick a package and try Basecamp for free.”</p>
        <small className="block mt-3">
          Monthly amounts in this capture: <strong>$50/mo</strong> and <strong>$299/mo</strong>.
        </small>
      </div>
      <a className="sample-link" href="?url=basecamp.com%2Fpricing">
        Open Basecamp report →
      </a>
    </aside>
  )
}
