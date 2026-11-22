# FC Risk Indicators: static site

Plain static site (no framework, no build step on the host). The generated output in this folder is committed and deployed as is.

## Rebuild after the YAML changes
```
pip install pyyaml
python3 tools/build_site.py        # run from the repo root
```
This reads `controls/`, `indicators/`, `typologies/` and regenerates:
- `site/data/index.json` (lightweight index of everything, about 440 KB, about 110 KB gzipped)
- `site/data/typologies/<ID>.json`, `site/data/indicators/<ID>.json`, `site/data/controls/<ID>.json` (lazy-loaded detail)
- `site/*.html` (assembled from `tools/site_src/layout.html` and `tools/site_src/pages/*.html`)

`site/assets/` (CSS and JS) is hand-written and is not touched by the build. Edit page text in `tools/site_src/pages/`, not in `site/*.html`, or your edits will be overwritten. The build prints counts and exits non-zero if a link points at an unknown id.

## Preview locally
```
python3 tools/serve_site.py 8000   # then open http://127.0.0.1:8000/
```
`tools/serve_site.py` mimics Vercel's `cleanUrls` (`/about` serves `about.html`). Opening the HTML files directly from disk (file://) will not work because pages load data with `fetch()`; the pages show a message explaining this.

## Deploy (Vercel)
Import the repo and set the **Root Directory** to `site`, Framework Preset "Other", no build command and no output directory (or run `vercel --prod` from inside `site/`). `vercel.json` enables `cleanUrls` and sets cache headers for `/data` and `/assets`.

## Pages
- `/` search catalogue (facets, detail drawer)
- `/typologies#ML-MULE`, `/controls#CTL-037`, `/indicators#IND-TXN-017` citable pages (hash routes)
- `/coverage` typology x control-family matrix (linkage counts only)
- `/about` status, linking model, principles, citation tags, glossary, contributing, licences, known gaps

External network use: Google Fonts only (falls back to system fonts).
