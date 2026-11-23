# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/Niraven/growth-documentary/releases/tag/v0.2.0
