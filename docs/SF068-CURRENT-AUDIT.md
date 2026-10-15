# SF-068 current audit — v0.125.1

## Resumed simulation pass — 2026-10-15, source v0.126.5

The ten original offline reproductions were rerun against current canonical source: zero of those ten defects were observed. This does not close the separate shared-workflow findings below.

A new real-Worker/in-memory-SQLite integration case runs 240 full-housing ticks in ten batches of 24, with zero Biodomes and zero ordinary levy. After every batch it verifies cumulative fractional growth conversion, the exact 6 Metal / 4 Crystal / 2 Eonium per converted unit, unchanged residents, persisted tick, and a duplicate submission with no additional fund credit. The fixture explicitly marks galaxy distribution complete so the independent tick-12 shuffle does not move the test planet to a different treasury. Existing three-tick, invalid-input and failed-settlement retry cases also pass.

No production gameplay, deployment, reset, trade or fleet movement was performed. Havoc's prior five-race browser apply/restore evidence remains in SF119-HAVOC-RESULTS.json; this pass reruns its existing regression coverage rather than claiming a new live Havoc exercise. SOC01 delayed alliance donations and SOC02 shared exile voting remain open, as do broader concurrent-session and long-content coverage. Full-audit completion is not established.

Read-only audit of canonical source against the shipped player manual. Offline isolated reproductions use fake DOM and in-memory saves. No live scans, spending, government changes, resets or fleet movements were performed. This report records defects; it does not claim they have been fixed.

## Reconfirmed functional findings

| Priority | Finding | Evidence |
|---|---|---|
| P0 | SF068-E01: rendering an active construction project changes its remaining/total work from250/250 to0/0 | Actual canonical constructionHTML in isolated game harness |
| P1 | SF068-E02: bonus CU builds beyond reserved capacity:20completed plus1pending at limit20 | Actual allocateQuestBonus with250CU |
| P1 | SF068-E03: medium/heavy factory and defence warrants remain locked with completed HullsIII | Actual bonusBuildingAvailable uses obsolete research branches |
| P1 | SF068-M01: galaxy sweep accepts Landing and Incoming with no eligible fleets | Actual sweep generates both reports and requests a36,000-per-resource aggregate charge; payment is intercepted in the isolated harness |
| P1 | SF068-M02: Jumpgate report presents99 docked Lumen as travelling composition when no missions exist | Actual scanData |
| P1 | SF068-M03: Incoming report replaces composition with zero, ignoring known incoming counts | Actual scanData; supplied17known Lumen are not reported |
| P2 | SF068-M04: newly generated report fields use literal backslash-n, not line breaks | Actual Planet Scan output |
| P2 | SF068-M05: Planet Scan omits promised guards even with known77 | Actual Planet Scan output |
| P1 | SF068-SOC03: opening an exile vote takes100metal from Alliance Fund, leaving Galaxy Fund unchanged | Actual politicsAction; Alliance1000→900, Galaxy5000→5000 |
| P2 | SF068-SOC05: ordinary player changes their local donation-resource policy despite minister-only wording | Actual politicsAction; this is not a demonstrated central privilege escalation |

Machine-readable observations are in SF068-CURRENT-OBSERVATIONS.json. Re-run with node scripts/audit-game-manual.cjs. Every observation is independent of a production account.

## Shared workflows: current source findings

- **SOC-01 partly mitigated, still open for donations.** Personal Alliance Fund exchange and officer reserve exchange now use central atomic endpoints and are no longer the old browser-only exchange defect. Legacy delayed donations are explicitly blocked once fundSettlementVersion is set, avoiding silent personal loss. A working central delayed-donation path is still missing; unmarked legacy alliances retain the old local path. Do not reopen the resolved exchange defect as a duplicate.
- **SOC-02 open.** Exile proposals and approvals remain browser-local. The central politics endpoint has no corresponding proposal/approval operation, so two actual ministers cannot complete a shared vote.
- **SOC-04 open.** Galaxy banner/message save remains local. The central action handler does not accept or return shared banner/message state.
- **SOC-05 open server policy.** Central deposits do not enforce the local allowedFund controls. The reproducible local role gap above is separate from the absent shared restriction.
- **SOC-06 open.** Staff structure workspace still hardcodes slots11–15, whereas the active1:1 stronghold policy reserves fresh structure slots16–20. Preserve protected ghost slots and retained legacy structures when correcting the UI.

## Manual and field guide drift

The in-game field guide still describes two construction slots, mandatory100% workforce assignment, completed ships going only to Base, and seven simulated neighbours. Current authorised rules provide four construction/research slots, optional unused workforce capacity, selectable destinations and registered planets. The manual attack-tool chapter still calls implemented Battlegroups upcoming and describes worksheet keyboard/paste controls that do not match the replacement per-fleet calculator UI. These are documentation mismatches, not reasons to revert authorised newer behaviour.

## Coverage and next order

| Area | Current evidence | Remaining audit work |
|---|---|---|
| Construction, rewards, research gates | Three actual reproductions above | Reproduce remaining bonus allocations and cancellation combinations |
| Scans and report generation | Five actual reproductions above | Review every scan eligibility/charge/source and historical rendering path |
| Galaxy governance | Wrong-fund and local role reproductions; shared endpoint inspection | Isolated two-account proposal/message/deposit-policy integration cases |
| Alliance economy | New bank/exchange tests and SF094 read-only live reconciliation already available | Delayed donations and central structure spending remain open |
| Fleet/Shipyards | v0.125.0 transactional tests and actual local order→delivery→sale→launch passed | Review combat, recall, departure/reset and stale readiness combinations beyond existing tests |
| Population | v0.125.1 client/server ecology parity, fractional growth and local real Worker surplus passed | Longer mixed ordinary/overflow levy windows across resets and changed ecology |
| Forums, Battlegroups, personal reset, permissions | Existing bounded tests/source review; no new isolation finding established | Broader two-account interaction matrix; no certification of every path |
| Remaining manual sections | Existing source review and regressions are useful evidence | Tick recovery, covert effects, Miday, ownership recovery and support flows need a fresh complete pass |

Remediation order: construction work corruption first; then bonus capacity/gates; then scan eligibility/report correctness as one group; then central governance/fund operations as one group. Keep all findings under SF-068 and retain their sub-IDs. Passing529existing regression tests did not cover the defects above and is not a substitute for the manual audit.

SF-068 remains in progress. No production source was changed in this audit pass.

## Added layout scope and first pass

The user explicitly added table/text frame fitting to the audit. SF068-LAYOUT-AUDIT.md records144isolated browser cases and separates one confirmed shared decorative overflow from medium-width population clipping candidates requiring visual confirmation. Long-content stress and additional themes remain open.

## v0.126.0 remediation

SF068-E01 is fixed: construction rendering uses constructionRate and preserves active/queued order work. SF068-E02 and E03 are fixed under SF-115: bonus construction reserves pending slots and matches ordinary building eligibility without obsolete research gates. Dedicated allocation/render regressions verify these paths. Other findings remain open; the full audit is not complete.

## v0.126.1 remediation

M01–M05 have dedicated regression coverage for actual eligible billing, fleet selection/composition, known/unknown guards and new/historical line breaks. SOC03 now charges the practice Galaxy Fund. SOC04 galaxy name/message and SOC05 Development Minister donation policy persist centrally and enforce current roles at the API; two-account regressions verify sharing and denied writes. SOC06 staff slots follow canonical active-claim policy. L01 decoration no longer extends the page; L02 wrapping and compact contribution control geometry were repaired. Full shared exile voting (SOC02) and delayed alliance donations (SOC01) remain open. This is a partial remediation, not audit completion.

## v0.126.2 regression pass
565 tests passed. Havoc real-browser fixture verified central apply and restore across five race fixtures. Owner research/building mirrors and legacy alliance registry identity were repaired. Twenty-five pages rendered without browser exceptions; five widths had no document overflow. SF-119 results and SF-120 diplomacy coverage are recorded separately. The multi-account/delayed-donation/exile audit remains open.
