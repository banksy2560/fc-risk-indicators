# Indicator Schema (v0.1)

Each typology is one YAML file in `typologies/<domain>/<typology-id>.yaml`.

```yaml
typology:
  id: ML-TBML                       # DOMAIN-SHORTNAME, unique
  name: Trade-Based Money Laundering
  domain: money_laundering          # money_laundering | terrorist_financing | proliferation_financing | sanctions | fraud | bribery_corruption | tax_evasion | human_trafficking_modern_slavery | environmental_crime | cyber_enabled | other_predicate | cross_cutting
  description: >                    # 2-4 sentences, plain language
  stage: [placement, layering]      # ML only; optional otherwise
  sectors: [banking, trade_finance] # banking | payments | crypto | insurance | securities | casino_gaming | dnfbp | real_estate | mvts | fintech | trade_finance | corporate_services | art_luxury | all
  sources:                          # real, citable references (FATF reports, FinCEN advisories, Egmont, Wolfsberg, JMLSG, AUSTRAC, FCA, etc.)
    - "FATF, Trade-Based Money Laundering: Trends and Developments (2020)"
  indicators:
    - id: ML-TBML-001               # typology id + 3-digit sequence
      name: Invoice value inconsistent with market price
      description: What is observed, in one or two sentences.
      category: transaction         # customer | transaction | geographic | product_channel | behavioural | ownership_structure | document | counterparty | typology_specific
      severity: high                # low | medium | high (inherent signal strength, not customer risk)
      detection_type: [transaction_monitoring, kyc_review]  # transaction_monitoring | kyc_review | screening | customer_behaviour | document_review | investigator_judgement | external_intel
      data_sources: [trade_documents, price_databases]
      false_positive_notes: Legitimate reasons the indicator may fire.
      controls:
        - id: ML-TBML-001-C1
          name: Trade price benchmarking
          type: detective           # preventive | detective | corrective | governance
          description: What the control is and how it mitigates the indicator.
          implementation: rule | model | process | policy | training | technology
          effectiveness: medium     # low | medium | high (typical, indicative)
      references: ["FATF TBML 2020, Annex"]
```

Rules
- Indicators are red flags, not proof of crime; always include `false_positive_notes`.
- Every indicator needs at least one preventive or detective control; high-severity ones need at least two.
- No real persons, institutions or case details. Cite published sources only; do not fabricate citations. If unsure of an exact title/year, cite the issuing body and topic generally.
- Write original wording; do not copy source text.

## v0.2 additions (optional now, required before v1.0). See DESIGN.md.

Typology level:
```yaml
  exposure:                         # typology is the unit; these are dimensions, not owners
    channels: [mobile_app, online_banking, branch, atm, call_centre, broker_intermediary, api_open_banking]
    payment_rails: [fast_payments, card, cash, wire_swift, cheque, direct_debit, crypto_onramp, cross_border_remittance, trade_instruments]
    customer_segments: [retail, student, new_to_bank, sme, corporate, private_banking, non_resident, vulnerable]
    products: [transaction_account, savings, credit_card, loan_mortgage, trade_finance, investment_insurance, prepaid_stored_value, safe_deposit]
  owner_role_suggestion: "Head of Financial Crime Risk"   # suggestion only; adopters assign owners
```
Indicator level:
```yaml
      evidence_basis: published_guidance   # published_guidance | regulator_typology | case_study | practitioner_judgement | ai_draft_unreviewed
      confidence: medium                   # low | medium | high (in the indicator's discriminating power)
      last_reviewed: 2026-11-22
      status: draft                        # draft | sme_reviewed | validated
      provenance: ai_drafted               # ai_drafted | human_authored | mixed
```
`severity` means indicative signal strength only; it is not a risk rating and must not be aggregated worst-of.
