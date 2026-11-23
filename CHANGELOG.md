# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.3.0
[0.2.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.2.0
