# Schema (v0.2: linked catalogues)

Every concept is defined **once** and linked many times:

```
controls/<family>.yaml        canonical controls          CTL-###
indicators/<category>.yaml    canonical indicators        IND-<CAT>-###
typologies/<domain>/*.yaml    typologies; each links to canonical indicators and,
                              per link, to the controls used in that typology
build/                        GENERATED reverse views (never edit by hand)
```

Many-to-many: one control serves many indicators and typologies; one indicator appears in many typologies.
To add a control or indicator that already exists in spirit, **link the existing one**. `tools/validate.py` warns on near-duplicate names.

## Control (`controls/<family>.yaml`)
```yaml
controls:
  - id: CTL-012
    name: Velocity and threshold rules
    family: transaction_monitoring
    type: detective            # preventive | detective | corrective | governance
    implementation: rule       # rule | model | process | policy | training | technology
    effectiveness: medium      # low | medium | high, typical and indicative only
    description: 2-3 sentences: what it is and how it mitigates. Generic, not typology-specific.
    also_known_as: [synonyms merged into this control]
```

## Canonical indicator (`indicators/<category>.yaml`)
```yaml
indicators:
  - id: IND-TXN-017
    name: Rapid pass-through of received funds
    description: 1-2 generic sentences describing the observable pattern.
    category: transaction      # customer | transaction | geographic | product_channel | behavioural | ownership_structure | document | counterparty | typology_specific
    severity: high             # indicative signal strength (low|medium|high). NOT a risk rating; never aggregate worst-of.
    detection_type: [transaction_monitoring]   # transaction_monitoring | kyc_review | screening | customer_behaviour | document_review | investigator_judgement | external_intel
    data_sources: [account_transactions]
    false_positive_notes: Generic legitimate explanations.
```

## Typology (`typologies/<domain>/<id>.yaml`)
```yaml
typology:
  id: ML-MULE
  name: Money mules
  domain: money_laundering     # money_laundering | terrorist_financing | proliferation_financing | sanctions | fraud | bribery_corruption | tax_evasion | human_trafficking_modern_slavery | environmental_crime | cyber_enabled | other_predicate | cross_cutting
  description: ...
  stage: [placement, layering] # optional
  sectors: [banking, payments] # banking | payments | crypto | insurance | securities | casino_gaming | dnfbp | real_estate | mvts | fintech | trade_finance | corporate_services | art_luxury | all
  sources: ["issuing body, report, year (verify before relying)"]
  indicators:
    - ref: IND-TXN-017                 # canonical indicator
      legacy_id: ML-MULE-003           # v0.1 id, kept for traceability
      context: How this indicator shows up in THIS typology (typology-specific wording lives here).
      severity_in_typology: medium     # optional, only when it differs from canonical
      name_in_typology: ...            # optional
      false_positive_context: ...      # optional
      controls: [CTL-012, CTL-044]     # controls used for this indicator in this typology
```

## Rules (enforced by `tools/validate.py`)
- All `ref`s and control ids resolve; an indicator is linked at most once per typology.
- Every link has at least one preventive or detective control; high-severity links should have at least two distinct controls.
- Indicators are red flags, not proof of crime. Canonical indicators include `false_positive_notes`.
- No real persons, institutions or case details. Cite published sources only; do not fabricate citations. Original wording only.
- Orphans (unlinked controls or indicators) and near-duplicate names produce warnings; `--strict` fails on warnings.

## Exposure (typology level) and provenance (indicator level)
```yaml
typology:
  exposure:
    channels: [mobile_app, online_banking]          # values from vocab.yaml
    payment_rails: [fast_payments]
    customer_segments: [retail, student_youth]
    products: [transaction_account]
    basis: ai_inferred                              # AI-inferred; not reviewed
    rationale: one line on why
```
Exposure describes where a typology typically shows up. It is NOT an institution's assessed exposure. Empty lists are valid (cross-cutting typologies apply across all).
Indicators inherit exposure from the typologies that link them (derived, not stored).

Indicator provenance (all currently `draft` / `ai_drafted`):
```yaml
    status: draft                 # draft | sme_reviewed | validated
    provenance: ai_drafted        # ai_drafted | human_authored | mixed
    evidence_basis: ai_draft_unreviewed   # published_guidance | regulator_typology | case_study | practitioner_judgement | ai_draft_unreviewed
    confidence: unassessed        # low | medium | high | unassessed
    last_reviewed: 2026-11-22     # add when a human reviews it
```
Controlled vocabularies live in `vocab.yaml`; extend there. `severity` means indicative signal strength only.

## Evidence and review fields (v0.3, additive, optional)
Indicators added by the research agent (see [docs/architecture.md](docs/architecture.md)) also carry:
```yaml
    evidence_basis: regulator_typology
    confidence: unassessed            # human confidence; set by a reviewer
    taxonomy_nodes: [fraud/FR-RECOV]  # domain/typology ids that link this indicator
    evidence:
      - source_id: SRC-FINCEN         # sources/registry.yaml
        authority: FinCEN (US Treasury)
        source_type: fiu              # fiu | regulator | standard_setter | law_enforcement | sanctions_authority | government | intergovernmental | industry_body | fiu_network
        publication: <title>
        url: <link>
        published: 2026-09-03         # YYYY-MM-DD or YYYY-MM as printed
        retrieved: 2026-11-27
        snapshot: {sha256: <hash>, of: pdf_bytes}   # pdf_bytes | extracted_text
        excerpt: short verbatim quote
        extraction_confidence: high   # AI extraction confidence, not an SME judgement
    review:
      state: unreviewed               # unreviewed | maker_review | checker_review | approved | rejected
      workflow: maker_checker_pending
      maker: null
      checker: null
      decided: null
    added_in: 2026-11-27-scan
```
Typology links added by the agent carry `references:` with `[agent-retrieved YYYY-MM-DD]` tags. Existing entries are unchanged; the validator ignores these extra fields.

## Generated views
`python3 tools/build_index.py .` writes `build/`: flat typology-indicator-control CSV, control and indicator usage, typology x control matrix, and `REVERSE_INDEX.md` (most reused controls and indicators).
