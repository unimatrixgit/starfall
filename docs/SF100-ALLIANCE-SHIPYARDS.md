# SF-100 Alliance Shipyards

Integrated with the existing fourth fleet and Launch Bay. Cumulative delivery/removal counters apply once; combat losses are acknowledged without subtracting twice. Personal and grouped transfer paths preserve the Alliance Ships subset. Local launches use the same server command queue as remote launches to fence concurrent sale. Six provenance regressions and the actual local browser order/delivery flow pass. No production gameplay was mutated during verification.

## Files and verification

- `shipyards-catalog.js`: server catalogue generated from the actual current `dist/ship-catalog.js`, including hull identity, class, race and the same resource prices. It does not use a second price list or invent a new race roster.
- `alliance-shipyards.js`: backend handler and deterministic production/provenance helpers.
- `drizzle/0038_alliance_shipyards.sql`: schema-only new board/command tables, plus schema bootstrap for the existing Launch Bay tables. 
- `tests/alliance-shipyards.test.cjs`: actual transactional SQLite tests; run `node --test tests/alliance-shipyards.test.cjs` from the source repository.

At drafting: **11 tests pass**. They cover race access, rank access, combined factories, prepaid funds, idempotency/conflicting IDs, real delivery, permanent loss, generation/revision rejection, SQL rollback, reset destination escrow, vendor prices/delay, personal-ship rejection, deployed-fleet rejection, readiness CAS races, cancelled-sale return, bounded catch-up and changed factory pools.

## Integration contract

Compose the catalogue then module after existing portal/alliance helpers. Route `/api/alliance-shipyards` to `allianceShipyardsAPI(request, env)` using the same existing auth/session plumbing and JSON error boundary. No runtime DDL is present. Include the schema in the correct `dist/.openai/drizzle` package before deploying its code.

`GET /api/alliance-shipyards` requires actual current Owner/HC/Officer membership. Returns:

```
{
  generation, revision, directoryRevision, allianceId, allianceName,
  canManage, fund, clock,
  factories: {count: {lightFactory,mediumFactory,heavyFactory}, rates, fingerprint},
  catalog: [{id,race,name,class,factory,pod,cost}],
  members: [{id,name,race,resetEpoch}],
  orders, sales, inventory, lastTick, skippedTicks
}
```

The catalogue includes a hull only if a current member of its race has the corresponding real hull research; pod hulls also require Cargo I. This prevents manufacture of research-locked hulls. All current alliance members contribute matching factories, regardless of the destination member's race. A destination member's existing fourth fleet may receive mixed races; it does not create another fleet.

`GET /api/alliance-shipyards?mine=1` is available to an actual member, including ordinary members, and exposes only their current ownership/planet-reset-epoch provenance record, plus generation/revision metadata. It is the integration point for the player client's background delivery/removal synchronization.

All POSTs require same origin and a stable command ID. Common fields:

```
{id, action, generation, revision, directoryRevision}
```

Commands:

- `order`: `items: [{shipId,quantity,planetId}]`. The matrix UI can send up to 200 distinct member/hull allocations. Quantities are 1–20,000 each. Maximum queue is the same as existing personal ship production: one active plus one waiting order. Costs come exclusively from canonical Alliance Fund reserves and obey configured alliance minimums. No personal resources or personal world discounts apply.
- `cancelOrder`: `orderId`. Cancels only active/queued orders, refunds 50% of actual paid cost once, matching current personal ship production cancellation.
- `sell`: `items` with the same identity/quantity fields. Only existing Alliance Ships provenance is eligible, with fresh docked f4 readiness. Personal f4 ships cannot be claimed as Alliance Ships. Sale removes provenance immediately and pays canonical Alliance Fund after 12 existing game ticks. Price is exactly the current Ship Seller rule, `floor(catalogResourceCost * quantity * 0.5)` per resource.
- `cancelSale`: `saleId`. No proceeds; returns the same hull allocation after a new 12-tick journey, matching the existing Ship Seller rule.
- `loss`: `items`. This is the only action permitted to ordinary members. The authenticated owning account can acknowledge only its own Alliance Ships losses, never another member's. Losses permanently reduce available provenance and increment removal totals; they cannot generate or restore ships. Root's combat integration must submit these acknowledgements after actual local combat losses.

The normal command response is `{ok,id,action,revision,fund}`. A retry of the same semantic action with the same ID returns `duplicate:true`, current revision/fund, and never repeats the economic action. Refreshed quote revisions and JSON key order do not make the same semantic retry a second order. Conflicting actions/quantities/targets, another account, another alliance or another generation cannot reuse a command ID.

## Existing f4 + provenance: required client/server bridges before shipping

The new inventory is an ownership ledger, **not a new fleet**. Only the existing `state.fleets.f4` / existing Launch Bay may hold the physical ships.

An inventory record is scoped by `planetId + ownerId + resetEpoch` and contains:

```
{planetId,ownerId,resetEpoch,available,deliveryTotals,removalTotals}
```

Counters are monotonic. The root client must persist its last applied delivery/removal counters for this exact alliance/generation/owner/planet/epoch. Apply **only differences**. Never assign `available` or cumulative deliveries directly as f4's current quantity: that would resurrect prior combat losses on every refresh. A cancelled vendor sale increments delivery totals on its real return, while its original removal total remains permanently recorded.

Root must integrate all of the following before enabling this page:

1. Deliver new hull deltas only to the selected current member's existing f4. Do not add a fifth fleet or a separate ready fleet.
2. Track the `Alliance Ships` subset inside both docked f4 and deployed f4 missions. Disallow exporting that subset to Base or personal fleets through every normal/group/all transfer path. Existing personal f4 ships remain distinguishable.
3. Prevent the personal Ship Seller from consuming this subset. Alliance sale orders use the dedicated officer endpoint and credit only Alliance Fund.
4. Integrate cumulative removal deltas with sale, return and deployed mission state. Combat loss acknowledgement must mark its counter as already applied locally when the combat has already removed the physical hulls, avoiding a double debit on the next GET.
5. Reconcile these counters before executing existing Launch Bay commands and before publishing readiness. Include the latest board revision as `shipyardRevision` on readiness snapshots; the server fences snapshot writes and launch commands against this exact revision, including board creation races. Sale CAS fences current readiness bytes/timestamp and pending launch commands; existing Launch Bay command handling must not launch stale pre-sale physical counts.
6. Keep canonical Alliance Fund protected from browser directory overwrite. The module sets the existing `fundSettlementVersion` marker on prepaid production and uses the same global directory CAS as bank/fund operations.
7. Do not allow staff full-directory replacement, legacy raw JSON import or personal reset to forge provenance. This ledger is not accepted from `/api/colony` or fleet snapshots. New generation and new planet reset epoch always get independent inventory identities.

These bridges are owned by the client integration. Backend presence alone does not make SF-100 complete; the bridges must be tested as part of the composed game.

## Progression and conservative clock limitations

Production uses the **maximum existing reported public tick among current members**. This is an observed tick from the existing practice game, never invented wall-clock game time. An offline peer or lower-tick new member does not stall every other member. Reported tick/factory trust retains the existing client-authoritative practice model.

An unchanged factory-pool fingerprint can catch up at most 24 previously reported ticks per GET, persisting `lastTick` each time. Further GETs may consume the rest of the same existing tick gap, never future ticks. If the pool changes, only the newest observed tick uses that new pool; missing prior ticks are counted in `skippedTicks` instead of retroactively applying new factories.

Production work follows the existing formula: `sqrt(paidResources) * ln(paidResources²) + 10000 * matchingCombinedFactories` per active factory class. Throughput follows `(4000 * combinedFactories)^0.98`, with a factory-count-weighted average of canonically reported Shipwright and race production bonuses. Government bonuses are deliberately excluded because ordinary government changes are not canonically reported. There is no new alliance discount. New matching factories add the same 10,000 preparation units per additional factory as personal production. A factory removal does not refund preparation work. Government and personal world discounts are not borrowed from a single alliance member.

Current client-reported research/factories/ticks/readiness retain the existing practice game's trust model. This module does not turn browser combat into an independently simulated anti-cheat server. It does enforce canonical fund payment, bounded provenance creation/removal, rank/account/generation fencing, race research gates and transaction idempotency.

A recipient leaving the alliance, changing owner or resetting before delivery puts the paid finished order into **Escrow**. It never follows a stale owner or silently recreates destroyed/reset ships. This draft has no reassignment UI/action yet; root should add an explicitly authorized command to allocate escrow hulls if required, without producing them again or refunding and delivering simultaneously.
