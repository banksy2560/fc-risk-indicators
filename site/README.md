# FC Risk Indicators: static site (Direction 2, "Research library")

Plain static site (no framework, no build step on the host). The generated output in this folder is committed and deployed as is.

## Rebuild after the YAML changes
```
pip install pyyaml
python3 tools/build_site.py        # run from the repo root (git is used for "recently added" dates)
python3 tools/validate.py . --strict
```
`tools/build_site.py` is the single generator. It reads `controls/`, `indicators/`, `typologies/` and `vocab.yaml` and regenerates:
- `site/data/index.json` (lightweight index of all three catalogues, labels, exposure and git dates; about 550 KB raw, about 120 KB gzipped)
- `site/data/typologies/<ID>.json`, `indicators/<ID>.json`, `controls/<ID>.json` (lazy-loaded record detail; indicator files hold inherited exposure and provenance)
- `site/data/notes.json` (data sources and false-positive notes; fetched only when exporting the indicator list as CSV)
- `site/data/links.csv` (every typology, indicator and control link)
- `site/*.html` (assembled from `tools/site_src/layout.html` and `tools/site_src/pages/*.html`; `typologies`, `indicators`, `controls` and `explorer` are the same explorer page with a different default tab)

`site/assets/` (`app.css`, `core.js`, `home.js`, `explorer.js`, `relationships.js`, `coverage.js`) is hand-written and untouched by the build. Edit page text in `tools/site_src/pages/`, not in `site/*.html`. The build exits non-zero if a link or exposure value does not resolve.

## Derived data (nothing invented)
- **Inherited exposure**: an indicator's exposure is the union of the exposure of every typology that links it. The per-typology tags are kept in the indicator record.
- **Cross-cutting typologies**: a `cross_cutting` typology with an empty exposure dimension "applies across all" of it. The site says so instead of "none", and such typologies (and indicators linked to them) match any value of that dimension in exposure filters. Empty dimensions on other typologies show "No tags" and do not match.
- **Recently added**: commit time of the first git commit that added each typology file. If git history is unavailable the home panel is omitted. Indicators and controls live in shared files so have no date.
- **Source evidence facet**: best citation tag among a typology's sources (agent-checked with link / without link / unverified); indicators take the best of their typologies. Never means human-confirmed.
- **Review status**: real `status` values (all `draft`); typologies and controls have no status field and default to `draft`.

## Preview locally
```
python3 tools/serve_site.py 8000   # then open http://127.0.0.1:8000/
```
`tools/serve_site.py` mimics Vercel's `cleanUrls`. Opening files from disk (file://) will not work because pages use `fetch()`; a message explains this.

## Deploy (Vercel)
Import the repo, set **Root Directory** to `site`, Framework Preset "Other", no build command. `vercel.json` enables `cleanUrls` and sets cache headers for `/data` and `/assets`.

## Pages and citable routes
- `/` dashboard; `/explorer` browse and compare; `/relationships` typology to indicators to controls flow; `/coverage` typology x control-family matrix (linkage counts only); `/about`
- Citable records (hash routes, also bare ids): `/typologies#ML-MULE`, `/indicators#IND-TXN-017`, `/controls#CTL-037`. Filter state uses `#m=i&channel=mobile_app&sev=high&sel=IND-TXN-017`. Flow: `/relationships#t=ML-MULE&sel=CTL-012`.
- Search palette: `/` or Ctrl/Cmd-K on any page.

External network use: Google Fonts only (system font fallbacks).
