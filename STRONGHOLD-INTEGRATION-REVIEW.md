# SF-049 / G011 — isolated integration patch (DUNE-014)

Base: `a33136f55ff4ce06ad93f9768578b08c42ebce49`. Prepared in a detached isolated checkout. No Starfall branch pushed, no deployment and no reset. Review before cherry-picking/applying; coordinate migration number 0032 with concurrent work.

## Included

- `worker/stronghold-policy.js`: framework-free domain policy, adapted from Dune contribution da7d21e to the current concatenated Worker format.
- `worker/strongholds.js` and additive migration `0032_stronghold_claims.sql`: round-generation state, unique live galaxy/alliance claim indexes, operation replay records and audit. The directory revision is the shared compare-and-swap clock. Every dependent write is fenced by a server operation token in the same atomic DB batch. Snapshot predicates also detect alliance permission changes from legacy writers that fail to bump revision.
- `/api/strongholds` GET returns claim status/asset counts and server-derived management capabilities. POST requires same origin, generation, revision and unique operationId. Context comes from the signed-in account, owned planet, stored alliance roster and fortress permission; client permission flags are ignored.
- Actions: `claim`, `move` (empty claim only, atomic release+new claim), `release`, `offerTransfer`, `transfer`, `dispute`, `resolve`. Admin override requires `staffOverride:true` plus a nonempty reason. Conflict adjudication requires that explicit staff authority.
- Stable alliance IDs use the registry first, then existing stored ID; missing legacy identity derives deterministically and is persisted with the first accepted operation. Legacy overlapping claims become disputed, preserving assets. Inactive/disputed reservations continue to block new claims.
- Transfer is two-step: source leadership records an offer; target leadership accepts the matching current-revision offer. Source leadership authority is rechecked on acceptance. An admin can explicitly adjudicate an empty transfer. Existing-assets transfer is deliberately blocked rather than guessing ownership/cost migration.
- Asset inventory includes accepted alliance active structures, construction queue and global structure directory rows. Release/conflict resolution refuses to discard competing assets. Index uniqueness failure rolls the whole batch back, including state, registry, alliance and audit writes.
- Directory GET projects canonical claim status and clears the effective fortress location for disputed/released claims. Directory POST cannot change the claim or stored alliance identity. Existing authorised staff structure editing remains possible only under an active server claim in the owning galaxy, with aligned global slots and alliance reservations. Reserved/disputed/foreign claims cannot be bypassed via this old route. Non-claim fields continue through the existing flow.
- `setFortress` uses the API for central players, shows reserved/disputed errors and never changes local ownership optimistically. Empty relocation is confirmed and remains subject to anarchy; member planets and alliance membership are never moved. Browser local resident benefits require an active projected claim. Existing browser-only practice mode keeps its legacy behaviour.
- Build wiring and both hand-assembled Worker test harnesses updated. Generated Worker/runtime outputs must be rebuilt; they are intentionally not included as authored patch changes.

## API example

Read `/api/strongholds` first. Submit POST as the authenticated session, with same-origin credentials:

```json
{"action":"claim","allianceId":"server-returned-id","galaxy":"07:04","generation":23,"revision":123,"operationId":"unique-client-operation-id"}
```

For release/move/offerTransfer/transfer use claimId; move adds galaxy; transfer actions add targetAllianceId. For dispute supply claimIds and reason; for resolve supply winnerClaimId and winnerStatus (`active` or `inactive`), with explicit admin override and reason. Preserve the exact request body for an identical retry. Reusing an operation ID with a changed body/account is rejected. Offers expire conservatively when the shared directory revision changes.

## Validation

- Full suite: `node --test tests/*.test.cjs` — 234 passing (223 baseline + 11 integration tests).
- Tests cover trusted rights/origin, replay and forged payloads, exclusive claims, no resource grant or membership changes, stale CAS with no dependent writes, two-party transfer, preserved disputed assets, direct directory bypass, valid structure editing, reset-generation isolation, optimistic concurrent claims, empty relocation, permission revocation without revision bump, and rollback on forced unique-index failure.
- Production build: `node scripts/build-worker.cjs`; link/diagnostic audit: 100 pages, zero findings. No live D1/browser/deployment tests claimed. SQLite test adapter serialises atomic batches to model the D1 batch contract; verify on the actual preview backend before publishing.
- Rebuild is required after applying: runtime bundlers read authored dist JS. No generated artifacts should be served from the old release accidentally. Preserve public hosting settings and existing bindings/migration history.

## Explicit limits and reviewer decisions

1. **G005 / special 1:1 slot expansion is outside this patch.** All existing ordinary 1–10 player / 11–15 structure validation remains. Nothing reassigns, deletes or occupies ghost/tribute slots. Integrate G005 as a separate reviewed occupancy change.
2. Existing-asset transfer is blocked with a clear conflict response. A reviewed migration of individual structures, queued costs, treasury ownership and history must precede enabling it. This patch does not silently transfer or delete assets to make a claim fit.
3. There is no new structure economy or global server-authoritative reward simulation. Existing staff-edit privileges and browser simulation remain, now claim-gated. Claim actions themselves grant no items/resources. Cursor updates are monotonic and bounded by stored public ticks; full anti-cheat reward ledger, ticker trust and general resource validation remain separate work. Test actual daily reward progression and local-save reconciliation in browser before publication.
4. Empty move penalty uses existing seed tick-hour configuration and reported alliance member ticks. Confirm whether a centrally managed round configuration should replace that legacy source before rollout.
5. No automatic expiry, conquest, last-resident eviction, alliance reset or active-structure relocation. Inactive legacy records preserve reservations. Lifecycle transitions after later structure destruction/abandonment should be explicitly integrated with a reviewed policy, not inferred from this endpoint.
6. Legacy conflicts are frozen; staff chooses a winner. A loser with assets prevents adjudication until an explicit remediation plan is executed. Corrupt identities/malformed legacy coordinates require a staff repair instead of automatic destructive normalisation.
7. Request/response replay is per account and exact payload; no client request changes can resurrect ownership. Old-generation records are retained as history and cannot mutate a new round. Retention/archival of operation/audit rows should follow existing staff policy.
8. `shLoad` currently inventories the small shared directory; this is correctness-first and not an efficiency implementation. Consider indexing/snapshot optimisation after SF-052 measurements, keeping the revision/permission guards intact.

The colleague owns review, conflict resolution with newer Starfall edits, final UI/lifecycle completion, integration and publication.
