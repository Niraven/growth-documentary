# Growth Documentary

**A dated, sourced record of what changed on a public page.**

Paste a pricing page. Get a timeline of what changed on it, with the archived page behind every line. No estimates, no causal claims, no dashboard — just receipts you can quote.

```
basecamp.com/pricing → 12 captures → 5 visible changes → link to the page that proves each one
```

![Growth Documentary showing a dated timeline for a pricing page](docs/screenshot.png)

## Why

Competitive research usually produces one of two things: a screenshot with no date, or a confident story with no source. Growth Documentary produces the boring middle: **this string was on the page on this date, that string was there later, here is the archive link.**

It is useful when someone asks *"says who?"* — in a pitch, a board deck, a teardown or a sales call.

## Quickstart

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5173
```

Production build, with the same API mounted:

```bash
pnpm build
pnpm start        # http://127.0.0.1:5190
```

Requirements: Node 20+ and `pnpm`. No API keys, no database, no account.

## What it reads

For each capture it extracts three things:

| Field | Source |
|---|---|
| Page title | `<title>` |
| Headline | first `<h1>` |
| Prices | `$`-prefixed strings, filtered and deduped |

Then it compares consecutive captures and keeps only observed differences. A field that disappears is not reported as a change — an unreadable capture is a gap, not a deletion.

## What it does not do

- It does not tell you why a change happened, or whether it worked.
- It does not measure revenue, traffic or conversion.
- It does not know the exact day of a change — only that the page looked different by the next capture.
- It does not read pages behind a login or a paywall.
- It does not render a visual diff. Text fields only.

Those limits are deliberate. A tool that guesses is worse than a tool that says "I only know these three things".

## API

```http
GET /api/timeline?url=stripe.com/pricing
GET /api/health
```

`200` returns:

```json
{
  "domain": "stripe.com",
  "path": "/pricing",
  "captures": [
    { "ts": "20240104213453", "label": "4 Jan 2024", "title": "…", "h1": "…", "prices": ["2.9% + 30¢"], "url": "https://web.archive.org/web/…" }
  ],
  "changes": [
    { "ts": "20240104213453", "label": "4 Jan 2024", "field": "price", "before": "2.9% + 30¢", "after": "2.9% + 30¢ + …", "url": "https://web.archive.org/web/…" }
  ],
  "checkedAt": "2026-11-24T03:00:00.000Z"
}
```

Status codes: `400` invalid target, `404` nothing archived, `429` rate limited (8 reports/minute per client), `502` archive unreachable, `504` archive timeout. Successful reports are cached in memory for 10 minutes (`x-cache: hit|miss`).

## Architecture

```
src/                 React 19 UI (Vite, Tailwind 4, Radix, shadcn-style primitives)
  components/        report, live report, how-it-works, design sheet
server/
  core.ts            pure extraction + diff + fetch orchestration (no HTTP)
  api.ts             request handler: validation, rate limit, cache
  plugin.ts          mounts the same handler on dev and preview servers
tests/               unit tests for extraction, diff, validation and the handler
```

The API is a Vite plugin with `configureServer` **and** `configurePreviewServer`, so `pnpm dev` and `pnpm start` run identical server code. `server/core.ts` has no framework imports and is tested directly.

Data source: [Internet Archive Wayback Machine](https://web.archive.org/) CDX + snapshot endpoints. Nothing is scraped from the target site directly — the only host contacted is `web.archive.org`.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server with HMR and the API |
| `pnpm build` | Type-check and build to `dist/` |
| `pnpm start` | Serve the production build with the API |
| `pnpm test` | 27 unit tests (vitest) |
| `pnpm lint` | oxlint |
| `pnpm check` | lint + test + build |

## Self-hosting

The app is a static build plus one Node process. It binds to `127.0.0.1` by default. Put it behind Tailscale, a reverse proxy or a private network — there is no auth layer, because it is designed to run on a private host. If you expose it publicly, add authentication and a per-IP quota in front of it.

Outbound access to `web.archive.org` is required. No other egress.

## Roadmap

- Saved reports and a weekly diff email
- Optional licensed ad-library connector (Meta/Google) behind a provider key
- Visual diff of archived screenshots for a requested page
- CSV / JSON export of a timeline

Not started, not claimed. The current build is the one described above.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). The product spec lives in [docs/SPEC.md](docs/SPEC.md) — changes that widen scope should update it first.

## License

MIT. See [LICENSE](LICENSE).
