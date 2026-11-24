# Product questionnaire -> typology linkage

Purpose: help a user work out which typologies are *relevant* to a product by answering questions they would ask in a
product risk assessment. It is an applicability aid, not a risk assessment: no scores, no ratings, no worst-of.
The institution decides applicability, inherent risk, control effectiveness and residual risk in its own process.

## Design: link through exposure tags, not product x typology rows
Each answer option maps to values from `vocab.yaml` (channels, payment_rails, customer_segments, products).
Each typology already carries an `exposure` block using the same vocabularies. A product profile is the union of the
tags implied by the selected answers; typologies are matched by overlap. This keeps the maintained mapping small
(answer option -> tags) and avoids thousands of product x typology links.

## File: questionnaire/questions.yaml
```yaml
version: 1
sections:                      # ordered; used to group questions
  - id: product_basics
    title: Product basics
questions:
  - id: Q01
    section: product_basics
    text: What type of product is this?            # plain language, as asked in a product risk assessment
    help: Why this is asked / how to answer.
    type: single                                   # single | multi
    options:
      - id: Q01-A
        label: Everyday transaction account
        maps_to:                                   # any subset of the four dimensions; values must exist in vocab.yaml
          products: [transaction_account]
          channels: []
          payment_rails: []
          customer_segments: []
        note: Why these tags follow from this answer (one line).
      - id: Q01-Z
        label: Not sure / not applicable
        maps_to: {}                                # maps to nothing
```

## Matching rules (applied in the site, client side; nothing leaves the browser)
1. Profile = per-dimension union of `maps_to` across all selected options.
2. A typology matches a dimension if its exposure list shares at least one value with the profile for that dimension.
3. Typologies with domain `cross_cutting` or an empty exposure block are shown separately as "applies across all products".
4. Results are grouped/sorted by how many dimensions match and show *which tags matched*; no number is presented as a risk
   score. The user can include/exclude any typology manually, and export the result.
5. From any matched typology the user continues into the linkage view: typology -> indicators -> controls.
