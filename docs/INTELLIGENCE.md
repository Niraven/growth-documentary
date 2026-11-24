# Intelligence layers

The timeline is a record. These layers make it readable without turning it into
a score.

## Chapters

Events are grouped by calendar month for display only. A chapter keeps the
source order and exact event IDs; it does not infer that a month had a strategy
or a result. A month with no events is not invented.

The chapter title is a neutral description of the signal mix:

- “Page changes”
- “Site expansion”
- “Public signals”
- “Page changes and Public signals”

The chapter count is the number of events in that month, not a growth rate.

## Coverage gate

`assessCoverage` answers whether a run has enough independent public evidence to
support a narrative. It is deliberately conservative:

| Level | Condition | Meaning |
|---|---|---|
| `multi-source` | page history, at least 8 captures sampled, 10% of listed captures, and two context lanes | usable public record, still sampled |
| `limited` | page history with fewer lanes or a smaller sample | usable, but context is thin |
| `thin` | no dated page history | do not present this as a growth story |

The gate returns the source flags, sample/listed counts, open-role snapshot count,
and caveats. It never implies completeness. It is not a growth score.

## First-party outcomes

`parseOutcomeCsv` accepts:

```csv
date,metric,value
2026-09-01,signups,120
2026-10-01,signups,168
```

The import is local-only. Nothing is uploaded, persisted or joined to public
events automatically. It exists so an operator can put their own measurement
next to the public record without confusing it for public evidence or causal
proof.

The next layer — authenticated GA4, Stripe, CRM and ad connectors — needs
credentials, permissions, privacy review and a separate deployment boundary. It
is not faked here. The no-dead-ends design for those lanes is in
[`PLATFORM-ARCHITECTURE.md`](PLATFORM-ARCHITECTURE.md): every provider has a
public/import path or an authorized path.

## Source additions

The public-data build adds source adapters only when they can produce a dated or
explicitly current signal:

- bounded same-origin site graph (public pages only);
- RSS/Atom release feeds;
- public ATS job boards;
- existing Wayback, sitemap and Hacker News lanes.

Ad libraries and private social feeds remain manual or licensed. No scraping of
gated sources.
