# Evidence lanes — what we borrowed from REM and Agent Reach

Growth Documentary is not a marketing score. It is a record of what a public page
said, when, with a link. The evidence-lane view borrows two ideas from open-source
research agents without borrowing their scraping surface.

## From REM (Reverse Engineer Marketing)

REM starts from one link and lays out the marketing machine: paid ads, organic
social, search, founders, funnel and positioning history, with every claim tied to
evidence and an explicit unknown list. That shape is useful. The report is stronger
when each channel stands on its own and a missing channel is named as missing.

What we borrowed:

- **One entry point, several lanes.** The page is the entry point; the archive,
  second archive, public discussion, sitemap and ad links are separate lanes.
- **Evidence or unknown, never a confident blank.** A lane that was not read says
  `unread`; a lane that returned no rows says `no rows`. Neither is zero.
- **Cited public stories.** HN rows link to the discussion item; Arquivo rows link
  to the replay; ad rows open the public library. There is no unsourced score.
- **A visible limits section.** "What this does not prove" sits beside the report.

What we did **not** borrow:

- No login cookies, private feeds, paywall bypass or copycat content.
- No commercial ad ingestion, spend estimate or ad-library scraping.
- No founder/social graph built from scraped profiles.
- No composite "growth score" that hides which lane produced the number.

REM's clean-room and evidence discipline is the inspiration; its collection surface
is intentionally not part of this tool.

## From Agent Reach

Agent Reach is a capability layer: one command routes to the most reliable free
backend for a platform, with fallbacks and a doctor command. The lesson for a public
report is not "install every platform"; it is **make each adapter's state honest**.

What we borrowed:

- **Separate providers, separate failure states.** Wayback, Arquivo.pt, HN and the
  sitemap each have their own request, timeout and status. A blocked provider cannot
  turn the other lanes into a failed report.
- **No hidden retries or silent substitutions.** If HN is rate-limited, the lane is
  `unread`; the timeline is untouched.
- **A coverage count, not a promise.** Arquivo shows the unique rows inspected and the provider's estimate in the note; HN shows the cap and marks a lower bound.
- **Public, keyless paths first.** Both new lanes use public endpoints; no account
  or cookie is required to read them.

What we deliberately do not do:

- No cookie-based reads of X, LinkedIn, Instagram or Reddit. Those are user-session
  surfaces, not public evidence lanes, and they are outside this product's scope.
- No proxy or headless browser farm to defeat a bot wall.
- No claim that a public API sees the whole internet. It sees its own index.

## Lane contract

| Lane | Provider | Evidence | Feeds dated changes? | Failure shown as |
|---|---|---|---|---|
| Internet Archive | Wayback CDX + snapshots | capture timestamp, title, first H1, price strings, capture URL | yes | `unread` or a visible gap |
| Arquivo.pt | public text-search index | provider estimate, newest unique captures, replay links | no — coverage only | `unread` |
| Hacker News | public Algolia API | stories whose submitted URL host matches the target, points, comments | no | `unread` |
| Sitemap | site's archived sitemap | page count and self-reported `lastmod` months | no | `no sitemap` note |
| Ad libraries | public libraries, opened by the reader | none collected by this server | no (manual) | `manual` badge |
| Live check | target page, after robots.txt | current title/H1/prices | never | `blocked` or `not checked` |

The only lane that can create a dated change is the Internet Archive lane. A second
archive listing is not a second dated diff. If a future adapter wants to feed the
timeline, it must carry its own capture timestamp and provenance through extraction,
comparison, saved reports and citations — and pass the same "unread is not empty"
tests.

## Charts

- **Monthly price range:** one bar per calendar month, min–max of extracted monthly
  amounts, one x slot per month, triangles for observed price-change rows. No
  interpolation, no imputed months.
- **Change matrix:** one cell per field per calendar month; the baseline is excluded.
  Darker means more observations in that month, not a larger price or a growth rate.
- **Site size:** sitemap page count and dated additions; `lastmod` is self-reported.
- **Mentions:** monthly count of matched public HN stories over the last 24 months;
  bars sum to the matched total. A month with no bar is a month with no matched story,
  not proof that no one discussed the company.
- **Price axis:** 1/2/5 × 10^n ticks, so a page in the thousands stays readable.

## Adding a source

A new public lane must answer all of these before it ships:

1. What exactly does it return, and what is the provider's coverage/limit?
2. Is it public, keyless and permitted by the provider's terms?
3. Does it have a stable item URL for every claim?
4. What is its failure state, and can it fail without breaking the report?
5. Does it feed a chart without inventing zeroes or interpolating gaps?
6. If it feeds the dated timeline, where is its capture timestamp and provenance?
7. Is there a test for the empty case, the blocked case and the off-host case?

If any answer is missing, it belongs in a future spec, not in a confident-looking
lane.
