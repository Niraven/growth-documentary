# Product spec — Growth Documentary

Status: implemented (v0.5.0). This file is the contract; the README explains usage.

## Problem

Competitive research produces undated screenshots or unsourced claims. Both are unusable in a pitch, a deck or a sales call, where the first follow-up question is "says who?".

## Job to be done

When I need to show what a competitor changed on a public page, I want a dated list with a link to the archived page behind each line, so I can quote it without guessing — and a way to keep and hand off the exact report I used.

## Users

| User | Trigger | Success |
|---|---|---|
| Agency owner | Pitching a prospect | Sends three dated competitor changes as proof of homework |
| Founder | Rival changed pricing | Knows what changed and when, without weekly manual checks |
| Sales team | Competitor raised prices | Builds a call list with a dated source |
| Analyst | Repeating a teardown next quarter | Reopens the frozen report and compares it with a fresh one |

## Contract

**Input:** one public page URL or domain.

**Timeline output:**

1. one `first capture` baseline entry per report;
2. `title`, `headline` and `price` changes between consecutive readable captures;
3. for each entry: date label, field, before, after, archive URL;
4. `coverage`: first and last readable capture, month span, captures sampled, captures listed, sampling strategy;
5. `checkedAt` timestamp.

**Saved report output:** `{ id, savedAt, report }`. The API computes the report server-side from the URL and freezes that result; a client-supplied report object is ignored. The stored report is never recomputed on read. A save of the same `domain + path + checkedAt` is idempotent and returns the existing id.

**Derived views (client-side, no new claims):**

- **Compare:** any two readable captures from the same report. Page title uses a character-level LCS; headline uses a word-level LCS; a replacement with less than 35% shared words is shown as two whole states, not an interleaved sentence. Price deltas are labelled Removed/Added.
- **Monthly price range:** one bar per month in which monthly (`/mo`, `/month`) price strings were read. Each bar is the min–max of those strings; annual, one-time and per-seat amounts are excluded. With fewer than two such months the chart is not rendered.
- **Citation:** coverage window, captures read, field changes (baseline excluded), access date, source link.

**Live check output:** `{ domain, path, fetchedAt, finalUrl, title, h1, prices, robots: "allowed" }`. It is not a `Capture`, has no archive timestamp, and never enters the timeline.

**Site output:** page count, dated entries, additions per month, archived copy date, and a plain note when no sitemap exists.

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
- The live check is opt-in, per-request, and runs only after robots.txt allows it.
- Saved reports are local, bounded, and written atomically; they are never recomputed on read.
- A comparison view may only use captures already present in the report; it may not fetch or infer a missing capture.
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

**Non-goals (v0.4)**

- Visual diffs of arbitrary pages.
- Monitoring, alerts, accounts, multi-user sync.
- Ad-library data, hiring data, launch events.
- Using a live read as evidence of a dated change.

## Acceptance checks

| Check | Evidence |
|---|---|
| Extraction, diff, sampling | `tests/core.test.ts` (50 tests) |
| Handler routes, cache, limits, API index | `tests/api.test.ts` (15 tests) |
| Sitemap parse and read | `tests/site.test.ts` (6 tests) |
| Saved-report store | `tests/store.test.ts` (7 tests) |
| Live read guards | `tests/live.test.ts` (50 tests) |
| CSV/JSON export | `tests/export.test.ts` (5 tests) |
| Contract guards and comparison | `tests/contract.test.ts` (14 tests) |
| Compare, word/char diff, monthly range | `tests/compare.test.ts` (14 tests) |
| Citation text | `tests/citation.test.ts` (2 tests) |
| Type-check + production build | `pnpm build` |
| Live report | 24 Nov 2026: `?url=basecamp.com/pricing` → 17 of 392 listed captures, 10 field changes, 24 months |
| Saved report | 24 Nov 2026: save → list → reopen `#report/<id>` → delete, all through the HTTP API |
| Live check | 24 Nov 2026: `basecamp.com/pricing` → 200, `robots: allowed`, current title/headline/prices |
| Keyboard and labels | axe-core WCAG 2.1 A/AA: 0 violations on landing, saved report and saved list |

## Architecture

```
UI (React) ── GET  /api/timeline?url=… ──┐
           ├─ GET  /api/site?url=… ──────┤
           ├─ GET  /api/live?url=… ──────┤
           └─ /api/reports (CRUD) ───────┤
                                        ├─ normaliseTarget (validation, no I/O)
                                        ├─ ArchiveClient (origin-locked, manual redirects)
                                        ├─ CDX rows → farthest-point sampling → snapshots
                                        ├─ extractCapture → title / h1 / prices
                                        ├─ diffCaptures → changes + coverage
                                        ├─ sitemap: archived copy → page count, months
                                        ├─ ReportStore: atomic JSON, serialised writes
                                        └─ fetchLive: DNS/IP guard → robots → capped read
```

`server/core.ts`, `server/site.ts`, `server/live.ts` and `server/store.ts` are framework-free and injectable (`fetchImpl`, `lookupImpl`, `delayMs`, `timeoutMs`, file path), which is what makes the tests deterministic.

`shared/compare.ts` is client-safe pure logic: word and character LCS, capture comparison, monthly price parsing. `src/lib/citation.ts` is pure text. Neither module can fetch, so a derived view can never invent a capture.

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

Visual diffs, hosted multi-user storage and additional sources ship only after the current report is used on a real pitch or teardown and the output is judged sufficient without edits. Ad-library data requires a licensed provider and a separate spec.
