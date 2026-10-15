# SF-068 · Game versus manual audit

Date: 2026-10-15. Economy review compares the current Starfall manual source in `scripts/build-portal.cjs` with canonical `app-src/game/game.js`. This is a confirmed-findings report, not a claim that every game interaction has been exhaustively verified. Intentional Starfall rules are not treated as Planetarion compatibility defects.

## Reproduce safely

Run `node scripts/audit-game-manual.cjs` from the repository. It extracts only the existing offline game harness, loads canonical game code, uses isolated in-memory storage and fake DOM objects, and prints JSON observations. It makes no network requests and changes no live account, colony, file, or browser save. It exits successfully when observations are produced, including observations of defects; it is not part of the normal test suite. `defectObserved: false` after a later fix indicates that the specific reproducer no longer fails.

## Confirmed functional defects

### SF068-E01 · Rendering construction discards remaining CU

**Impact: high; construction timing and displayed progress are incorrect.** At initial inspection, `game.js:172` (`constructionHTML`) calls `productionRate(o)` with a construction order. `productionRate` at line 118 calls `normalizeProductionOrder` (line 105), which finds no matching ship for a Biodome/facility ID. `refreshProductionTotals` (line 107) then sets both construction `total` and `remaining` to zero from an empty `factoryWork` map.

Minimal reproduction: set active construction to `{id:'biodome',total:250,remaining:250,cost:{metal:300,crystal:200,eonium:100}}`, then call `constructionHTML()`. Observed work becomes `0/0` merely from rendering. The tick completion path at line 223 will finish that project on the next tick regardless of its true CU requirement. The manual construction section (`build-portal.cjs:14`) promises progression through construction units and accurate remaining work/estimated ticks. Rendering must be pure and must display `constructionRate()`, not pass a facility order to ship-production normalization.

### SF068-E02 · Bonus CU bypasses reserved construction capacity

**Impact: medium; facility totals can exceed the research limit.** `allocateQuestBonus` at `game.js:578` tests only completed buildings against `buildingLimit()`. It omits already-paid active and queued construction. Regular paid construction at line 203 correctly counts both.

Minimal reproduction: 19 completed Biodomes, one active paid Biodome, capacity 20, and 250 unused bonus CU. Allocate all 250 CU to another Biodome. Observed result: 20 completed plus one active, bank reduced to zero, for 21 reserved structures at a 20-structure limit. Manual bonus rules require construction limits to apply (`build-portal.cjs:52`), and construction slots reserve capacity. The bonus allocation must validate completed buildings plus all pending paid orders atomically before spending CU.

### SF068-E03 · Bonus factory warrants use unreachable research branches

**Impact: medium; researched rewards remain unavailable.** `bonusBuildingAvailable` at `game.js:762` requires `research.frigate >= 1` for medium factories and `research.siege >= 1` for heavy factories and Structure Defence. Current playable `TECH_TREE` (line 96) uses a single `fighter` hull branch with levels 1/2/3 for light/medium/heavy ships; `shipUnlocked` (line 127) already follows that model. There is no playable `frigate` or `siege` branch.

Minimal reproduction: set `state.research.fighter = 3` while retaining ordinary fresh legacy branch values. `bonusBuildingAvailable('mediumFactory')`, `bonusBuildingAvailable('heavyFactory')` and `bonusBuildingAvailable('structureDefense')` all return false. CU allocation is blocked and free quest structures are converted to CU even after the real hull research is complete. Manual warrant wording (`build-portal.cjs:52`) still uses the obsolete Frigate I/Siege I names. Align gates and documentation with current hull levels; avoid granting research automatically.

## Documentation discrepancies

- The construction manual (`build-portal.cjs:14`) says 20% construction assignment provides 100 CU/tick. The current Terran base at `game.js:100` is 125 CU, and `constructionRate()` at line 113 gives 150 CU before population bonus at 20% staffing. The manual needs the current race-based formula rather than a universal old example.
- The in-game `showGuide()` near `game.js:229` describes one active plus one queued construction, one research branch without its queue, a compulsory 100% workforce allocation, and seven simulated neighbours. These statements conflict with current four-slot construction/research, research-dependent workforce pool and registered-player universe. This is stale help, not evidence that the newer systems should be reverted.

## Checked without finding a formula discrepancy in this review

Core-income levels, asteroid income, refinery base income, Finance Centre percentage, Cargo capacity progression, workforce department caps/pool progression, population housing/growth and the race-based research formula agree with the current corresponding Starfall manual descriptions. This is source comparison, not comprehensive live or concurrency verification. Shared-bank/tax and broader military/social findings are covered by the parent audit and must be integrated separately.

Line references reflect the initial audit snapshot and can shift as fixes are applied. No production code was changed by this economy review.
