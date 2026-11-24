# Product spec — Growth Documentary

Status: implemented (v0.11.0). This file is the contract; the README explains usage.

## Problem

Competitive research produces undated screenshots or unsourced claims. Both are unusable in a pitch, a deck or a sales call, where the first follow-up question is "says who?". A page diff alone is also incomplete: it cannot show site expansion or public attention.

## Job to be done

When I need to understand how a competitor’s public growth changed, I want one dated timeline built from independent public sources — page changes, site expansion and public signals — with a source link and an evidence label behind every event, so I can present the sequence without guessing or overclaiming.

## Users

| User | Trigger | Success |
|---|---|---|
| Agency owner | Pitching a prospect | Sends a sourced growth timeline showing dated competitor signals |
| Founder | Rival changed pricing or launched publicly | Sees the sequence and the receipt without weekly manual checks |
| Sales team | Competitor raised prices or expanded its site | Builds a call list with dated sources |
| Analyst | Repeating a teardown next quarter | Reopens the frozen report and compares it with a fresh one |

## Contract

**Input:** one public page URL or domain.

**Timeline output:**

1. one `first capture` baseline entry per report;
2. `title`, `headline` and `price` changes between consecutive readable captures;
3. for each entry: date label, field, before, after, archive URL;
4. `coverage`: first and last readable capture, month span, captures sampled, captures listed, sampling strategy;
5. `checkedAt` timestamp.

**Growth timeline output (`GET /api/growth?url=`):**

`{ target, period, coverage, events, counts, sources, caveats, checkedAt }`.

Each `GrowthEvent` has `id`, `date`, `label`, `type` (`page change`, `site expansion`, `public signal`, `release`), `title`, `detail`, `source`, `sourceUrl`, `evidence` (`dated capture`, `self-reported`, `public post`, `published feed`) and `note`. Page-change events also carry `before`, `after`, `beforeUrl` and `afterUrl` when readable. Events are newest-first. A missing site, feed or public lane produces no event and an explicit caveat; it is never zero-filled. The endpoint composes the existing timeline, site, source and feed builders; it does not add a second crawler.

**Site graph output (`GET /api/sitegraph?url=`):** a bounded same-origin page graph with `robotsUrl`, `sitemapUrl`, `pages`, `pageTypes`, `discovered`, `fetched`, `skipped` and `notes`. It reads public HTML only, caps pages, follows same-origin links only and rejects private addresses. It is a current site-surface read, not a historical series.

**Signals output (`GET /api/signals?url=`):** independent `feeds` and `jobs` lanes. Feed entries carry `title`, `url`, `publishedAt` and `summary`; a missing feed is `unavailable`, not a quiet period. Jobs carries provider, board URL, open-role count and a capped role list; it is a current ATS snapshot, not historical hiring. Neither lane is a growth metric.

**Coverage gate:** `multi-source` requires page history plus two context lanes and a sampled history; `limited` means page history with thinner context; `thin` means no dated page history. The gate never implies completeness. **First-party CSV outcomes** are local-only and are not public evidence or causal proof.

**Saved report output:** `{ id, savedAt, report }`. The API computes the report server-side from the URL and freezes that result; a client-supplied report object is ignored. The stored report is never recomputed on read. A save of the same `domain + path + checkedAt` is idempotent and returns the existing id.

**Derived views (client-side, no new claims):**

- **Growth timeline:** the default merged view. Page changes come from the Internet Archive; site expansion comes from the site’s own archived sitemap `lastmod` claims; public signals are Hacker News stories whose submitted URL host matches the target. Every event has a source URL and evidence label. The timeline is not a growth score, traffic estimate or causal model.
- **Documentary:** a three-act narrative reading of the same timeline. The opening record is the first readable capture; chapters group dated field changes by year; the closing record is the latest readable capture. Each scene links to the archived before/after capture where those values were readable. It adds no event and no cause. A page with no comparable field changes still has an opening and closing record, not an invented change.
- **Compare:** any two readable captures from the same report. Page title uses a character-level LCS; headline uses a word-level LCS; a replacement with less than 35% shared words is shown as two whole states, not an interleaved sentence. Price deltas are labelled Removed/Added.
- **Monthly price range:** one bar per calendar month in which monthly (`/mo`, `/month`) price strings were read. The x-axis keeps one slot per month, so empty months are visible gaps. Each bar is the min–max of those strings; annual, one-time and per-seat amounts are excluded. A triangle above the plot marks a month with a price-change row. With fewer than two such months the chart is not rendered.
- **Change matrix:** one cell per field (`title`, `headline`, `price`) per calendar month, baseline excluded. Empty months stay visible. Shade encodes the number of observations in that field/month, not a price, a trend or a growth rate.
- **Evidence lanes:** independent public lanes for Internet Archive (dated page evidence), Arquivo.pt (second archive index), Hacker News (public stories whose submitted URL host matches the target), sitemap (page count), and ad libraries (manual links). A lane is `read`, `no rows` or `unread`; while loading it says `reading`. An unavailable lane is never a zero. Only the Internet Archive lane feeds dated changes.
- **Mentions chart:** monthly count of matched HN stories over the last 25 calendar months, with the top stories linked. It is public discussion, not a truth score or a complete count.
- **Archived page view:** an opt-in sandboxed iframe of the selected capture's `web.archive.org` URL. It is a rendering of archived HTML, not a pixel screenshot, and creates no new claim. No server-side browser, no screenshot service, no proxying.
- **Ad libraries:** four external, pre-filled links to public ad libraries (Meta, Google, TikTok, LinkedIn). The server never fetches them. They are not evidence rows and do not imply spend. There is no free official API for general US commercial ads; an optional licensed provider is the only future automatic path.
- **Citation:** coverage window, captures read, field changes (baseline excluded), access date, source link.

**Live check output:** `{ domain, path, fetchedAt, finalUrl, title, h1, prices, robots: "allowed" }`. It is not a `Capture`, has no archive timestamp, and never enters the timeline.

**Site output:** page count, dated entries, additions per month, archived copy date, and a plain note when no sitemap exists.

**Sources output:** `{ domain, checkedAt, mentions, archives }`. `mentions` is `{ provider, status, total, truncated, months, stories, note, checkedAt }`; `archives` is `{ provider, status, count, first, last, captures, note, checkedAt }`. `archives.count` is the number of unique rows inspected, not the provider's estimate; the note carries the estimate. Both lanes are independently optional: a blocked provider returns `status: "unavailable"` with a note, not an empty array presented as zero.

**Sampling**

- Query CDX for the exact normalised URL, query string included, from two years ago, capped at 400 rows.
- Pick up to 12 captures with farthest-point spacing: first and last always kept, then the capture furthest from everything chosen so far.
- Read them three at a time. Diff.
- For every observed change, add the capture halfway between it and the previous sample, up to a budget of 24.
- Report what was read, what was listed, and that gaps are unread.

**Hard requirements**

- Every displayed change links to a real capture URL.
- No revenue, traffic, conversion or causal claims anywhere in UI copy.
- Unreadable captures are skipped, never reported as deletions.
- A field that is empty on either side is a gap, never a deletion.
- Price before/after values are the full sorted lists, not a delta.
- Invalid targets fail with a 4xx and a human sentence, before any network call.
- Dev and production serve the same handler.
- The dated timeline reads only from `web.archive.org`; sitemaps are read from their archived copy.
- Source lanes are independent: an unavailable HN or Arquivo.pt check must not fail the timeline, and must not be rendered as zero.
- HN counts only stories whose submitted URL host matches the target; title-only mentions and comments are not counted.
- Arquivo.pt is a coverage lane only; it does not create dated changes unless a future adapter carries capture provenance and passes the same tests.
- The change matrix may only count changes already present in the report; it may not interpolate or infer a missing month.
- The live check is opt-in, per-request, and runs only after robots.txt allows it.
- Saved reports are local, bounded, and written atomically; they are never recomputed on read.
- A comparison view may only use captures already present in the report; it may not fetch or infer a missing capture.
- A documentary may only use captures and changes already present in the report; it may not fetch another page, infer a missing capture or turn a sitemap page count into traffic.
- A price chart may only plot monthly amounts that were actually extracted; it may not interpolate or impute a missing month.

**Saved report limits**

- One process, one JSON file, at most 200 reports, 800 kB per report.
- No authentication: saved reports are exactly as private as the server.
- Ids are random (`base64url`, 8 chars) but are not an authorization boundary.
- Deleting a saved report removes it from the file; there is no trash.

**Live check limits**

- Public hostname, DNS resolves only to public addresses, same-host redirects only.
- `robots.txt` checked first; a disallow or a 401/403 on robots.txt returns 403.
- HTML only, 2 MB cap, 15 s budget, no cookies, no credentials, no JavaScript, no retries.
- The live page is read once per click; no automatic refresh.

**Non-goals (v0.9)**

- A full company-wide crawl of every public page; the documentary is anchored to one public offer surface plus the site's archived footprint.
- Pixel-level visual diffs of arbitrary pages. The archived page view renders
  archived HTML; it does not compare pixels or claim a visual change.
- Monitoring, alerts, accounts, multi-user sync.
- Ad-library ingestion or spend estimates. Manual public-library links are allowed;
  server-side ad scraping or a licensed connector is not in this release.
- Cookie-authenticated reads of X, LinkedIn, Instagram or Reddit.
- A composite growth score that merges independent lanes.
- Hiring data, launch events.
- Using a live read as evidence of a dated change.

## Acceptance checks

| Check | Evidence |
|---|---|
| Extraction, diff, sampling | `tests/core.test.ts` (51 tests) |
| Handler routes, cache, limits, API index | `tests/api.test.ts` (16 tests) |
| Sitemap parse and read | `tests/site.test.ts` (6 tests) |
| Saved-report store | `tests/store.test.ts` (7 tests) |
| Live read guards | `tests/live.test.ts` (50 tests) |
| CSV/JSON export | `tests/export.test.ts` (5 tests) |
| Contract guards and comparison | `tests/contract.test.ts` (14 tests) |
| Compare, word/char diff, monthly range | `tests/compare.test.ts` (17 tests) |
| Marketing brief derivation | `tests/brief.test.ts` (10 tests) |
| Public growth documentary | `tests/documentary.test.ts` (8 tests) |
| Growth timeline merge and boundary | `tests/growth.test.ts` (7 tests) |
| Site graph crawler | `tests/sitegraph.test.ts` (7 tests) |
| Public feeds and jobs | `tests/signals.test.ts` (10 tests) |
| Price axis ladder | `tests/priceAxis.test.ts` (8 tests) |
| Change matrix | `tests/changeMatrix.test.ts` (2 tests) |
| HN link-match lane | `tests/mentions.test.ts` (3 tests) |
| Arquivo.pt index lane | `tests/arquivo.test.ts` (2 tests) |
| Source-lane router | `tests/sources.test.ts` (2 tests) |
| Archived URL guard | `tests/archiveUrl.test.ts` (2 tests) |
| Ad links | `tests/adlinks.test.ts` (3 tests) |
| Citation text | `tests/citation.test.ts` (2 tests) |
| Type-check + production build | `pnpm build` |
| Live report | 24 Nov 2026: `?url=basecamp.com/pricing` → 17 of 392 listed captures, 10 page changes, 24 months; `/api/growth` → 18 events from 3 source families; all rendered events linked |
| Design and accessibility | `docs/DESIGN.md`; axe-core WCAG 2.1 A/AA: 0 violations at desktop 1280 and mobile 390 |
| Saved report | 24 Nov 2026: save → list → reopen `#report/<id>` → delete, all through the HTTP API |
| Live check | 24 Nov 2026: `basecamp.com/pricing` → 200, `robots: allowed`, current title/headline/prices |
| Keyboard and labels | axe-core WCAG 2.1 A/AA: 0 violations on landing, saved report and saved list |

## Architecture

```
UI (React) ── GET  /api/growth?url=… ────┐
           ├─ GET  /api/timeline?url=… ──┤
           ├─ GET  /api/site?url=… ──────┤
           ├─ GET  /api/sitegraph?url=… ─┤
           ├─ GET  /api/signals?url=… ───┤
           ├─ GET  /api/sources?url=… ───┤
           ├─ GET  /api/live?url=… ──────┤
           └─ /api/reports (CRUD) ───────┤
                                        ├─ normaliseTarget (validation, no I/O)
                                        ├─ ArchiveClient (origin-locked, manual redirects)
                                        ├─ CDX rows → farthest-point sampling → snapshots
                                        ├─ extractCapture → title / h1 / prices
                                        ├─ diffCaptures → changes + coverage
                                        ├─ sitemap: archived copy → page count, months
                                        ├─ buildMentions: HN public index → link matches
                                        ├─ buildArquivoInfo: public index → coverage lane
                                        ├─ ReportStore: atomic JSON, serialised writes
                                        └─ fetchLive: DNS/IP guard → robots → capped read
```

`server/core.ts`, `server/site.ts`, `server/live.ts`, `server/mentions.ts`, `server/arquivo.ts` and `server/store.ts` are framework-free and injectable (`fetchImpl`, `lookupImpl`, `delayMs`, `timeoutMs`, file path), which is what makes the tests deterministic.

`shared/compare.ts` is client-safe pure logic: word and character LCS, capture comparison, monthly price parsing. `shared/changeMatrix.ts` is pure calendar aggregation; `shared/sources.ts` is the lane contract and guard. None of them can fetch, so a derived view can never invent a capture or a source row.

## Error taxonomy

| Status | Meaning | Copy |
|---|---|---|
| 400 | Invalid or non-public target | "That does not look like a public domain" |
| 403 | robots.txt disallows the live read | "robots.txt asks this tool not to read that page" |
| 404 | Page not archived, or no saved report | "No archived captures found for that page" |
| 413 | Body or stored report too large | "That report is too large to save" |
| 415 | Live URL is not HTML | "That URL is not an HTML page" |
| 429 | Client over quota | "Too many reports from this client. Wait a minute." |
| 502 | Archive or live page unreachable | "Could not reach the Internet Archive" |
| 504 | Archive or live page too slow | "The archive took too long to answer." |

A missing sitemap is not an error: `/api/site` returns 200 with `sitemapUrl: null` and a note.

## Roadmap gate

Visual diffs, hosted multi-user storage and additional sources ship only after the current report is used on a real pitch or teardown and the output is judged sufficient without edits. Ad-library data requires a licensed provider and a separate spec. The no-dead-ends connector and tenancy design is in [`PLATFORM-ARCHITECTURE.md`](PLATFORM-ARCHITECTURE.md): every provider has a public/import path or an authorized path, and no lane is a dead end.
