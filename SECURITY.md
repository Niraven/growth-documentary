# Security

## Design

- The server never fetches the page you type. Your input is used only to build a query against `web.archive.org` (CDX) and to construct a snapshot path. The only outbound host is `web.archive.org`.
- No credentials, cookies or tokens are stored or required.
- No user accounts, no database. Reports are cached in memory for 10 minutes and lost on restart.
- The API binds to `127.0.0.1` by default and is intended for private networks.
- Request bodies are not accepted; the API is `GET` only.
- Responses set `x-content-type-options: nosniff` and are JSON only.

## Input handling

- Targets must be `http`/`https` with a dotted hostname; `localhost`, credentials and fragments are rejected before any network call.
- Responses from the archive are parsed as text; no HTML is rendered from remote content. The UI renders extracted strings as React text nodes, never as HTML.

## Rate limiting

Eight reports per minute per client address, in memory. This is a courtesy limit, not a security boundary — put a real proxy quota in front if you expose the service.

## Reporting a vulnerability

Open a private security advisory on the repository, or email the maintainer listed in `package.json`. Do not open a public issue for an unfixed vulnerability. Include reproduction steps and the affected endpoint.

Please do not test against third-party sites; use a domain you control.
