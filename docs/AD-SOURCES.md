# Ad sources — what is free, what is not, and what this tool will not do

The report links to four **public ad libraries**. It does not read them on the
server, does not bypass a login, and does not turn their pages into timeline rows.
The links are a manual research shortcut, not evidence collected by this tool.

## The free options

| Library | What it covers | How this app uses it | Free API? |
|---|---|---|---|
| [Meta Ad Library](https://www.facebook.com/ads/library/) | Facebook and Instagram ads; the report's link opens the **active** ads view | Opens an active-ads keyword search for the domain in a new tab | No general commercial API. Meta's [Ad Library API](https://developers.facebook.com/docs/graph-api/reference/ads_archive/) is free but covers political/issue ads and EU-delivered ads, not all US commercial ads. |
| [Google Ads Transparency Center](https://adstransparency.google.com/) | Search, display and YouTube advertisers, by advertiser or domain | Opens a domain search in a new tab | No official commercial API. Google publishes a political advertising dataset in BigQuery, not a general commercial ad API. |
| [TikTok Commercial Content Library](https://library.tiktok.com/ads) | Commercial ads shown in the EU, under the DSA transparency rules | Opens an EU library search in a new tab | Public library; no general US commercial API. |
| [LinkedIn Ad Library](https://www.linkedin.com/ad-library/) | Sponsored LinkedIn posts | Opens a keyword search in a new tab | Public search; coverage varies and there is no general commercial API. |

Coverage, regions and query behaviour differ by library. A search can return
nothing, or return a different advertiser with a similar name. The library page is
the source; this project only gives you the door.

## Why not scrape them

Meta, Google, TikTok and LinkedIn ad libraries are interactive products with
their own terms, rate limits and access controls. Scraping them would:

- violate the terms that make the public library available;
- break silently whenever the page markup or anti-bot behaviour changes;
- produce an unattributed ad screenshot with no stable, verifiable URL;
- turn an honest "check this yourself" feature into an unmaintainable crawler.

The same applies to login-gated libraries. This project does not bypass a login,
paywall or access control.

## If automatic ad history is required

Use a licensed provider that has the right to redistribute the data, and plug it
in behind a server-side adapter with:

1. a provider key held server-side;
2. a provenance label on every ad record (provider, retrieval time, ad ID, region);
3. a clear separation from the dated page timeline: ads are ad evidence, not a
   page change;
4. retention rules that match the provider's licence.

A licensed adapter is **not** included in v0.8.0. The free manual links are.

## What this means for a report

The ad panel is deliberately outside the timeline. It cannot create a dated row,
cannot prove that an ad ran, and cannot prove spend. It is a link to the public
library so a human can check.
