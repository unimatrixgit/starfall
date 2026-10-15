# SF-094 — Universal Bank fee reconciliation

Read-only audit of production generation 24. All table pages were read without truncation. Bank round revisions and balances were unchanged between the opening and closing snapshots. No trades or balance changes were performed by this audit.

| Received resource | Alliance Fund fees | Galaxy Fund fees | Sum of receipts | Recorded bank tax | Difference |
| --- | ---: | ---: | ---: | ---: | ---: |
| Metal | 3,750 | 100 | 3,850 | 3,850 | 0 |
| Crystal | 2,500 | 120 | 2,620 | 2,620 | 0 |
| Eonium | 2,500 | 0 | 2,500 | 2,500 | 0 |

The nine receipts comprise four personal Alliance Fund exchanges at 2.5%, four Galaxy Fund exchanges at 1%, and one older direct bank exchange with zero fee. Each fee is recorded in the resource received by the trader.

The older direct bank exchange was recorded at 2026-10-15 01:40:27.982 UTC, before the 5% default-fee release at 02:06:42 UTC. The current bank setting is 5%, but no newer direct bank trade was available to verify that rate against a live receipt. Automated settlement tests cover the configured 5% path; this audit did not create a production trade.

Current reserves also reconcile exactly from the receipts and the one-million starting reserve of each resource: metal 1,003,850; crystal 902,620; eonium 1,102,500. Their net changes are +3,850, −97,380 and +102,500 respectively. Historical stored generations 20–23 each have zero fees and no trade receipts, consistent with their unchanged reserves.

Machine-readable calculations and individual anonymous transaction amounts are in `SF094-UNIVERSAL-BANK-FEE-AUDIT.json`. This is a point-in-time reconciliation, not continuous monitoring.
