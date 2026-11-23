# Product spec — Growth Documentary

Status: implemented (v0.3.0). This file is the contract; the README explains usage.

## Problem

Competitive research produces undated screenshots or unsourced claims. Both are unusable in a pitch, a deck or a sales call, where the first follow-up question is "says who?".

## Job to be done

When I need to show what a competitor changed on a public page, I want a dated list with a link to the archived page behind each line, so I can quote it without guessing.

## Users

| User | Trigger | Success |
|---|---|---|
| Agency owner | Pitching a prospect | Sends three dated competitor changes as proof of homework |
| Founder | Rival changed pricing | Knows what changed and when, without weekly manual checks |
| Sales team | Competitor raised prices | Builds a call list with a dated source |

## Contract

**Input:** one public page URL or domain.

**Output:** a timeline with:

1. one `first capture` baseline entry per report;
2. `title`, `headline` and `price` changes between consecutive readable captures;
3. for each entry: date label, field, before, after, archive URL;
4. `coverage`: first and last readable capture, month span, captures sampled, captures listed, sampling strategy;
5. `checkedAt` timestamp.

A second endpoint, `GET /api/site`, returns the sitemap layer: page count, dated entries, additions per month, the archived copy date, and a plain note when no sitemap exists.

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
- The only host contacted is `web.archive.org`; sitemaps are read from their archived copy.

**Non-goals (v0.3)**

- Visual diffs of arbitrary pages.
- Monitoring, alerts, accounts, saved reports.
- Ad-library data, hiring data, launch events.
- Any live crawl of the target site.

## Acceptance checks

| Check | Evidence |
|---|---|
| Extraction, diff, sampling | `tests/core.test.ts` (49 tests) |
| Handler validation, cache, rate limit | `tests/api.test.ts` (10 tests) |
| Sitemap parse and read | `tests/site.test.ts` (6 tests) |
| Contract guards | `tests/contract.test.ts` (6 tests) |
| Type-check + production build | `pnpm build` |
| Live report | 24 Nov 2026: `?url=basecamp.com/pricing` → 17 of 392 listed captures, 10 field changes, 24 months |
| Keyboard and labels | axe-core WCAG 2.1 A/AA scan: 0 violations, landing and live report |

## Architecture

```
UI (React) ── GET /api/timeline?url=… ──┐
           └─ GET /api/site?url=… ──────┤
                                        ├─ normaliseTarget (validation, no I/O)
                                        ├─ ArchiveClient (origin-locked, manual redirects)
                                        ├─ CDX rows → farthest-point sampling → snapshots
                                        ├─ extractCapture → title / h1 / prices
                                        ├─ diffCaptures → changes + coverage
                                        └─ sitemap: archived copy → page count, months
```

`server/core.ts` and `server/site.ts` are framework-free and injectable (`fetchImpl`, `delayMs`, `timeoutMs`), which is what makes the tests deterministic.

## Error taxonomy

| Status | Meaning | Copy |
|---|---|---|
| 400 | Invalid or non-public target | "That does not look like a public domain" |
| 404 | Page not archived | "No archived captures found for that page" |
| 429 | Client over quota | "Too many reports from this client. Wait a minute." |
| 502 | Archive unreachable | "Could not reach the Internet Archive" |
| 504 | Archive too slow | "The archive took too long to answer." |

A missing sitemap is not an error: `/api/site` returns 200 with `sitemapUrl: null` and a note.

## Roadmap gate

Saved reports, weekly email and visual diffs ship only after the current report is used on a real pitch or teardown and the output is judged sufficient without edits. Ad-library and hiring sources require a licensed provider and a separate spec.
