# Product spec — Growth Documentary

Status: implemented (v0.2.0). This file is the contract; the README explains usage.

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

**Output:** a timeline of up to 12 captures containing:

1. one `first capture` entry per report;
2. `title`, `headline` and `price` changes between consecutive captures;
3. for each entry: date label, field, before, after, archive URL;
4. `checkedAt` timestamp.

**Hard requirements**

- Every displayed change links to a real capture URL.
- No revenue, traffic, conversion or causal claims anywhere in UI copy.
- Unreadable captures are skipped, never reported as deletions.
- Invalid targets fail with a 4xx and a human sentence, before any network call.
- Dev and production serve the same handler.

**Non-goals (v0.2)**

- Visual diffs of arbitrary pages.
- Monitoring, alerts, accounts, saved reports.
- Ad-library data.
- Any host other than `web.archive.org`.

## Acceptance checks

| Check | Evidence |
|---|---|
| Pure extraction and diff | `tests/core.test.ts` (33 tests) |
| Handler validation, cache, rate limit | `tests/api.test.ts` (8 tests) |
| Type-check + production build | `pnpm build` |
| Live report for a real page | example run 24 Nov 2026: `?url=basecamp.com/pricing` → 12 captures, 5 visible changes |
| Keyboard and labels | axe-core WCAG 2.1 A/AA scan of the production build: 0 violations, fixture and live report |

## Architecture

```
UI (React) → GET /api/timeline?url=…
                │
                ├─ normaliseTarget (validation, no I/O)
                ├─ CDX query → capture list
                ├─ snapshot fetch (text only) × up to 12
                ├─ extractCapture → title / h1 / prices
                └─ diffCaptures → changes
```

`server/core.ts` is framework-free and injectable (`fetchImpl`, `delayMs`, `timeoutMs`), which is what makes the tests deterministic.

## Error taxonomy

| Status | Meaning | Copy |
|---|---|---|
| 400 | Invalid or non-public target | "That does not look like a public domain" |
| 404 | Page not archived | "No archived captures found for that page" |
| 429 | Client over quota | "Too many reports from this client. Wait a minute." |
| 502 | Archive unreachable | "Could not reach the Internet Archive" |
| 504 | Archive too slow | "The archive took too long to answer." |

## Roadmap gate

Saved reports, weekly email and visual diffs ship only after the current report is used on a real pitch or teardown and the output is judged sufficient without edits.
