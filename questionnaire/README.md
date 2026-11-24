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

---
# v2: consumer-bank scope (product first, channel second)

Scope is a consumer bank: 7 products and 4 channels (see `consumer_scope` in `vocab.yaml`):
everyday account, savings account, term deposit, credit card, personal loan, home loan (fixed), home loan (variable) x
mobile app, internet banking, phone banking, retail network.

## Typology data used
Each typology has `exposure.consumer` = `{relevant: bool, products: [..], channels: [..], basis: ai_inferred, rationale}`.
Empty `products`/`channels` on a relevant typology means "applies across all" (cross-cutting typologies).
The general exposure lists (`rails` -> `payment_rails`, `customer_segments`) are used to refine the match.

## File: questionnaire/questions_v2.yaml
Same shape as v1 plus: `version: 2`, `scope: consumer`, per-question `applies_to_products: [product ids]` (omit = all 7).
- Q01 (single): which product is being assessed -> `maps_to.products: [<product id>]` (exactly one of the 7 consumer product ids).
- Q02 (multi): which channels the product is available/serviced through -> `maps_to.channels` (subset of the 4 consumer channel ids).
- All other questions map ONLY to `payment_rails` and `customer_segments` values from `vocab.yaml` (never products/channels).
  Questions may be channel-specific using `applies_to_channels: [..]` (omit = all).

## Matching rules v2 (client side)
1. Base set: consumer-relevant typologies whose `consumer.products` include the product AND whose `consumer.channels`
   include at least one selected channel. Typologies with empty consumer products/channels ("applies across all") are listed
   separately, not mixed into the ranking.
2. Refinement tiers by extra overlap with answers: Strong = overlaps on BOTH payment rails and customer segments; Possible =
   one of them; Base = product and channel only. Tiers describe specificity of fit, never risk. No scores.
3. Show matched tags and the answers that implied them. User can include/exclude typologies, export a product pack, and
   continue to the linkage view (typology -> indicators -> controls).
4. A product x channel grid view lists, for each of the 7 products x 4 channels, the typology count and opens the list.
