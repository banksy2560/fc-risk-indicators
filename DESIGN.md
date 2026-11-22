# Design Principles

This library is deliberately **not** a risk register, an RCSA, or a competing risk-assessment methodology. It is a reusable *input* that an institution's own ML/TF/fraud risk assessment consumes.

| Challenge | Design response |
|---|---|
| "It isn't new: inherent → controls → residual is standard." | We do not score residual risk. The library supplies what is usually missing: a shared, citable catalogue of observable indicators and candidate controls. Scoring stays with the adopting institution's methodology. |
| "Product is the wrong unit." | **Typology is the unit of analysis.** Each typology carries an `exposure` block (channels, payment rails, customer segments, products as one dimension among four). A typology is owned once, not duplicated across product canvases. |
| "The mapping explodes and goes stale." | No many-to-many product × typology × control matrix is stored. Mappings are *derived* by `tools/build_index.py` from typology-level exposure tags. Each indicator carries `last_reviewed` and `evidence_basis`; `validate.py` flags staleness. Owners are assigned by adopters, not by the library. |
| "H/M/L looks precise but is judgement; back-testing is circular." | `severity` is documented as *indicative signal strength*, never a risk rating. Each indicator states `evidence_basis` and `confidence`. Do not calibrate against your own SAR/loss data alone: detection bias makes heavily monitored areas look riskier. |
| "Worst-of scoring rates everything High." | The library prescribes no aggregation rule. Prioritisation should use typology exposure, control coverage and loss/detection data from the adopter, not max-severity roll-ups. |
| "Intelligence won't convert easily; agent output brings model risk." | Every indicator is `status: draft` until a named human SME reviews it. AI-drafted content is labelled (`provenance`). Reviewers must be independent of whoever generated the content. |
| "Writing down known unremediated gaps creates legal exposure." | The library contains candidate controls and *no* assessments of any institution. Gap assessments are produced in the adopter's own environment under their own privilege and governance. |
| "Competes with Group methodology." | Positioned as an input to the institution-wide ML/TF risk assessment and aligned to FATF risk-based-approach factors. |
| "Event-driven refresh is a promise you can't keep." | We promise only versioned releases with a changelog, and a review-date field. No continuous-update claim. |
| "The ask is empty / pilot proves little." | Success test for any adopter pilot: at least one control gap or coverage blind spot found that the incumbent method missed. Track and publish that outcome. |
