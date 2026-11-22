# Human review queue

Borderline merges made by AI clustering. Each typology link keeps its `legacy_id` (v0.1 id), so any merge can be split out. Reviewers should be independent of the drafting process.

## Indicator merges to confirm
- **Behavioural:** FR-APP-003 into "unable to explain purpose" cluster; ML-MULE-004 / HT-TRAFFICK-006 with FR-VULN-002 (coached or accompanied); HT-FORCEDLAB-002 and CY-GIGPLAT-005 into third-party-controlled account; CY-NEOBANK-006 into remote access; ML-HVG-004 with ML-REALESTATE-004; ML-MULE-002 with ML-SHELL-008; OP-CYBERPROC-005 with CY-ATOMULE-001.
- **Transaction:** CY-NEOBANK-003 and CY-PREPAID-002 into many-unrelated-senders; ML-REALESTATE-005 into high-value cash purchases; TF-HAWALA-003 and OP-DRUGS-001 into split cash deposits; CY-UNHOSTED-006 into cash-then-onward; TF-NPO-004 and ML-NPO-003 into pass-through; PF-CORRESP-007 into sudden volume; CY-GIGPLAT-008 with CY-PREPAID-001; informal cash-supplier cluster (EC-LOGGING-004, EC-MINING-003, EC-WASTE-005, EC-WILDLIFE-006).
- **Customer / ownership:** CY-SYNTHID-008 into shared contact details; ML-MULE-003 into profile mismatch; HT-TRAFFICK-008 into revenue vs staffing; ML-MULE-009 into multiple identities; EC-FISHING-004 into layered structures; PF-CORRESP-004 and ML-CASHBIZ-006 into "BO cannot be identified"; OP-DRUGS-009 into new entity with large flows; PF-MARITIME-004 into short-lived entities.
- **Counterparty / geographic:** XC-TXN-BEHAVIOUR-011 into adverse media; ML-CASHBIZ-005 and ML-GATEKEEPER-002 into third-party payments; CY-UNHOSTED-008 and ML-CORRBANK-002 into high-risk jurisdiction; CY-PAYFAC-007 into unrelated-jurisdiction; delivery-to-forwarder cluster; BC-KICKBACK-007 with FR-INSD-007; OP-GAMBLE-001 with unlicensed-operator cluster.
- **Document / product / typology-specific:** ML-TBML-002 and PF-TRADEFIN-004 in trade-document inconsistency; OP-COUNTER-001 with OP-TOBACCO-005; TF-EXTORT-007 with TF-NPO-007; five-way mixer cluster (CY-DARKNET-004, CY-RANSOM-005, CY-NFTGAME-008, CY-MIXER-004, CY-DEFI-008).

## Control merges to confirm
- "Customer enquiry" (about 14 explain/justify/purpose variants) and "Profile-versus-activity deviation" (about 40 variants) are broad merges.
- "Typology-based scenario design" absorbed about 15 near-synonym groups, including one-off rules (straw purchase, gift card, youth account).
- "Product-specific misuse surveillance" bundles insurance, securities, safe-deposit and prepaid mechanisms; "Sector-tailored EDD" absorbs NPO, MSB, dealer, waste and sports EDD. Consider splitting.
- Family `corrective_response` has a single control; consider folding into `investigation_reporting`.

## Control gaps (no suitable catalogue control)
- IND-BEH-029 (weak AML governance): no independent programme-effectiveness testing control.
- IND-BEH-030 (alert backlog): no alert-queue ageing and capacity-forecasting control.
- Institutional-governance indicators lean on CTL-175 (sampling QA) as the only detective option.

- No control for order-book / spoofing surveillance (OP-MKTABUSE).
- No control for licensing or change-in-control fit-and-proper review (XC-COMPLICITFI).
- No control for court-record and legal-dispute verification (ML-SHAMLEGAL).
- No control for safe-deposit-box access logging (ML-FREEPORT) or transfer-pricing / arm's-length benchmarking (TX-TRANSFERPRICE).
- No control for cross-border real-time freeze or recall coordination between institutions (FR-XBMULE); closest are CTL-103 and CTL-107.
- No control for scam-compound infrastructure or telecoms-spend monitoring (FR-SCOMP); closest are CTL-042 and CTL-053.
- No control for unified fraud and AML risk view across silos (themes from FATF fraud-priority commentary, unconfirmed).
- Controls linked as "closest fit" for the above are approximate; refine when new controls are added.

## Added in this release (AI-drafted, unreviewed, sources unverified)
FR-SCOMP, FR-XBMULE, OP-MKTABUSE, XC-COMPLICITFI, ML-SHAMLEGAL, ML-SPORTS, ML-FREEPORT, ML-PENSION, TX-TRANSFERPRICE. Source: coverage gaps from the reference review and approved by the maintainer.

## Data quality
- Singleton indicators kept original wording and some generic default `detection_type` / `data_sources` / `false_positive_notes`.
- All citations are unverified (see README).
