# Architecture: continuous typology research agent (target design)

> **Status: design target, partly implemented.** This repository is the published output. The agent that feeds it is AI-run and every entry it adds is **AI-drafted and unreviewed** until a human maker and an independent checker approve it. Only public, authoritative sources are used. No institution's internal data, reference data or assessments belong here.

The design has six layers. The table shows what exists in this repository today.

| Layer | Purpose | In this repo today |
|---|---|---|
| 1. External authoritative sources | Regulators, FIUs, sanctions authorities, law enforcement, standard setters, government publications | Listed in [`sources/registry.yaml`](../sources/registry.yaml) |
| 2. Ingestion | Source registry, scheduler, fetchers with retry, document parser, content hash and versioning for de-duplication, quarantine for anything unparseable or doubtful | `tools/ingest.py` and [`.github/workflows/ingest.yml`](../.github/workflows/ingest.yml) fetch the registry, de-duplicate into `ingest/seen.json`, and open a pull request for new items. Failures go to `ingest/quarantine/`. Indicator extraction still records `retrieved` and `snapshot.sha256` |
| 3. Auditable system of record | Source, Publication, Snapshot, Taxonomy node, Indicator, Vector mapping, Control, Review, Model run, Audit event | Git history is the audit trail. YAML files hold Indicators (`indicators/`), Controls (`controls/`), Taxonomy nodes and vector mappings (`typologies/`, `exposure`, `vocab.yaml`), Sources and Publications (`sources/registry.yaml`), Snapshots (`evidence[].snapshot`), Reviews (`review` block), Model runs ([`CHANGELOG.md`](../CHANGELOG.md) scan entries) |
| 4. Bounded AI services | Source-quality classifier, summariser, typology and indicator extractor, taxonomy mapper, relevance assessor, control recommender; each returns structured output with evidence and a confidence | Extraction output is stored as structured YAML with a verbatim `excerpt`, source link and `extraction_confidence`. The agent may only link existing canonical controls or propose a new one for review |
| 5. Governance | Controlled vocabularies, thresholds, role-based access, prompt and data-loss guardrails, immutable audit | `vocab.yaml` and `tools/validate.py` (strict mode must pass); public-sources-only rule; git history |
| 6. Human review | Maker and checker queues, taxonomy owner, control owner, approved state | `review.state` on each new indicator (`unreviewed` until a human acts); [`REVIEW_QUEUE.md`](../REVIEW_QUEUE.md). Approval is recorded by a human setting `status: sme_reviewed` and filling `review.maker` / `review.checker` |

## Entity mapping

| Entity | Where it lives |
|---|---|
| Source (authority, type) | `sources/registry.yaml` → `sources[]`; copied into `evidence[].authority` / `source_type` |
| Publication (title, URL, date) | `sources/registry.yaml` → `publications[]`; `evidence[].publication`, `url`, `published` |
| Snapshot | `evidence[].snapshot.sha256` and `of` (`pdf_bytes` or `extracted_text`), plus `retrieved` |
| Taxonomy node | Typology id under its domain (`taxonomy_nodes: [domain/TYPOLOGY-ID]`) |
| Indicator | `indicators/<category>.yaml` |
| Vector mapping | Typology `exposure` (channels, payment rails, customer segments, products) |
| Control | `controls/<family>.yaml`, linked per indicator per typology |
| Review | `review` block on the indicator; `status` field |
| Model run | One `CHANGELOG.md` entry per scan |
| Audit event | Git commit |
| Ingest queue | `ingest/new/YYYY-MM-DD.json` on the ingest pull request; `ingest/seen.json` is the de-duplication state |

## How ingestion runs

The fetch and the de-duplication are code. The model only reads publications that this step has not seen before.

1. [`.github/workflows/ingest.yml`](../.github/workflows/ingest.yml) runs every Sunday at 20:00 UTC (Monday morning in Sydney) and when someone starts it by hand.
2. `tools/ingest.py` reads [`sources/registry.yaml`](../sources/registry.yaml) and fetches each source in order. A source is an RSS or Atom feed, a server-rendered HTML listing, a public JSON listing, or `manual` when nothing machine-readable is reliable. Requests are sequential, carry a User-Agent naming this repository, and time out. One failed source is quarantined; it does not fail the run.
3. Each item is normalised to a title, URL, publication date and authority. The identity is the SHA-256 of the normalised URL plus the title. `ingest/seen.json` maps that hash to the UTC date it was first seen. Raw HTML is not committed. A hash of the response body may be stored with the item.
4. The first successful fetch of a source records items already published on or before that day as seen, and does not report them. After that, only items whose hash is not in `ingest/seen.json` are written to `ingest/new/YYYY-MM-DD.json`.
5. When that file has items, the workflow pushes branch `ingest/YYYY-MM-DD` and opens a pull request titled `Ingest: N new publications (YYYY-MM-DD)`, labelled `new-publications`, listing authority, title and link. When nothing is new, updates to `ingest/seen.json` or `ingest/quarantine/` are committed on `main` and no pull request is opened.
6. An AI reviewer then drafts typologies and indicators from those new items only, with a verbatim excerpt, source link and snapshot hash, for human maker/checker review. Anything added stays `status: draft` and `review.state: unreviewed`.

## Rules the agent follows
1. Public, authoritative sources only. Nothing internal to any employer or institution, no customer or case data.
2. Every new indicator cites a real publication with URL, publication date, retrieval date, snapshot hash and a short verbatim excerpt. No invented citations.
3. De-duplicate against canonical indicators first; link an existing one when it already exists in spirit.
4. `tools/validate.py --strict` must pass; `build/` and `site/` are regenerated with `tools/build_index.py` and `tools/build_site.py`.
5. Everything added stays `status: draft`, `provenance: ai_drafted`, `review.state: unreviewed`.
