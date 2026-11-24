# Field receipt: the public growth timeline

A growth operator preparing a positioning review needs a dated signal before a chart. The dark receipt masthead and its linked source lines are the distinctive move. Navigation, exports and selectors stay familiar.

## The timeline surface

The default report is a merged growth timeline: dated page changes, self-reported sitemap expansion and public Hacker News signals. Every event has a source link and an evidence label. The narrative is a three-act reading of the same record; it does not add a source or a claim. The site footprint sits beside the narrative as self-reported context, not traffic. Compare, charts, the matrix and the dated log are explicitly labelled as receipts below the narrative. **Copy timeline** exports the merged record, coverage and linked dates as Markdown.

## Reading contract

- Show the latest comparable wording change for each field, not just the first and last strings. A headline that changes and reverts still has a history. Cite both sides.
- Compare monthly dollars in the earliest capture with a range against the latest capture. These are bounds across strings, **not the same plan tracked over time**. Missing amounts stay missing. The price chart instead pools monthly amounts by calendar month.
- Put arbitrary two-capture comparison immediately after the story. The newest-first log can isolate pricing or messaging from punctuation edits. The baseline is not a change.
- Give dated Wayback reads priority. Arquivo.pt's estimate and inspected count are separate. Hacker News describes submitted links, not reactions to a price change. Ad links are manual searches. Only the Wayback evidence freezes when saved.
- New-target search and optional live/archived views are disclosures. No additional server routes, fetches, tracking, packages or external assets.

## Reading different date pairs

The takeaway and copied Markdown use the same observations. The latest readable capture is context, not a fourth change. Each story scene links to its own evidence dates. Compare names its earliest/latest default and repeats the selected dates as the reader changes them. Its exact price strings are not the monthly-only range. A punctuation-only title edit keeps the words intact; the text legend uses the same marks as the diff.

The documentary is not a performance claim. It reads the public offer surface and the archived sitemap footprint; it never infers traffic, revenue, conversion or cause. The opening quote is verbatim archive text, marked as such. Scenes are ordered by capture date, and the story keeps the opening and closing records even when there are no comparable field changes.

The sample quotes both monthly amounts from the linked 29 May 2026 capture. In the monthly chart, ink means selection, not a verified read. The matrix reports the count and span before the scroll area. Story titles are links, with host search for further reading; external search is broader than the matched set. On phones the primary and secondary actions fill a two-column grid. Disclosures keep native keyboard behavior with local chevrons.

## Material and interaction

Default zinc canvas, opaque stock, one-pixel edges, a fine inset highlight, low shadow and 10px controls. Ink for the primary action; neutral outlines for secondary actions. Green marks reads, amber an unavailable source. Red is for destructive or removed content. Display: Fraunces, fluid 48–84px on landing. Section: 28–40px. Instrument Sans for reading and controls; JetBrains Mono for dates and source labels. Spacing uses 8px steps with 4px subdivisions. Cap prose at 65ch. On phones, the example follows the form rather than shrinking alongside it.

Do not animate data into view. Buttons give press feedback in 160ms ease-out; reduced motion suppresses the transform. On mobile, select a month for exact amounts instead of shrinking the chart. The matrix keeps its field labels in place while months scroll; a dash means no *observed* change.

## Source decisions

| Primary material inspected | Adopted | Left out |
|---|---|---|
| [Impeccable](https://impeccable.style), local `creative/impeccable-design/SKILL.md` and `references/{emil-motion-standards,open-design-integration}.md` | Seven-domain critique: prioritize the task, remove duplicate headings/stat tiles, use visible focus, data accents, sentence case and direct copy. | Equal-weight feature cards, gradients and generic kickers. |
| [AI for UI](https://aiforui.dev/skills), [remove animations](https://aiforui.dev/skills/remove-animations), [mobile native](https://aiforui.dev/skills/mobile-native), [repository](https://github.com/emilkowalski/skills) | Remove the repeating hero entrance and automatic smooth scroll. Keep press feedback and touch-sized controls. | No decorative chart reveals or scroll choreography. |
| [Web design skills](https://github.com/MengTo/skills), [field-guide layout](https://github.com/MengTo/Skills/blob/main/agent-skills/web-design/sylva-field-guide-layout/SKILL.md) | Shared inset, wide reading column next to a narrower figure, independent prose measure; stack before shrinking type. | No botanical art, registration guides, or imported assets. |
| [Stageshow](https://github.com/benjitaylor/skills), local `stageshow-1.1.1/SKILL.md`; [discovery post](https://x.com/benjitaylor/status/2116593247854453244) | Frame one change with exact lines and linked dates from the Basecamp timeline. | No simulated browser, invented metrics or bento grid of unrelated features. |
| [Open Design](https://github.com/nexu-io/open-design), local `skills/{impeccable-design-polish,emil-design-eng,design-review,copywriting}/SKILL.md` and `design-templates/html-ppt/assets/themes/editorial-serif.css` | Name the system first; review the rendering and make copy useful to the research task. The last two skill entries are catalogue pointers. | No studio runtime, warm slide palette or copied theme CSS. |
| [Solid Glass](https://github.com/deeplethe/solid-glass), [material and components](https://deeplethe.github.io/solid-glass) | Give surfaces weight with an edge and inset; use the existing shadcn-style button variants. | No translucent chrome, backdrop blur, package or copied CSS. |

## Reproduce the evidence

Run `pnpm check`, then `pnpm preview --host 127.0.0.1 --port 5215 --strictPort`. In a second shell:

```sh
node scripts/documentary-qa.mjs http://127.0.0.1:5215 docs/brief-v09
node scripts/a11y.mjs 'http://127.0.0.1:5215/?url=basecamp.com/pricing'
```

The browser script builds the real Basecamp documentary, checks the story scenes against the timeline response, and reads back the Markdown clipboard. It checks document width at 1440×1100 and 390×844, mobile target sizes and matrix scrolling. The screenshots in `brief-v09/` are viewports at named sections. Axe checks the rendered report, not its loading state. Live acceptance against Basecamp needs the archive online. Browser emulation does not establish physical-device or screen-reader conformance.
