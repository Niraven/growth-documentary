# Security

## Trust boundaries

- **The dated timeline** reads only `web.archive.org`. Your input becomes a CDX query and a snapshot path; the target site is never contacted for a timeline.
- **The live check** is the one path that contacts a third-party host, only when the user clicks. It is opt-in and never contributes a dated row.
- **Saved reports** are written to one JSON file on the server's disk. There is no account system, so the saved store is exactly as private as the server itself.

## Input handling

- Targets must be `http`/`https` with a dotted hostname; `localhost`, IP literals, credentials, local suffixes and fragments are rejected before any network call.
- Archive responses are parsed as text. No remote HTML is rendered; extracted strings are React text nodes, never `dangerouslySetInnerHTML`.
- JSON request bodies are capped at 16 kB and must contain a string `url`.
- Saved-report ids are validated against `^[A-Za-z0-9_-]{6,24}$` before any lookup.

## Live check (SSRF posture)

- Hostnames are resolved with `dns.lookup(..., { all: true })`; **every** address must be public. Loopback, private, link-local, CGNAT, documentation, multicast, IPv4-mapped, IPv4-compatible, NAT64, 6to4 and site-local ranges are rejected for IPv4 and IPv6.
- Redirects are followed by hand, at most three hops, and must stay on the same hostname and port. The redirect target's path is checked against `robots.txt` **before** it is fetched.
- `robots.txt` is fetched first, from the same host, under the same rules, and cached as rules per origin — never as a per-origin verdict. It is evaluated per path **including the query string**, supports `*` and `$`, and a disallow returns 403 before the page is requested. A `robots.txt` that cannot be read (5xx, network failure, off-host redirect) fails closed.
- HTML content type only; 2 MB byte cap; 15 s total budget **including DNS**; no cookies, no credentials, no JavaScript execution, no retries.
- Known residual: DNS is resolved immediately before the request, but Node's `fetch` resolves again. A hostile DNS server could rebind between the two answers. The window is small, the response is parsed as text only, and this is a self-hosted tool, but it is not a full DNS-pinning implementation. Upgrade path: connect to the validated IP with a custom agent and a Host header.

## Saved report storage

- One file, default `data/reports.json` (`GD_DATA_DIR` / `GD_REPORTS_FILE` override), mode `0600`, atomic write via temp file + rename, serialised mutations.
- Bounded: 200 reports, 800 kB per report. Old entries are pruned by count.
- Saved ids are random, not guessable, but **not an authorization boundary**. Anyone who can reach the API can list, read and delete saved reports. Do not host this on a public network without authentication in front.
- A saved report is frozen at save time and never recomputed on read.

## Transport and responses

- API binds to `127.0.0.1` by default and is intended for a private network.
- JSON only, `x-content-type-options: nosniff` on API responses.
- Rate limits per client per minute: 8 timelines, 20 sitemap reads, 4 live checks, 6 saves. In-memory, per socket address; a courtesy limit, not a security boundary.
- Archive redirects are followed by hand, at most three hops, and an off-site hop is refused before it is fetched.
- No credentials, cookies or tokens are stored or required.

## Export

CSV export runs in the browser. A cell that begins with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe so spreadsheet software treats it as text. JSON export is the report object plus an export timestamp.

## Reporting a vulnerability

Open a private security advisory on the repository, or email the maintainer listed in `package.json`. Do not open a public issue for an unfixed vulnerability. Include reproduction steps and the affected endpoint.

Please do not test the live check against third-party sites; use a domain you control.
