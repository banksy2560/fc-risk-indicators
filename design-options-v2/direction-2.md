# Direction 2: Research library, light and editorial

Files: `d2-home.html`, `d2-explorer.html`, `d2-relationships.html` (self-contained; only Google Fonts is external). Real data from `site/data/` for 16 typologies (ML-MULE, ML-TBML, ML-SHELL, ML-STRUCT, TF-LONEACTOR, PF-DUALUSE, SANC-CRYPTO, FR-APP, FR-ROM, BC-FBRIBE, TX-VATFRAUD, HT-TRAFFICK, EC-WILDLIFE, CY-MIXER, OP-DRUGS, XC-CHANNEL), their 123 linked indicators (full link/context data) and all 177 controls. Home counts, domain bars, reuse ranks and coverage insights come from the full index (115/676/177).

## Rationale
- Opposite of a dark app shell: cool grey-green paper, ink-blue-black text, top navigation, reading-width content, one sticky right-hand record panel. Reads like a research library that happens to be a live intelligence tool.
- Journey in few clicks: Cmd/Ctrl-K or `/` opens a palette from any page; typology -> "Open relationship flow" -> select indicator -> controls highlight -> detail panel shows exposure, controls and source evidence. Home has a five-step journey strip.
- Concept identity is colour + shape + label: typology indigo diamond, indicator ochre ringed dot, control teal shield. Used in tabs, tags, list rows, flow columns and palette.
- Signal strength is three neutral ink bars plus a word; never red/amber/green, never summed. Panels state this explicitly.
- Truthfulness: a v0.1 / AI-drafted / unreviewed banner on every page, "Draft - unreviewed" status on every record, "Human reviewed: 0" in the review facet, exposure labelled "where it typically shows up" with the note that it is not an institution's exposure.
- Illustrative values (dashed amber "illustrative" tag): exposure tags (products, channels, rails, segments), evidence basis, confidence, last reviewed/drafted date, "recently drafted" dates. Real: everything else, including sources and their agent-checked/unverified tags.

## Component inventory
Status banner; top nav + Cmd-K trigger; command palette (dialog + combobox/listbox); hero search + stat tiles; journey strip; bar lists (domain, category); insight rows; ranked lists (most reused); concept tabs (tablist); facet panel (details groups, live counts, active-filter chips, clear all); list row (master); sticky detail panel with pin-to-compare tabs (up to 4); rich indicator record (description, signal strength, detection, exposure, typologies, controls grouped by type, provenance, sources); typology and control records; relationship flow (typology -> indicators -> controls, SVG connectors drawn only for the selected item); control reuse table with "also used in"; CSV export (explorer: current filtered list per concept; flow: typology/indicator/control rows); mobile record sheet.

## Tokens
Defined in the comment block at the top of each file and in `:root`.
- Light: bg `#EDF0EC`, surface `#FAFBF9`, ink `#15202B`, ink-2 `#3F4D59`, ink-3 `#5F6C76`, rule `#D3D9D4`. Typology `#4338A5`, indicator `#7E5200`, control `#0B6256`, illustrative `#6B4C00` on `#F7EDCF`, focus `#1B4F9C`.
- Dark (prefers-color-scheme, explicit bg `#0F1519`): surface `#151D22`, ink `#E7EDEA`, typology `#B4AEF7`, indicator `#E6BC62`, control `#62D2BC`. `data-theme` overrides are supported but there is no toggle.
- Type: Hanken Grotesk (UI), Bricolage Grotesque 700 (page titles, big numerals only), IBM Plex Mono (IDs, counts). Radius 10/8/999; gutter clamp(16px,3vw,32px).

## Responsive and accessibility
Facets collapse behind a Filters button below 1100px; the detail panel becomes a full-screen sheet with Back button and Esc; the flow stacks vertically below 860px (connectors hidden); tables restack. Semantic landmarks, skip link, visible focus rings, tablist with arrow keys, arrow-key row navigation, aria-live result counts, dialog palette with focus return. Verified no horizontal page overflow at 390px and no console errors in headless Chromium.

## Tradeoffs
- Light paper with a sticky three-column explorer is dense but needs >= 1280px for comfort; on tablets the panel is a sheet, so side-by-side comparison there relies on pin tabs rather than simultaneous view.
- Flow is clean but shows one typology at a time; cross-typology control reuse is a table plus "also used in" chips, not a graph.
- Prototype data is a sample; facet counts reflect the sample, not 115 typologies. Home links to domains with no sample typologies yield empty lists.
- Evidence-status facet is derived from typology source tags (agent-checked link / unchecked link / unverified), which is a proxy until per-indicator provenance exists.
- Pin-to-compare is tabbed, not a true side-by-side table.
- Fonts need network; falls back to system sans.
