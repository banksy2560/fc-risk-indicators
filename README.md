# Financial Crime Risk Indicators Library

An open-source catalogue of financial crime **risk indicators (red flags)** organised by **typology**, each paired with **candidate controls** that can mitigate it. Covers money laundering, terrorist and proliferation financing, sanctions evasion, fraud, bribery and corruption, tax evasion, human trafficking, environmental crime, cyber-enabled crime and cross-cutting risk factors.

> **Status: v0.1 draft. Not reviewed.**
> Content was drafted with AI assistance and has **not** been validated by subject-matter experts. Most source citations were written from model knowledge and **have not been verified**: check any citation before relying on it. Entries added by the weekly scan (from 2026-11-27) cite documents the agent actually retrieved, with excerpts and snapshot hashes, but are still AI-drafted and unreviewed. Indicators are red flags, not proof of crime. Nothing here is legal or compliance advice, and no institution should treat it as a complete or approved risk assessment.

## What this is (and isn't)
- A reusable **input** to an institution's own ML/TF/fraud risk assessment, control design and monitoring scenarios.
- **Typology is the unit of analysis.** Products, channels, payment rails and customer segments are exposure dimensions, not separate registers.
- **Not** a risk register, RCSA, scoring model or alternative methodology. It prescribes no residual-risk calculation and no worst-of aggregation. `severity` means indicative signal strength only.
- See [DESIGN.md](DESIGN.md) for design principles, [SCHEMA.md](SCHEMA.md) for the format and [docs/architecture.md](docs/architecture.md) for the research-agent design.
- **Public sources only.** Nothing internal to any employer or institution is used or accepted.

## Layout
```
controls/<family>.yaml        # 178 canonical controls, each defined once
indicators/<category>.yaml    # 709 canonical indicators, each defined once
typologies/<domain>/*.yaml    # 121 typologies linking to indicators + controls
sources/registry.yaml         # public authoritative sources and publications scanned
ingest/seen.json              # hash of each publication already seen, and when
ingest/new/                   # genuinely new items from a weekly ingest run
ingest/quarantine/            # sources that failed to fetch or parse
docs/architecture.md          # target design of the research agent that feeds this repo
CHANGELOG.md                  # one entry per scan / release
build/                        # generated reverse views (control -> typologies etc.)
tools/validate.py             # integrity + duplicate checks (needs pyyaml)
tools/build_index.py          # regenerates build/
tools/ingest.py               # fetches public listings and de-duplicates them
```
Controls and indicators are **linked, not copied**: one control serves many indicators and typologies. See [SCHEMA.md](SCHEMA.md).

## Use
```
pip install pyyaml
python3 tools/validate.py .      # add --strict to fail on warnings
python3 tools/build_index.py .   # regenerate build/
```

## Ingestion
The weekly scan's fetch and de-duplication run in GitHub Actions, not in the model. `tools/ingest.py` reads `sources/registry.yaml`, fetches each public feed or listing, and skips anything already recorded in `ingest/seen.json`. New items are written to `ingest/new/YYYY-MM-DD.json`. A failed source is quarantined and does not stop the run.

[`.github/workflows/ingest.yml`](.github/workflows/ingest.yml) runs every Sunday at 20:00 UTC (Monday morning in Sydney). If there are new publications it opens a pull request titled `Ingest: N new publications (YYYY-MM-DD)` and labelled `new-publications`. If there are none, it commits the seen-state or quarantine update to `main` and opens no pull request. An AI reviewer then drafts typologies and indicators from that pull request only, for human maker/checker review. See [docs/architecture.md](docs/architecture.md).

```
pip install -r requirements.txt
python3 tools/ingest.py .
```

## Citation status tags
Each typology `sources` entry carries a tag. **No citation has been confirmed by a human.**
- `[agent-retrieved YYYY-MM-DD]` an AI agent fetched and read the document on that date; the indicator stores a short verbatim excerpt and a snapshot hash. Not human-verified.
- `[agent-reviewed]` an AI agent searched for it and found a matching real document (a listed URL may not have been fetched). Still verify before relying on it.
- `[corrected, agent-reviewed]` the original title/year/publisher was wrong and was corrected by the same process.
- `[unverified]`, `[corrected, unverified]`: not confirmed by search; from model knowledge.
- `[too vague, unverified]`: names a body or topic but not a specific document.
- `[replacement suggested, unverified]`: the original could not be found; a nearest real document is suggested.

## Known limitations
- Controls and indicators were de-duplicated by AI clustering; borderline merges are listed in [REVIEW_QUEUE.md](REVIEW_QUEUE.md) for human review. Singleton indicators still carry some typology-flavoured wording.
- A few typologies have thin control coverage (e.g. institutional governance); gaps are noted in the review queue.
- Exposure tags (`exposure` in each typology) and indicator provenance fields are AI-inferred and unreviewed; they describe where a typology typically shows up, not any institution's assessed exposure.
- Detection bias: do not calibrate indicator weighting solely against your own SAR or loss data.

## Contributing
Contributions welcome: SME review, corrections, new typologies, verified citations. Mark reviewed items `status: sme_reviewed` with `last_reviewed`. Reviewers should be independent of whoever drafted the content. Do not submit real customer, case or personal data.

## Licence
- Code (`tools/`): Apache-2.0, see [LICENSE](LICENSE).
- Content (`typologies/`, docs): CC-BY-4.0, see [LICENSE-CONTENT](LICENSE-CONTENT).
