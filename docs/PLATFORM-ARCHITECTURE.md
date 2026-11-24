# No dead ends — connector and tenancy architecture

Status: proposed architecture, v0.12–v1.0. It builds on the v0.11.0 public
record. It does not claim that any connector below is already live.

## The honest claim

External credentials and data licences cannot be removed by architecture. A
competitor's ad archive, your Stripe account and a press database belong to
someone else. Pretending otherwise would produce another fake dashboard.

What **can** be removed is the dead end. Every capability in this design has:

1. **a no-credential path** that a self-hosting operator can use today, and
2. **an authorized path** that a team can enable with its own key, OAuth grant
   or licence.

If neither path is available, the capability does not ship. It does not become a
zero, a fake row or a promise.

This is the product rule:

> No source is a dead end. Every source is public, imported, or authorized —
> and every state is labelled.

## 1. Product surfaces

```
PUBLIC REPORT                         PRIVATE WORKSPACE
no account, no cookies,               OIDC session, workspace role
short-lived public cache              private data, connections, exports
       │                                      │
       └────────────── API ───────────────────┘
                         │
                 one report composer
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
  Public evidence   Authorized data   Local imports
  (archive, feeds,  (OAuth / keys /   (CSV / JSON from
   jobs, press)      licensed API)     provider exports)
```

The public report is the acquisition surface. The private workspace is the paid
or team surface. They share the report composer and evidence vocabulary, but not
the same trust boundary.

### Deployment profiles

| Profile | Auth | Store | Use |
|---|---|---|---|
| `solo` | none | JSON file, one process | laptop, tailnet, single operator |
| `team` | OIDC | Postgres + object store | agency or company workspace |
| `managed` | OIDC | Postgres with RLS | hosted multi-tenant product |

`AUTH_MODE=solo|team|managed` defaults to `solo`. `team` and `managed` refuse to start without
an OIDC issuer and a session secret. A public unauthenticated deployment is
never a supported profile.

## 2. The capability matrix

Each lane has two paths or it does not ship.

| Capability | No-credential path | Authorized path | Data class | Never says |
|---|---|---|---|---|
| Competitor ad creative | outbound public-library search; optional licensed snapshot | licensed ad-intelligence provider | licensed / external | “spend”, “ROAS” without an account |
| Own ad performance | provider export CSV (`date,platform,spend,...`) | Meta / Google / LinkedIn / TikTok official API for owned accounts | first-party | that an owned ad is a competitor ad |
| Press and news | public RSS/Atom; company newsroom links | paid press database adapter | public / licensed | “all coverage” or “sentiment score” |
| Product Hunt | public launch page link; public feed if available | Product Hunt API v2 token | public / authorized | “launch caused growth” |
| Web/product analytics | GA4 export CSV | GA4 Data API OAuth, `analytics.readonly` | first-party | traffic causality |
| Revenue | Stripe/billing export CSV | Stripe restricted key or OAuth, read-only | first-party | MRR from page changes |
| CRM pipeline | HubSpot/Salesforce report CSV | OAuth, read-only scopes | first-party | that a deal was caused by a page edit |
| Hosted saved reports | `solo` local file | OIDC + Postgres + workspace membership | private | that a saved id is authorization |

### Why the ad distinction matters

Most official ad APIs expose **your own ad account**, not a competitor's creative
history:

- Meta Marketing API: app review, ad-account permission, `ads_read`. It is not
  the public Ad Library and it is not a general competitor-ad API.
- Google Ads API: developer token, OAuth, customer id, `adwords.readonly`.
- LinkedIn Marketing API and TikTok Business API: owned-account access.

Competitor creative history requires a provider with redistribution rights.
The architecture therefore has two separate connector families:

- `ads-owned`: official API or export, first-party spend/performance.
- `ads-licensed`: a licensed competitor-ad provider, external evidence.

They never share a table without a `data_class` discriminator.

## 3. Connector contract

The contract is server-only for anything that holds a secret. The browser sees
status and non-secret metadata.

```ts
export type CredentialKind = 'none' | 'api-key' | 'oauth' | 'license'

export type ConnectorState =
  | 'unconfigured'
  | 'manual'
  | 'connected'
  | 'syncing'
  | 'ready'
  | 'degraded'
  | 'revoked'

export type DataClass =
  | 'public-dated'
  | 'public-current'
  | 'first-party'
  | 'licensed'
  | 'manual'

export interface ConnectorManifest {
  id: string
  lane: 'ads-owned' | 'ads-licensed' | 'press' | 'product-hunt'
    | 'analytics' | 'billing' | 'crm'
  label: string
  credential: CredentialKind
  /** The path that works with no provider login. */
  fallback: 'export-import' | 'public-feed' | 'public-link'
  scopes: string[]
  dataClass: DataClass
  history: 'dated' | 'snapshot'
  /** Fields this connector is forbidden to emit. */
  neverClaims: string[]
}

export interface ConnectorContext {
  workspaceId: string
  connectionId: string
  /** Resolved server-side. Never returned to the client. */
  secret: string
  signal: AbortSignal
  cursor: string | null
}

export interface Connector {
  manifest: ConnectorManifest
  authorize?(): Promise<{ url: string; state: string }>
  exchange?(code: string, state: string): Promise<{ secret: string; accountId: string }>
  sync(context: ConnectorContext): AsyncIterable<RawRecord>
  normalize(record: RawRecord): NormalizedRecord[]
  revoke?(context: ConnectorContext): Promise<void>
}
```

Rules:

- `sync` never receives a browser-supplied workspace id; the session supplies it.
- `exchange` never logs the code or token.
- `normalize` emits a `provenance` object and `dataClass` on every row.
- `authorize` uses PKCE + state; the callback verifies state and binds it to the
  session and workspace.
- A connector may be `snapshot` only; it may not synthesize history.
- A failed sync leaves the previous successful data and marks `degraded`; it
  never replaces it with zero.

## 4. Data model

Use Postgres in `team`/`managed`; keep the JSON store in `solo`.

```sql
workspaces(id, name, created_at)
memberships(workspace_id, user_id, role, created_at)
users(id, issuer, subject, email, display_name, created_at)

connections(
  id, workspace_id, provider, lane, access_mode, state,
  external_account_id, scopes, secret_id,
  last_success_at, last_error_code, created_at, revoked_at
)

secrets(
  id, workspace_id, ciphertext, nonce, key_version, created_at
)

sync_runs(
  id, workspace_id, connection_id, started_at, finished_at,
  state, cursor, rows_read, error_code
)

metric_points(
  id, workspace_id, connection_id, data_class,
  metric_date, metric, value, unit, currency,
  dimensions_hash, provenance, created_at
)

reports(
  id, workspace_id, target, checked_at, payload,
  visibility, created_at
)

audit_events(
  id, workspace_id, actor_id, action, object_type, object_id,
  payload_digest, at
)
```

Invariants:

- Every private row carries `workspace_id`.
- Unique key: `(workspace_id, connection_id, metric_date, metric, dimensions_hash)`.
- `reports.visibility` is `private` by default.
- Public saved reports may be read without auth only when `visibility='public'`
  and the payload contains public evidence only.
- First-party and licensed rows never enter the public report composer unless
  the report owner explicitly enables an **outcome overlay**.
- Deleting a workspace cascades connections, secrets, sync runs, metric points,
  private reports and audit references; the provider is revoked first.

### Tenant isolation

Use both:

1. a session-bound `workspace_id` in every repository call, and
2. Postgres row-level security:

```sql
alter table reports enable row level security;

create policy reports_workspace_read on reports
  for select using (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
  );
```

The service role is server-only and never used in a user request path. A test
must create two workspaces and prove that a report id from A returns 404 for B,
even when the id is known.

## 5. Auth and session boundary

Supported hosted identity:

- OIDC (Authentik, Keycloak, Supabase Auth, or another standards-compliant
  issuer) — authorization code + PKCE;
- `issuer`, `client_id`, `client_secret` server-side only;
- exact redirect URI registered per environment;
- `state` bound to a short-lived signed cookie and the return path;
- session cookie `__Host-gd_session`: `Secure`, `HttpOnly`, `SameSite=Lax`,
  path `/`;
- session table with rotation on privilege change and absolute expiry;
- CSRF token on every mutation;
- roles: `owner` (billing, members, delete), `member` (connect, import, save),
  `viewer` (read only).

For a fully local single-operator deployment, `solo` remains no-auth. That is a
feature, not a security claim: bind it to localhost or a tailnet, never the
public internet.

## 6. Secret handling

- Encrypt at rest with AES-256-GCM using a per-workspace data key wrapped by a
  server key (`GD_SECRET_KEY` or a KMS key).
- Store only ciphertext, nonce and key version.
- Never put a token in a URL, response, report payload, log line or error string.
- Redact `Authorization`, `code`, `access_token`, `refresh_token` and cookies in
  a central logger.
- Rotate refresh tokens; revoke on disconnect and on workspace deletion.
- Use read-only scopes and restricted keys wherever the provider supports them.
- Keep a `sync_runs` audit row per attempt; never store raw provider records in
  logs.
- SSRF guard: public DNS only, no private/link-local addresses, same-origin or
  explicit provider allowlist, byte cap, timeout, no JS, no cookies except the
  provider request.

## 7. Provider plans

### 7.1 Press and news

No-credential path:

- company newsroom RSS/Atom;
- a configured public news RSS feed;
- public article links, not full-text copies.

Authorized path:

- a press database adapter with a redistribution licence.

Output: `press mention` with `title`, `publisher`, `publishedAt`, `url`,
`provenance`. It is a context lane, never a complete coverage count and never a
timeline change by itself. A missing feed is `unread`.

Implementation note: reuse `parseFeed` and the existing feed HTTP guard. Do not
fetch article bodies or bypass paywalls.

### 7.2 Product Hunt

No-credential path:

- a first-party link to the product page;
- a public feed if Product Hunt exposes one for the target.

Authorized path:

- Product Hunt API v2 with a developer token; store as a `public-current` or
  `public-dated` record depending on the endpoint.

A launch is a public event, not a growth cause. No token means `unavailable`,
not “no launches”.

### 7.3 Own ads

No-credential path:

- CSV export from the ad manager:
  `date,platform,account,currency,spend,impressions,clicks`.
- Uploaded to a workspace, or loaded locally in `solo`.

Authorized path:

- Meta Marketing API, Google Ads API, LinkedIn Marketing API, TikTok Business
  API, each with owned-account permission and read-only scope.

Output: `ad_spend` / `ad_impressions` first-party metrics. Never a competitor
creative, never a spend estimate from a public library.

### 7.4 Competitor ad creative

No-credential path:

- outbound public-library searches (current v0.11 behaviour).

Authorized path:

- a licensed provider with the right to redistribute creative and metadata;
- retain per licence terms; record `provider`, `region`, `retrievedAt`, `adId`.

Never scrape a gated library. Never label an ad-library link as a row this tool
collected.

### 7.5 GA4

No-credential path:

- GA4 CSV export with `date,metric,value` or a small normalized import.

Authorized path:

- Google OAuth, `analytics.readonly`, property id selected by the workspace;
- Data API dimensions `date`, metrics `sessions`, `conversions`, `totalRevenue`
  (only when the property has ecommerce);
- aggregate; no user-level rows.

Output: first-party metrics. They are displayable next to public events only as
an **overlay**, never auto-joined, never causal.

### 7.6 Stripe and billing

No-credential path:

- Stripe balance/revenue CSV or a generic `date,metric,value` export.

Authorized path:

- Stripe restricted key (`rak_...`) with read-only charges/subscriptions, or
  Stripe Connect OAuth if the product serves connected accounts;
- aggregate amount by currency and day; no customer PII, no payment method data.

Output: `revenue`, `payments`, `subscriptions` first-party metrics. Currency is
part of the key; do not add currencies together.

### 7.7 CRM

No-credential path:

- HubSpot/Salesforce report CSV: `date,metric,value`.

Authorized path:

- OAuth with read-only CRM scopes; aggregate deals by stage/amount/close date;
- no contact names, emails, notes or free-text fields.

Output: `pipeline`, `deals_won`, `deal_value` first-party metrics. A deal is not
a page-change outcome.

## 8. Report composition and causality

The composer has two layers:

1. **Public evidence** — dated page changes, site expansion, public signals,
   press, jobs, release feeds. Each row carries `sourceUrl` and `evidence`.
2. **Private overlay** — imported or OAuth metrics, explicitly enabled by the
   report owner. Each row carries `dataClass` and `provenance`.

There is no automatic date join. If an operator wants an overlay, they choose
`metric`, `from`, `to` and `alignment: 'month' | 'week'`. The UI labels it
“first-party overlay; association only”. It cannot produce a causal statement or
a growth score.

## 9. API surface

Public:

```http
GET /api/health
GET /api/capabilities
GET /api/growth?url=
GET /api/sitegraph?url=
GET /api/signals?url=
GET /api/reports/:id          # only when visibility=public
```

Authenticated workspace:

```http
GET    /api/workspaces
POST   /api/workspaces
GET    /api/connections
POST   /api/connections/:provider/start
GET    /api/oauth/:provider/callback
DELETE /api/connections/:id
POST   /api/imports/metrics
POST   /api/imports/ads
GET    /api/metrics?from=&to=&metric=
GET    /api/reports
POST   /api/reports
DELETE /api/reports/:id
```

`GET /api/capabilities` returns only non-secret metadata:

```json
{
  "authMode": "solo",
  "connectors": [
    {
      "id": "press-rss",
      "lane": "press",
      "state": "manual",
      "credential": "none",
      "fallback": "public-feed",
      "dataClass": "public-dated"
    }
  ]
}
```

It never returns tokens, client secrets, account ids or raw provider payloads.

## 10. Acceptance tests

The architecture is not “done” until these exist:

- **Matrix test:** every connector has a no-credential path and an authorized
  path, and declares `dataClass` and `neverClaims`.
- **Import test:** ad CSV with two rows loads; no network call; one duplicate is
  reported; a missing header fails with a human sentence.
- **Press test:** RSS fixture yields dated entries; an unavailable feed is
  `unread`, not zero.
- **OAuth test:** fake authorize → callback with wrong state is rejected; valid
  state exchanges once; token never appears in a response or log.
- **Tenant test:** workspace A cannot read B's report, connection, metric or
  secret even with a known id.
- **Revocation test:** disconnecting a provider revokes the token and moves the
  connection to `revoked`; previous data remains labelled historical.
- **Composer test:** a private metric never appears in a public report; an
  overlay requires an explicit flag and is labelled association-only.
- **Deletion test:** deleting a workspace removes private rows and revokes
  grants.

## 11. Delivery sequence

| Phase | Ships | Credential needed? | Exit test |
|---|---|---|---|
| P0 | this architecture + connector matrix | no | doc and matrix review |
| P1 | press RSS lane + ad/revenue CSV import | no | fixture + import tests |
| P2 | `team` profile: OIDC, Postgres, workspace, secrets | IdP + DB | tenant isolation + auth callback |
| P3 | GA4 + Stripe + CRM OAuth | provider apps | fake-provider contract tests |
| P4 | owned-ad APIs + licensed competitor-ad adapter | provider approval/licence | provenance + revocation tests |
| P5 | Product Hunt adapter | API token optional | unavailable vs no-launch test |

Phase boundaries are real: P2 does not ship without tenant isolation tests, and
P4 does not ship without a licence that permits redistribution.

## 12. What this architecture refuses to do

- Scrape Meta, Google, TikTok or LinkedIn ad libraries.
- Put a provider token in local storage or a report payload.
- Treat an ad-library link as evidence collected by this tool.
- Treat a first-party metric as public evidence.
- Auto-join a revenue metric to a page change and call it a result.
- Turn a snapshot into a historical series.
- Use a saved-report id as authorization.
- Ship a public multi-user deployment with no auth.

## 13. Decision log

- **OIDC over custom passwords.** Do not own credential storage for a team
  product; use a standards-compliant IdP and a session adapter.
- **Postgres only in team/managed.** `solo` keeps the JSON store; no database
  dependency for the open-source single-user path.
- **Two ad families, not one.** Owned-account performance and licensed
  competitor creative have different rights and different claims.
- **CSV is a first-class path, not a fallback apology.** Provider exports are
  how most operators actually get data; importing them is honest and useful.
- **No auto-join.** The public record and first-party outcomes stay separate
  unless an operator explicitly overlays them.
- **No “complete”**. Every source cap, sample and stale timestamp is visible.

## 14. Optional AI research layer (Grok / xAI)

Do not use Grok or any LLM as the crawler. A model that is asked to “look at a
site” is non-deterministic, difficult to audit, expensive per page, and easy to
turn into a terms-of-service problem. The crawler is the bounded site graph;
the feed/job/press lanes are deterministic parsers.

An AI layer can still be useful **after** collection, as a writer over a closed
evidence packet:

```ts
type AIResearchInput = {
  target: string
  period: { from: string; to: string }
  coverage: { sampled: number; listed: number }
  events: Array<{
    id: string
    date: string
    type: string
    title: string
    detail: string
    sourceUrl: string
    evidence: string
  }>
  caveats: string[]
}

type AIResearchOutput = {
  sentences: Array<{ text: string; eventIds: string[] }>
  rejectedClaims: string[]
}
```

Rules:

- Use a server-side xAI key; never expose it to the browser.
- The model receives the evidence packet, not a browsing tool and not a list of
  URLs to fetch.
- Every assertion must cite one or more `eventIds`; unsupported sentences are
  rejected before rendering.
- The model may not produce a number that is absent from the packet.
- A failed or empty AI response degrades to the deterministic growth brief, not
  to invented prose.
- Pin model/version, cache by packet hash, cap tokens and log no raw provider
  payload beyond the audit run.
- Label the result “AI-assisted reading of the same evidence”, not “analysis”.
- No AI-generated page fetches, login attempts, ad-library scraping or
  first-party data access.

The deterministic `buildGrowthBrief` in v0.12.0 is the no-AI default. It has no
provider dependency and is the fallback whenever an AI layer is unavailable.

## 15. Open decisions before P2

1. OIDC provider: Authentik, Keycloak, or Supabase Auth.
2. Postgres host and backup policy for `team`/`managed`.
3. Object storage for imported files and export artifacts.
4. Licensed ad provider and the exact redistribution terms.
5. Whether a `team` workspace can make a public report with an overlay
   (default: no; public reports are public evidence only).
