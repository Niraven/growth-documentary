# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Saved-report copy no longer claims to freeze "the exact response": the server
  computes the frozen report, reusing the 10-minute cache when it can.

### Evidence

- 154 unit tests (49 core, 15 handler, 6 sitemap, 7 store, 43 live, 5 export,
  14 contract, 13 compare, 2 citation); `pnpm check` green.
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

[0.5.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.5.0
[0.4.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.4.0
[0.3.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.3.0
[0.2.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.2.0
