# Direction 1: Intelligence platform

Files: `d1-home.html` (dashboard), `d1-explorer.html` (list, facets, persistent detail panel), `d1-relationships.html` (typology to indicators to controls map, control reuse, matrix). Static, no build, Google Fonts only. Data is inlined from `site/data` (all 115 typologies, 676 indicators and 177 controls as compact records; 16 sample typologies carry full per-link context and per-indicator controls and drive the relationship view). Generator scripts are in the session scratchpad (`design2/build_data.py`, `assemble.py`).

## Rationale
- Reads as analyst software: a fixed navy shell (header, left nav, Cmd-K bar) frames light-grey or dark content surfaces. One electric-blue accent for actions and selection; everything else is neutral.
- The journey typology, indicator, exposure, control, source evidence is a single scrolling record in a right-hand panel with section tabs (Overview, Exposure, Typologies/Indicators, Controls, Evidence). Every related record is a link that swaps the panel, with a Previous button and up to four pinned records, while the list stays put. From a search hit, one click reaches any step.
- Each concept has a distinct colour, icon and shape (typology violet, node-graph icon, squared; indicator ochre, flag icon, flag-ended; control teal, shield icon, shield-topped) and always a text label, so colour is never the only cue.
- Signal strength is a three-step bar in a single blue ramp, deliberately not red/amber/green, always captioned "indicative, not a risk score". Nothing is summed, averaged or worst-of.

## Product-truth handling
- Persistent amber banner on every page: v0.1, AI-drafted, unreviewed, red flags not proof, not a score, exposure tags are descriptors.
- Exposure (product, channel, rail, customer segment) is derived by keyword heuristic in the generator and tagged with a yellow `illustrative` marker plus a callout saying it is not an institution's assessed exposure.
- Evidence basis, confidence and last reviewed are illustrative sample values (marked). Review status, provenance, and source tags are real: all draft, AI-drafted, no named reviewer, source tags from the data. Review-status filter lists In review and Reviewed with zero matches to preview the state.
- "Recently added" is a labelled stand-in (highest IDs) because v0.1 data has no timestamps. Coverage insights are computed catalogue structure facts, not institutional coverage.

## Component inventory
App shell (header, nav, banner, concept key); command palette (Cmd/Ctrl-K or `/`, grouped results, arrow/Enter); KPI tile; ranked bar list; domain breakdown; composition bars; signal meter; concept chip and icon; illustrative tag; facet group (checkbox fieldsets with live counts, ten dimensions); active-filter chips; segmented tabs; result row; record panel (header actions pin, copy link, CSV; section nav; exposure block; association rows; provenance table; sources list); SVG relationship graph with hover/focus path highlighting; mobile tree fallback; selection card; control reuse table; indicator-by-control matrix; CSV export (current filtered list; single record; typology link rows).

## Tokens
See the comment block at the top of each HTML file. Summary: shell `#0a1322`; light content `#eef1f5` / `#fff`; dark content `#0c121b` / `#131b27` via `prefers-color-scheme` with explicit `body` background token; accent `#1766d6` / `#5ea3ff`; Inter 14px, JetBrains Mono for IDs; radius 8; hairline borders, one shadow.

## Responsive and accessibility
Three-pane explorer at 1360 and up; facets become a drawer below that; below 900 the nav becomes a top bar and the detail panel a full-screen sheet with Back to list. Graph is replaced by a nested list on phones; the matrix scrolls inside its own container only. Skip link, landmarks, visible focus rings, arrow-key movement in lists, native dialog for the palette, live region announcing selections and exports, reduced-motion respected.

## Tradeoffs
- Dense and powerful, but heavier than a catalogue: more chrome, more concepts on screen. Best for analysts, intimidating for casual readers.
- Prototype data weight: explorer inlines about 730 KB. A real build would load JSON on demand.
- Relationship graph only for 16 sample typologies; other typologies lack per-link control mapping in the compact index.
- Illustrative exposure filters are functional but keyword-derived, so they can mislead if the marker is lost; keep the marker in production until the real exposure block lands.
- Facet counts recompute on every change; fine at this size.

## Not verified
Real-device and screen-reader testing; Safari and Firefox (checked in headless Chromium only, light and dark at 1440 and 390); print styles; exact WCAG contrast measurement (tokens chosen to meet AA by inspection).
