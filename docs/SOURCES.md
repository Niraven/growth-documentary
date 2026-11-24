# Sources and provenance

Growth Documentary is only as good as its labels. Every fact in the UI carries
where it came from and what kind of evidence it is.

## Source matrix

| Source | API | Carries a date? | Used for | Status |
|---|---|---|---|---|
| Wayback CDX + snapshots | `web.archive.org/cdx/search/cdx`, `web.archive.org/web/<ts>id_/<url>` | Yes — capture timestamp | Dated title, headline and price changes | Shipped |
| Wayback sitemap snapshot | CDX for `sitemap*.xml`, archived copy | Yes — capture timestamp + self-reported `lastmod` | Page count and additions per month | Shipped |
| Arquivo.pt index | `arquivo.pt/textsearch?versionHistory=` | Yes — capture timestamp | Second archive coverage lane; newest replay links | Shipped as an independent lane, not merged into the diff |
| Hacker News | `hn.algolia.com/api/v1/search_by_date` | Yes — story timestamp | Public stories whose submitted URL host matches the target | Shipped as an independent lane |
| Live page read | Target host, on demand | No — read time only | Current title, headline, prices; comparison against the latest capture | Shipped, opt-in |
| Common Crawl index | `index.commoncrawl.org` | Yes — crawl ID/date | A second dated sample for pages Wayback lacks | Planned; WARC range read and licence check required |
| urlscan.io | Search API + result DOM | Yes — scan date | Extra dated samples and a rendered-page artifact | Planned; API key and quota required |
| Ad libraries (Meta/Google) | Licensed provider API | Yes — ad delivery dates | Ad creative history | Planned; licensed provider only, never a scrape |
| Company changelog / RSS | Site feed | Yes — published date | Launch notes and release history | Planned; feed discovery per site |

## Inclusion rule

> A source may enter the dated timeline only if it can name the date on which the
> page looked that way.

A live fetch cannot satisfy that rule. It can be shown beside the timeline, clearly
labelled as a current read, but it cannot become a row and it cannot be compared as
if the gap between the archive and now were measured.

A source also needs a provenance label in the API and the UI. Two dated sources
with different crawl dates must not be silently merged into one "before" and
"after"; the report would show which source supplied each capture.

## Why this is not a crawler

A crawler produces current pages. The product's job is dated pages, so the core
is an archive reader. Scraping is used only where the current state is the
question, and then under explicit constraints:

- public hostname, DNS resolves only to public addresses
- same-host redirects only
- `robots.txt` first, evaluated per path
- HTML only, 2 MB cap, 15 s budget
- no cookies, credentials or JavaScript

Those constraints live in `server/live.ts` and are exercised in `tests/live.test.ts`.

## Ad libraries

Ad-library pages are not timeline sources. The UI links to the public Meta,
Google, TikTok and LinkedIn libraries as manual, external checks; the server never
fetches them. There is no free official API for general US commercial ads, so an
automatic ad history would require a licensed provider with its own provenance and
retention rules. Details: [`AD-SOURCES.md`](AD-SOURCES.md).

## Adding a source

1. Write the adapter behind a narrow interface that returns captures with an
   explicit source id and date (or returns a current-state object, never a
   capture).
2. Add the provenance field to `shared/timeline.ts` and the UI label.
3. Add fixtures for a missing date, a malformed payload, and an off-host redirect.
4. Document the licence, quota and rate limit in this file before shipping.
5. Do not let a new source's absence break the archive report. A source failure is
   a labelled gap, never a deletion.
