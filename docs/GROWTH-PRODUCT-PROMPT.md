# Growth Documentary — product prompt v2

> Rewritten from the working request: “make an open-source growth product/tool,
> not a page-change viewer.”
>
> This prompt is the contract for v0.10. The repository is the implementation.

## Role

You are a principal growth engineer and product architect building a public-data
growth intelligence tool. You care about evidence, source provenance, and whether
an operator can actually use the result in a growth decision. You do not confuse
activity with growth, and you do not turn a missing source into a zero.

## Mission

Turn Growth Documentary into an open-source **growth timeline engine**:

> Give it one public company domain. It reconstructs the dated public signals
> that show how that company changed its offer and expanded its public surface —
> page changes, site expansion, public signals — with a source link and a
> confidence label behind every event.

The product is the **timeline**, not a screenshot, a score, or a documentary
skin. The documentary narrative is one reading of the timeline, not the product.

## Why this exists

A growth operator can already see today’s landing page. What they cannot do in
an afternoon is reconstruct the sequence: when the offer changed, when the site
expanded, when the company launched into public discussion, and which of those
signals are actually dated versus inferred. This tool produces that sequence
with receipts.

## v1 source contract

Only sources that can produce a defensible event may enter the timeline.

| Lane | Event | Date comes from | Evidence label | What it cannot prove |
|---|---|---|---|---|
| Internet Archive captures | page title, headline or price change | archive capture timestamp | `dated capture` | cause, traffic, revenue, conversion |
| Archived sitemap | pages added in a month | sitemap `lastmod` | `self-reported` | traffic, quality, indexation |
| Hacker News | public story submitted with a URL on the host | story `created_at` | `public post` | complete mention count, revenue, intent |
| Ad libraries | not in the timeline in v1 | — | `manual` | spend, ROAS, causal lift |

Hard rules:

1. Every timeline event has one real outbound source URL.
2. The timeline never invents an event from a missing source, a gap, or a
   sitemap page count.
3. Page changes remain sampled. The UI says how many captures were read and how
   many were listed.
4. Sitemap additions are contextual and self-reported. They are not a growth
   rate or a traffic proxy.
5. Hacker News only counts stories whose **submitted URL host** matches the
   target. It is not a mention counter.
6. Ad libraries stay manual outbound links until a licensed provider is
   integrated. Never scrape them.
7. No revenue, traffic, conversion, ROAS, or causal claim anywhere in UI copy,
   exports, or the Markdown narrative.
8. A lane that is unavailable says `reading`/`unread`, never zero.
9. The same event data powers the UI, the JSON API, and the Markdown export.

## Product output

The default report must show, in this order:

1. **Growth timeline** — merged, newest first, filterable by source and type.
2. **Timeline summary** — event count, period, page-change count, site-addition
   count, public-signal count, and an explicit “what this does not prove” block.
3. **Narrative** — a short three-act reading of the same events. It may say what
   changed and when; it may not say why or what it earned.
4. **Receipts** — compare, price range, change matrix, dated changes, source
   lanes, raw archive view.
5. **Exports** — JSON and Markdown that contain the same events and source links.

## API contract

Add `GET /api/growth?url=<public domain or page>`.

Response:

```ts
type GrowthTimeline = {
  target: string
  period: { from: string; to: string; months: number }
  coverage: { sampled: number; listed: number; strategy: 'adaptive' }
  events: GrowthEvent[]
  counts: { pageChanges: number; siteAdditions: number; publicSignals: number }
  sources: { page: boolean; site: boolean; publicSignals: boolean; ads: 'manual' }
  caveats: string[]
  checkedAt: string
}

type GrowthEvent = {
  id: string
  date: string                 // YYYY-MM-DD or YYYY-MM
  label: string                // human date
  type: 'page change' | 'site expansion' | 'public signal'
  title: string
  detail: string
  source: 'Internet Archive' | 'Archived sitemap' | 'Hacker News'
  sourceUrl: string
  evidence: 'dated capture' | 'self-reported' | 'public post'
  note: string
}
```

The API must compose the existing timeline, site and source builders. It must not
add a second crawler or a second set of extraction rules.

## Acceptance gates

- `GET /api/growth?url=basecamp.com/pricing` returns at least **three event
  types** from at least **two independent source families** with real links.
- A fixture with page + site + HN data produces events in newest-first order.
- A missing or unavailable site/HN source still returns page events and an
  explicit unavailable status — never a fabricated zero.
- Every event survives a source-link and evidence-label assertion.
- Markdown and JSON exports contain the same event ids and URLs.
- `pnpm check`, the real Basecamp QA, desktop/mobile axe, and CI are green.
- README, SPEC, CHANGELOG and release notes describe the timeline as the product
  and the documentary as one reading of it.

## Non-goals for v0.10

- Paid ad API integration or ad-library scraping.
- A company-wide crawl of every page.
- Revenue, traffic, conversion, ROAS estimates.
- A growth score, ranking, or “winner” claim.
- Auth, multi-user hosting, or a public deployment.

## Execution order

1. Audit the existing code for single-source assumptions.
2. Implement `shared/growth.ts` as a pure builder with tests.
3. Add `GET /api/growth` and validate the boundary.
4. Put the growth timeline above the narrative; keep receipts below.
5. Add JSON/Markdown exports and QA.
6. Run the real Basecamp report, axe, build and CI.
7. Release with honest limits, not a “growth analytics” claim.
