# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.1] — 2026-11-24

A clean patch for the growth timeline release.

### Fixed

- Removed a synchronous state reset inside the growth-timeline effect. The
  component is keyed by target, so a new target remounts with fresh state while
  React no longer flags a cascading render.
- Aligned package, API and archive user-agent version for the patch.

### Evidence

- 215 tests across 19 files; lint, test, build, the real Basecamp growth QA and
  axe at desktop 1280 and mobile 390 all pass.

## [0.10.0] — 2026-11-24

The product is now a **public growth timeline**, not a page-change viewer with a
documentary skin. The original four-system brief ranked Growth Documentary as a
multi-source reconstruction of a company’s last 12–24 months. This release
implements the first honest version of that contract.

### Added

- **`GET /api/growth?url=`** — composes the page timeline, archived sitemap and
  public-source lanes into one newest-first event list. Every event carries a
  source URL, source family, evidence label and note.
- **Growth timeline in the default report** — page changes, self-reported sitemap
  expansion and public Hacker News signals, filterable by lane. It sits above the
  narrative.
- **Before/after capture links** — a page-change event shows both states as text
  and links to the before and after archive captures where available.
- **Markdown export** — `Copy timeline` exports the same event ids, source URLs
  and limits as the API.
- **`tests/growth.test.ts`** — merge order, baseline exclusion, source-link
  integrity, absent-lane behaviour, unavailable HN behaviour, export parity and
  API boundary validation.
- **`scripts/growth-qa.mjs`** — real Basecamp acceptance and desktop/mobile
  screenshots under `docs/brief-v10/`.
- **`docs/GROWTH-PRODUCT-PROMPT.md`** — the rewritten product brief that the
  implementation is checked against.

### Changed

- The default report and landing copy now lead with the growth timeline. The
  documentary is labelled **Narrative** and reads from the same events.
- The top-level primary action is no longer “Copy documentary”; the timeline owns
  its own copy action. The footer links the MIT source.
- Site pages are labelled **sitemap-dated pages**, not “pages added” as a growth
  claim. Hacker News is labelled **public signals**, not launches.
- Version strings, user agent, spec and docs moved to 0.10.0.

### Evidence

- **215 tests across 19 files**; `pnpm check`, lint, test and production build
  pass. The two pre-existing Fast Refresh warnings remain.
- Real Basecamp `/api/growth`: **18 events** from **three source families**:
  10 page changes, 171 sitemap-dated pages, 6 Hacker News links. All 18 rendered
  events had outbound source links; desktop 1440 and mobile 390 had no horizontal
  overflow.
- axe WCAG 2.1 A/AA: **0 violations** at desktop 1280 and mobile 390 on the
  live growth timeline; no horizontal page overflow at 1440×1100 or 390×844.
- The timeline still does not measure traffic, revenue, conversion, ROAS or cause.
  Ad libraries remain manual.

## [0.9.1] — 2026-11-24

A clean follow-up to the public growth documentary release.

### Fixed

- Removed a render-time mutation used to number documentary scenes. The scene
  numbers are now derived from the immutable chapter list, so React renders and
  lint stay clean.
- Aligned the package, API and archive user-agent version for the patch release.

### Evidence

- 208 unit tests across 18 files; `pnpm check`, lint, test and production build
  pass. The two pre-existing Fast Refresh warnings remain the only lint warnings.
- Real Basecamp documentary acceptance still passes: 17 of 392 captures, 10 field
  changes, 24 months; axe 0 at desktop 1280 and mobile 390.

## [0.9.0] — 2026-11-24

The product now reads as a public growth documentary, not a page-change dashboard.

### Added

- **Documentary surface.** The default report is a three-act reading of the
  archive record: an opening capture, dated chapters of field changes, and a
  closing capture. Each scene links to the archived before and after pages where
  those values were readable. The lede names the period, sample size and the
  opening/closing wording.
- **Copy documentary.** The primary copy action exports the documentary, coverage,
  observations and linked dates as Markdown.
- **Site footprint beside the story.** The archived sitemap page count and dated
  additions are presented as context for the offer record, with a plain statement
  that they are self-reported and not traffic.
- **Public-attention context.** Hacker News and the manual ad libraries remain
  separate evidence lanes below the story; they are not merged into the narrative.
- **Story tests and QA.** `tests/documentary.test.ts` covers opening/closing
  records, year chapters, exact source links, no-change pages and export copy.
  `scripts/documentary-qa.mjs` checks the rendered story against the real API.

### Changed

- The landing, header, How it works and report vocabulary now describe a
  documentary: “Build documentary”, “Story”, “Receipts”, “Site footprint”.
- Compare is explicitly separated from the story and starts with the oldest and
  newest readable captures; the story uses its own dated scenes.
- The old marketing-brief screen was replaced by the documentary. The underlying
  `shared/brief.ts` remains the factual takeaway/scope helper; no data semantics
  changed.

### Evidence

- 208 unit tests across 18 files: previous 200 plus 8 documentary tests.
  `pnpm check`, lint, test and production build pass.
- Real Basecamp run: 17 of 392 listed captures, 10 field changes, 24 months;
  all 10 documentary scenes match the timeline response and the Markdown export
  returns the opening/closing archive links.
- axe-core WCAG 2.1 A/AA: 0 violations at desktop 1280 and mobile 390 on the live
  documentary; no horizontal page overflow.
- Screenshots: `docs/brief-v09/` (desktop and mobile documentary, landing,
  compare, evidence, matrix, changes and stories).

### Limits

- The documentary is anchored to one public offer surface and the site’s archived
  footprint; it is not a crawl of every company page.
- It does not measure traffic, revenue, conversion or causality. The sitemap is
  self-reported context, not a growth metric.
- It samples the archive; gaps remain unread, not unchanged.

## [0.8.0] — 2026-11-24

A marketing-first report surface on the same dated archive evidence.

### Added

- **Marketing brief.** The report opens with a factual takeaway, exact before/after
  wording, monthly-range endpoints, per-row dated archive links, and a clear
  distinction between the latest readable capture and a movement. **Copy brief**
  exports the takeaway, scope, coverage, observations and sources as Markdown.
- **Explicit reading scopes.** The brief uses the latest comparable change for each
  field; Compare starts with the earliest and latest readable captures and names
  that pair. The brief uses monthly amounts only; Compare quotes every archived
  price string exactly, including annual, per-seat and one-time amounts.
- **Landing receipt.** The landing sample now shows a real linked Basecamp headline
  and monthly-price read instead of a generic preview.
- **Chart keys and matrix controls.** The price chart labels range bars,
  price-string changes and the selected month; the matrix defines observation
  counts, reports its month span, keeps field labels visible and provides scroll
  controls.
- **Actionable evidence.** HN story titles are links, the lane offers a clearly
  labelled broader host search, and the manual ad libraries remain outbound links.
- **Mobile controls.** A two-column action grid, 44px targets, local disclosure
  chevrons and reduced-motion support replace the cramped utility row.
- **Design record and checks.** `docs/DESIGN.md` records what was adopted or
  rejected from the six named design references. `scripts/brief-qa.mjs` verifies
  the rendered brief against the API; the mobile axe check is documented.

### Changed

- The report hierarchy is now “What moved” first, then Compare, the evidence
  record, changes, and public context. The visual system is a neutral zinc field
  receipt with opaque surfaces and solid primary buttons.
- No server extraction, archive, source or privacy behaviour changed in this
  release. The version and archive user agent are now 0.8.

### Evidence

- 200 unit tests across 17 files: the previous 189 plus 10 brief tests and one
  additional compare test. `pnpm check`, lint, test and production build pass.
- axe-core WCAG 2.1 A/AA: 0 violations at desktop 1280 and mobile 390 on the live
  Basecamp report; no horizontal page overflow.
- Live `basecamp.com/pricing`: 17 of 392 listed captures, 10 field changes, 24
  months; the brief’s copied Markdown, Compare date changes, matrix scrolling and
  story links were exercised against the real report.
- Screenshots: `docs/brief-v08/` (desktop and mobile landing, brief, compare,
  charts, matrix, evidence, changes and stories).

## [0.7.0] — 2026-11-24

A report that shows more of the public web, while keeping the dated page evidence
separate from the context.

### Added

- **Evidence lanes.** A new report section checks four public lanes independently:
  Internet Archive (the only source of dated changes), Arquivo.pt (a second public
  archive index), Hacker News (stories whose submitted URL points at the host), and
  the four manual ad libraries. Each lane shows `read`, `no rows` or `unread`; a
  blocked provider is never zero. A lane failure does not fail the timeline.
- **Arquivo.pt coverage.** A keyless public archive index is queried for each
  target; the newest unique captures are linked to the replay page. It is a
  coverage lane, not a second dated diff.
- **Hacker News lane.** Public story titles, dates, points, comments and discussion
  links are shown for stories whose submitted URL host matches the target. The
  lane counts links, not name mentions or comments, and states its last-two-year,
  100-result cap.
- **`GET /api/sources`.** A cached, rate-limited endpoint returns both public lanes
  with explicit statuses and notes.
- **Change matrix.** A calendar heatmap of page-title, headline and price-string
  observations by month. The baseline is excluded; empty months stay visible.
- **Mentions chart.** Monthly matched-story counts over the last 25 calendar months, tied to the cited story list.

### Changed

- The report now distinguishes **dated page evidence** from **public context** in
  both layout and copy. Arquivo.pt is not merged into the Wayback diff.
- README, SPEC, source matrix and screenshots document the lanes and the new API.

### Evidence

- 189 unit tests: 51 core, 16 handler, 6 sitemap, 7 store, 50 live, 5 export,
  14 contract, 16 compare, 2 citation, 3 ad-link, 2 archive-url, 8 price-axis,
  3 mentions, 2 Arquivo, 2 source router, 2 change-matrix.
- `pnpm check` green; independent review of the exact release tree.
- axe-core WCAG 2.1 A/AA: 0 violations on the report.
- Live source check: `basecamp.com/pricing` → 17 HN stories, Arquivo.pt estimate
  42 captures; both lanes rendered with their own status.

## [0.6.0] — 2026-11-24

A free visual view, free ad-library links, and a price chart rebuilt around the
actual reading.

### Added

- **Archived page view.** Every report can load the selected capture's Internet
  Archive copy in a sandboxed iframe. It is free (no screenshot API, no key), loads
  only on request, and states that it renders archived HTML rather than a
  pixel-perfect screenshot. The iframe has no top navigation or popups and the app
  never proxies the archived page.
- **Ad libraries (manual, free).** Four external links — Meta, Google, TikTok and
  LinkedIn — pre-filled with the domain. The server never fetches them. The panel
  says why: no free official API returns general US commercial ads; Meta's free API
  is political/EU, Google's dataset is political. `docs/AD-SOURCES.md` records the
  source limits and the licensed-provider path.
- **Price chart selection.** Click or keyboard-select any month to see its range
  and every distinct monthly amount; the header and footer distinguish the selected
  month from the latest month.

### Changed

- **Price chart rebuilt** as one bar per calendar month with one x-axis slot per
  month. This makes empty months visible instead of compressing them away. Bars are
  labelled month + year (alternating only when the span is too dense), the axis uses
  round 1/2/5 ticks ($0–$400 here), selected bars show exact endpoint caps, and a
  triangle above the plot marks a month with a price-change row. The band and its
  interpolated diagonals are gone: a range is a bar, not a continuous series.
- Price-change markers moved above the plot so they cannot be read as negative
  prices below $0.

### Fixed

- Month labels no longer collapse to endpoint-only dates; every bar has a month and
  a two-digit year.
- Year dividers are drawn at January boundaries without floating year words over
  unrelated bars.
- The selected month's values are no longer drawn to the left of the bar where they
  could be read as the previous month's.

### Evidence

- 179 unit tests (51 core, 15 handler, 6 sitemap, 7 store, 50 live, 5 export,
  14 contract, 16 compare, 2 citation, 3 ad-link, 2 archive-url, 8 price-axis); `pnpm check` green.
- axe-core WCAG 2.1 A/AA: 0 violations on the report with archived view, ad links
  and the rebuilt chart.
- Chart, archived view, ad panel and full report reviewed at full resolution.
- Archived view verified against the 18 Nov 2026 Basecamp capture; the archived page
  rendered in the sandboxed frame.

## [0.5.0] — 2026-11-24

Visual evidence: compare any two captures, read a monthly price range, and cite the report.

### Added

- **Compare captures.** Two selectors over the captures already read, side by side.
  Page title uses a character-level diff so `Basecamp: Pricing` → `Basecamp — Pricing`
  reads as a punctuation swap, not a replaced word. Headline uses a word diff;
  when less than 35% of words are shared, both states are shown whole instead of
  weaving two sentences into one that neither capture contained.
- **Monthly price range.** One bar per month with monthly price strings: the
  lowest and highest amount read that month. Annual, one-time and per-seat
  amounts are excluded; the caption calls it a range, not an index.
- **Cite.** Copies a citation with the coverage window, captures read, field
  changes, access date and source link.
- **`GET /api`** returns the endpoint list, version and docs link.

### Changed

- Price lists in compare are sorted by numeric amount, not lexicographically.
- Price removals/additions are labelled words, not minus/plus glyphs that read as
  negative prices.
- The design-system page, price range and compare views are lazy-loaded; main
  bundle is 489.8 kB (152.2 kB gzip), down from 500 kB.

### Fixed

- Word diff could show an insertion before its replacement, producing impossible
  sentences; removals now read first and whole replacements are not interleaved.
- Character-level diff makes punctuation-only title changes legible.
- Price range bars no longer overlap when several captures fall in one month; the
  chart aggregates by month and says so.
- The chart axis uses round ticks instead of an observed-high midpoint that looked
  like a price tier.
- **Security findings from the second review, all fixed:**
  - robots.txt is now evaluated for the **path that will actually be read**,
    including before following a same-host redirect. A redirect to a disallowed
    path is refused without fetching it.
  - robots.txt is matched against **path plus query** and supports `$` anchors.
  - A missing rules file (5xx, unreadable, off-host redirect) now **fails closed**
    instead of reading the page.
  - IPv4-compatible, NAT64, 6to4 and site-local IPv6 ranges are rejected as
    non-public, alongside the mapped/private ranges already covered.
  - The 15-second budget now includes DNS resolution, not just HTTP.
  - The robots matcher no longer compiles attacker-controlled patterns to
    regexes: a bounded dynamic-programming wildcard matcher plus rule-length and
    rule-count caps removes the catastrophic-backtracking stall. A hostile-pattern
    regression test asserts the match stays under 50 ms.
  - Unanchored wildcard rules are matched as **prefixes** again; a 12-case table
    covers `/*?`, `/*.pdf`, `/*/print`, `*a`, query suffixes and `$` anchors.
  - IPv6 addresses are parsed to bytes, so IPv4-compatible forms such as
    `::7f00:1`, uncompressed IPv4-mapped forms and IPv4-translated forms are
    rejected too, not only their canonical spellings.
- Price range excludes per-unit `/mo` strings end to end: extraction now keeps
  the qualifier (`$15/mo per seat`, `$8.75/user/mo`), and the chart filter drops
  it. Cents are preserved (`$8.75`, not `$9`).
- Citations use the local calendar date, matching the saved/read timestamps in
  the UI.
- Saved-report copy no longer claims to freeze "the exact response": the server
  computes the frozen report, reusing the 10-minute cache when it can.

### Evidence

- 165 unit tests (51 core, 15 handler, 6 sitemap, 7 store, 50 live, 5 export,
  14 contract, 15 compare, 2 citation); `pnpm check` green.
- axe-core WCAG 2.1 A/AA: 0 violations on the report with both new panels.
- Live report on 24 Nov 2026: 17 of 392 captures, 10 field changes; compare and
  chart reviewed at full resolution.

## [0.4.0] — 2026-11-24

Saved reports, exports, and an opt-in live check that is deliberately not history.

### Added

- **Saved reports.** `POST /api/reports` freezes the exact computed timeline in
  `data/reports.json`; `GET /api/reports` lists, `GET /api/reports/:id` reopens,
  `DELETE` removes. Random ids, 200-report cap, atomic writes, serialised
  mutations. A saved copy is never recomputed on read.
- **CSV and JSON export** in the browser. CSV cells that begin with a formula
  marker are neutralised so a spreadsheet cannot execute them.
- **Live check** (`GET /api/live`), behind a button: one read of the current page
  after DNS/public-address validation and a robots.txt check. HTML only, no
  cookies, same-host redirects, 2 MB cap, 15 s budget. The result is compared
  with the latest capture but never becomes a dated change.
- A saved-report link (`#report/<id>`), saved list, and per-card delete with a
  confirm step.

### Changed

- The design-system page is lazy-loaded; the main bundle drops from 540 kB to
  487 kB (151 kB gzip).
- Saved reports are labelled **Saved report**, hide the duplicate Share button,
  and state that rebuilding creates a new, separate report.
- Footer no longer claims the tool never contacts the live site; it says the live
  check is opt-in and never counted as a change.
- Timestamps carry a timezone; saved and live times are labelled.

### Fixed

- A formatting option that combined `dateStyle` with `timeZoneName` threw at
  runtime and blanked the app. Replaced with explicit date parts.
- The header Saved control no longer sets an accessible name that omits its
  visible count (axe `label-content-name-mismatch`).

### Evidence

- 126 unit tests (49 core, 14 handler, 6 sitemap, 7 store, 31 live, 5 export, 14
  contract); `pnpm check` green.
- axe-core WCAG 2.1 A/AA: 0 violations on the landing screen, a saved report and
  the saved list.
- Live end-to-end on 24 Nov 2026: save `basecamp.com/pricing` → 201, 10 field
  changes; list → 1; reopen → full report; live check → 200 in 0.6 s with
  `robots: allowed`; delete → 204.

## [0.3.0] — 2026-11-24

Deeper sampling, a coverage view, and the site's own sitemap as a second layer.

### Added

- **Adaptive sampling:** up to 24 captures across two years. Twelve are spaced by
  farthest-point sampling (first and last always kept), then extra captures are
  read around every observed change.
- **Coverage** in the API and the report: first and last capture, month span,
  captures sampled, captures listed, and a strip that marks every read and every
  day a change was found.
- **`GET /api/site`:** the site's archived sitemap — page count, dated entries,
  additions per month, archived copy date. The panel states when `lastmod` dates
  cluster and cannot time growth.
- Same-day field changes are grouped under one date; the first row is labelled
  Baseline and excluded from the change count.
- A real two-row example on the landing screen, both rows linked to their captures.

### Changed

- Price strings are normalised (`$25 /mo` → `$25/mo`) and displayed in a stable
  amount order, so a page that only reorders its tiers is not reported as a change.
- Price rows show the full before/after lists rather than a delta with an
  unexplained dash.
- The report now states how it was sampled, including the 400-snapshot index cap.
- Share appears only when there is a report to share.

### Fixed

- An order-only price shuffle no longer produces a price change row.
- The report title no longer breaks mid-word on long URLs.

### Evidence

- 71 unit tests (49 core, 10 handler, 6 sitemap, 6 contract); `pnpm check` green.
- axe-core WCAG 2.1 A/AA: 0 violations on the landing screen and a live report.
- Live run: `basecamp.com/pricing` → 17 of 392 listed captures, 10 field changes,
  24 months, ~17–23 seconds warm.

## [0.2.0] — 2026-11-24

First public release. A dated, sourced record of what changed on a public page.

### Added

- `GET /api/timeline?url=` — Wayback CDX lookup, snapshot reading, extraction and
  diffing, with one archive link per change.
- `GET /api/health` — liveness for the mounted API.
- Shareable report URLs: `/?url=<target>` re-runs the query on load.
- Live report UI: capture log, dated change rows, receipts, empty and error states.
- Design sheet at `#system` (type, colour, components) for contributors.
- Ten-minute in-memory cache (`x-cache`) and an 8/minute per-client quota (`429`).
- `pnpm a11y` — axe-core WCAG 2.1 A/AA scan of a running build.

### Changed

- Extraction runs on a parsed DOM (`parse5`) instead of regular expressions, so
  script, style, template and noscript content can never supply evidence.
- Consecutive captures are compared field by field; a field missing from either
  side is a gap, not a deletion.
- The Stripe example states exactly which captures it reads and what it does not
  prove.

### Fixed

- Nested templates, and a literal closing tag inside a quoted attribute, could
  leak hidden headlines and prices into a report.
- The cache key now includes scheme, port, path case and query, so one origin's
  report cannot be served for another.
- Root-dotted local names (`printer.local.`) are rejected before any network call.
- A malformed CDX payload returns `502`, not an empty archive.
- Rows without a valid timestamp no longer trigger a trailing delay or a timeout.
- The rate-limit map is capped at 5,000 clients.

### Security

- Outbound redirects are followed manually, at most three hops, and only to
  `https://web.archive.org`; the target site is never contacted directly.
- Invalid, private, local and IP-literal targets fail `400` before any fetch.

### Evidence

- 50 unit tests (41 core, 9 handler); `pnpm check` and the production build pass.
- axe-core WCAG 2.1 A/AA: 0 violations on the fixture and a live report.
- Live run at release: `basecamp.com/pricing` → 12 readable captures, 6 change rows.
- Independent review approved the release commit (parse5 extraction).

[0.10.1]: https://github.com/Niraven/growth-documentary/releases/tag/v0.10.1
[0.10.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.10.0
[0.9.1]: https://github.com/Niraven/growth-documentary/releases/tag/v0.9.1
[0.9.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.9.0
[0.8.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.8.0
[0.7.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.7.0
[0.6.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.6.0
[0.5.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.5.0
[0.4.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.4.0
[0.3.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.3.0
[0.2.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.2.0
