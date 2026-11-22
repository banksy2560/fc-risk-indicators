# Financial Crime Risk Indicators Library

An open-source catalogue of financial crime **risk indicators (red flags)** organised by **typology**, each paired with **candidate controls** that can mitigate it. Covers money laundering, terrorist and proliferation financing, sanctions evasion, fraud, bribery and corruption, tax evasion, human trafficking, environmental crime, cyber-enabled crime and cross-cutting risk factors.

> **Status: v0.1 draft. Not reviewed.**
> Content was drafted with AI assistance and has **not** been validated by subject-matter experts. Source citations were written from model knowledge and **have not been verified**: check any citation before relying on it. Indicators are red flags, not proof of crime. Nothing here is legal or compliance advice, and no institution should treat it as a complete or approved risk assessment.

## What this is (and isn't)
- A reusable **input** to an institution's own ML/TF/fraud risk assessment, control design and monitoring scenarios.
- **Typology is the unit of analysis.** Products, channels, payment rails and customer segments are exposure dimensions, not separate registers.
- **Not** a risk register, RCSA, scoring model or alternative methodology. It prescribes no residual-risk calculation and no worst-of aggregation. `severity` means indicative signal strength only.
- See [DESIGN.md](DESIGN.md) for design principles and [SCHEMA.md](SCHEMA.md) for the format.

## Layout
```
controls/<family>.yaml        # 177 canonical controls, each defined once
indicators/<category>.yaml    # 654 canonical indicators, each defined once
typologies/<domain>/*.yaml    # 106 typologies linking to indicators + controls
build/                        # generated reverse views (control -> typologies etc.)
tools/validate.py             # integrity + duplicate checks (needs pyyaml)
tools/build_index.py          # regenerates build/
```
Controls and indicators are **linked, not copied**: one control serves many indicators and typologies. See [SCHEMA.md](SCHEMA.md).

## Use
```
pip install pyyaml
python3 tools/validate.py .      # add --strict to fail on warnings
python3 tools/build_index.py .   # regenerate build/
```

## Known limitations
- Controls and indicators were de-duplicated by AI clustering; borderline merges are listed in [REVIEW_QUEUE.md](REVIEW_QUEUE.md) for human review. Singleton indicators still carry some typology-flavoured wording.
- A few typologies have thin control coverage (e.g. institutional governance); gaps are noted in the review queue.
- Exposure tags, provenance and review fields (schema v0.2) are not yet populated.
- Detection bias: do not calibrate indicator weighting solely against your own SAR or loss data.

## Contributing
Contributions welcome: SME review, corrections, new typologies, verified citations. Mark reviewed items `status: sme_reviewed` with `last_reviewed`. Reviewers should be independent of whoever drafted the content. Do not submit real customer, case or personal data.

## Licence
- Code (`tools/`): Apache-2.0, see [LICENSE](LICENSE).
- Content (`typologies/`, docs): CC-BY-4.0, see [LICENSE-CONTENT](LICENSE-CONTENT).
