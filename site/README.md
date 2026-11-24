# FC Risk Indicators: static site

Plain static site, no framework and no build step on the host. The generated output in this folder is committed and deployed as is. Two jobs only:

- `/` Linkage: a hub-and-spoke diagram. The typology is a card in the centre, its indicators (what you would observe) on the left, its controls (what mitigates) on the right. Click an indicator to trace the controls linked to it in this typology, or a control to trace its indicators. A slim drawer holds descriptions, typology-specific context, false-positive notes, sources with status tags and "also used in N typologies" pivots. Search an indicator or control to get the same diagram with that item in the centre and every typology it appears in on the left. A "Consumer bank view" (product and channel) narrows the typology tab strip. Copy link and CSV export act on what is displayed.
- `/product` Product mapper (consumer bank): pick one of 7 products, tick the channels (4), answer only the questions that apply, and see typologies as Strong / Possible / Base fit (specificity of fit, not risk). Also a 7 x 4 product-by-channel grid, manual include/exclude, "Open linkage", and a product pack CSV. Everything runs in the browser; state lives in the URL hash and `localStorage`. A fresh visit without a hash starts blank and offers Resume / Forget for the saved answers.
- `/about` status, how linking works, how the mapper works and its limits, citation tags, licences.

Old routes redirect (see `vercel.json`): `/typologies`, `/indicators`, `/controls`, `/explorer`, `/relationships`, `/coverage` go to `/`; the hash is kept, so `/controls#CTL-012` lands on `/#CTL-012`.

## Rebuild
```
pip install pyyaml
python3 tools/build_site.py          # single generator, re-runnable
python3 tools/validate.py . --strict
python3 tools/serve_site.py 8000     # local server; mimics cleanUrls and the vercel.json redirects
```
`tools/build_site.py` reads `controls/`, `indicators/`, `typologies/`, `vocab.yaml` and `questionnaire/questions_v2.yaml`, and writes:
- `data/index.json` small index (about 183 KB raw, 40 KB gzipped): typologies with exposure and consumer scope, indicator and control names, and every typology to indicator to control link. Search, the tab strip, reverse views, the mapper and the grid all derive from it.
- `data/search.json` (about 234 KB raw, 76 KB gzipped) id, name, description and typology key terms; fetched lazily on first focus or keystroke in the Linkage search.
- `data/t/<ID>.json` one typology's linkage (nodes, per-link controls, contexts, sources; 14 KB at most), fetched on demand.
- `data/i/<ID>.json`, `data/c/<ID>.json` canonical indicator and control detail, fetched only for the reverse-view drawer.
- `data/questionnaire.json` questions, options, example profiles.
- `assets/<name>.<hash>.<ext>` content-hashed copies of `tools/site_src/assets/*`.
- `*.html` assembled from `tools/site_src/layout.html` and `tools/site_src/pages/*.html`.
The build fails on any unresolved link, any tag value not in `vocab.yaml` (including `consumer_scope`), a question mapping outside its allowed dimensions, or a bad profile. Edit sources in `tools/site_src/`, never the generated files.

## Caching
Asset filenames carry a content hash and data URLs carry `?v=<data hash>`, so `/assets/*` and `/data/*` are cached as immutable and stale files cannot mix with new HTML (HTML is revalidated on every load by default).

## Deploy (Vercel)
Import the repo, set Root Directory to `site`, Framework Preset "Other", no build command.

## Motion
Only transform, opacity and clip-path animate; tokens are at the top of `app.css`. Keyboard use (arrows, Enter, Esc) never animates. Under `prefers-reduced-motion` only short opacity fades remain. `data-motion="off"` on `<html>` disables motion.

External network use: Google Fonts only (system font fallbacks).
