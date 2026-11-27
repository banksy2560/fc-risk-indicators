# Changelog

All content is AI-drafted and unreviewed unless a human has marked it `sme_reviewed`. Each scan is one "model run" in the sense of [docs/architecture.md](docs/architecture.md).

## 2026-11-27: publication ingest
The repetitive fetch and de-duplication of the weekly scan now runs in code. `tools/ingest.py` reads `sources/registry.yaml`, fetches each public listing (RSS, Atom, HTML or JSON), and records a SHA-256 of the normalised URL and title in `ingest/seen.json`. The first successful fetch of a source seeds items already published. Later runs write only unseen items to `ingest/new/YYYY-MM-DD.json`. A source that fails goes to `ingest/quarantine/` and does not fail the run.

`.github/workflows/ingest.yml` runs that script every Sunday at 20:00 UTC and opens a pull request labelled `new-publications` when there is something new. `.github/workflows/validate.yml` runs `tools/validate.py --strict` and the build scripts on pull requests and on pushes to main. An AI reviewer still drafts typologies and indicators from the new items, for human maker/checker review.

## 2026-11-27: weekly scan, baseline run
Scope: global public sources on financial crime and fraud red flags, focused on the last 12 months. Sources used are in [sources/registry.yaml](sources/registry.yaml) (9 publications extracted, 11 more identified for the next run).

Added
- 6 typologies: ML-CUCKOO (cuckoo smurfing), OP-PAYTEXT (payment text field abuse), OP-SCAMBLE (unlawful online gambling apps and micro-laundering), CY-GUARANTEE (guarantee marketplaces and no-KYC laundering services), SANC-SETTLE (sanctions-evasion settlement networks and sanctions-linked stablecoins), FR-RECOV (fund-recovery and official-impersonation follow-on scams).
- 33 canonical indicators (IND-BEH-121..126, IND-CPT-063..067, IND-CUS-055..056, IND-DOC-070..071, IND-GEO-045..046, IND-OWN-030, IND-PRD-070..071, IND-TXN-162..173, IND-TYP-069), each with source, publication, retrieval date, snapshot hash, verbatim excerpt, taxonomy nodes and `review.state: unreviewed`.
- 1 control: CTL-178 operational-infrastructure spend anomaly monitoring.
- 55 typology-indicator links (38 in new typologies, 17 in existing ones).
- docs/architecture.md, sources/registry.yaml, this changelog; v0.3 optional evidence/review fields in SCHEMA.md; `agent-retrieved` citation tag.

Updated
- New links and sources in FR-SCOMP, FR-IMP, FR-VULN, SANC-CRYPTO, ML-TBML, OP-GAMBLE, ML-CASINO, CY-PAYFAC, OP-EXTORT.
- Newer source added (no new links) to ML-HAWALA, ML-PMLN (FATF 2026 PML/underground banking report), FR-ROM (FinCEN 2026 scam-centre alert) and FR-XBMULE (FATF 2026 scam-compound report).
- `build/` and `site/` regenerated.

Primary sources: FATF scam compounds (5 Nov 2026), FATF gaming and gambling red flags (9 Sep 2026), FATF PML/underground banking (3 Sep 2026), FinCEN FIN-2026-Alert005 scam centres (3 Sep 2026), FinCEN FIN-2026-Alert007 A7 network (1 Oct 2026), FINTRAC-2026-SB002 extortion (Apr 2026), AUSTRAC/Fintel Alliance Scambling report (Nov 2025), cuckoo smurfing guide (Jun 2021) and payment text fields guide (Nov 2021).
