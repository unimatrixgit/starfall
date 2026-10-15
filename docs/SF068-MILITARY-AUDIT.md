# SF-068 military functions audit

Audit date: 2026-10-15. Read-only inspection of the local Starfall implementation against its shipped player manual. Production code was not modified and no live player assets were changed.

## Confirmed implementation findings

### M1 — Galaxy sweep charges for ineligible Landing and Incoming scans

- Evidence: `app-src/game/game.js:299`, `runGalaxyScan`, applies only research eligibility before charging the aggregate bill and generating reports.
- Contrast: individual `runScan` at line 301 requires an ETA-1 mission for Landing and a homebound enemy mission for Incoming.
- Manual: `dist/manual.html#scans` explicitly requires an ETA-1 fleet for Landing and an inbound enemy fleet for Incoming. The same chapter says galaxy sweeps require sufficient funding for every target.
- Reproduction: extracted the unmodified `scanData` and `runGalaxyScan` functions into a Node VM. Supplied an empty mission array, one target, an amplifier, unlocked research and Landing/Incoming/Jumpgate scan types. The sweep charged 15,000 of **each** resource and saved all three reports. Landing reported zero ETA-1 fleets.
- Expected: a sweep must apply the individual scan eligibility rules before charging, with an explicit skip/rejection policy and correct total price.

### M2 — Jumpgate Probe reports docked composition instead of travelling fleets

- Evidence: `app-src/game/game.js:287`, `scanData`, shares the unit/advanced/incoming/jumpgate branch and reads `p.ships` for Jumpgate.
- Manual: `#scans`, Jumpgate Probe promises friendly and hostile fleets travelling to the target.
- Reproduction: the isolated VM above had no missions and 99 docked Fighters on the target. Jumpgate returned 99 Fighters as its composition.
- Expected: enumerate eligible travelling missions to that target. An empty mission list must not be represented by the target's docked ships.

### M3 — Incoming Scan composition is hard-coded to zero

- Evidence: `app-src/game/game.js:287` replaces the composition with every ship key set to zero for `type === 'incoming'`; no mission composition is read.
- Manual: `#scans`, Incoming Scan promises fleet composition travelling toward the player's planet.
- Reproduction: isolated `scanData(targetId, 'incoming')` always returned Fighter: 0 with the supplied target composition; the code path is independent of inbound ship counts.
- Expected: show known eligible inbound ship composition, preserving unknown information rather than inventing zero counts. This finding concerns report generation; creating genuine enemy inbound missions in the current practice model was not tested.

### M4 — Saved scan text contains literal backslash-n delimiters

- Evidence: `app-src/game/game.js:287` constructs scan text with escaped backslash-n strings. `renderWaves` at line 294 replaces actual newline characters with HTML breaks.
- Reproduction: VM scan results contain literal `\\n` delimiters between report fields, rather than newline characters. Therefore the renderer's newline replacement does not split those fields.
- Expected: use real newlines for newly generated reports and preserve readable historical report rendering.

### M5 — Planet Scan omits the promised guards field

- Evidence: `app-src/game/game.js:287`, Planet Scan includes ruler, planet, coordinates, value/score, asteroids, resources and production mix, but no guards.
- Manual and UI: `#scans` and `SCAN_TYPES` at line 280 both promise guards in Planet Scan information.
- Reproduction: inspect or run the Planet Scan branch with a target containing a guard count; no guard field is emitted.
- Expected: report the known guard count, or mark it unknown if absent; avoid treating absent intelligence as zero.

## Documentation and discoverability drift

### D1 — Calculator worksheet instructions describe the previous interface

`dist/manual.html#attack-operations` promises one attacker/defender pair of columns, arrow-key cell navigation and two-column spreadsheet paste. The current `dist/battle-calculator.js` renders per-fleet inputs with `data-bc-count`. Legacy handlers in `app-src/game/game.js:700-701` match `.bcalc-sheet [data-cship]`, which the replacement interface does not render. The new multi-fleet layout was user-authorised; classify this as an instruction/feature mismatch requiring a deliberate compatibility decision, rather than assuming the layout itself is defective. Native Tab navigation remains available.

### D2 — Manual calls implemented Battlegroups an upcoming feature

The attack-operations chapter says the full Battlegroup membership interface is a separate upcoming feature, while `dist/battlegroups.js` and the implemented Alliance page provide it.

### D3 — In-game field guide preserves outdated founding rules

`app-src/game/game.js:231`, `showGuide`, still describes one queued construction project, seven simulated neighbours, all five workforce departments totalling 100%, and completed ships entering Base only. These conflict with the four-slot queues, player-only round, workforce capacity limits and selectable production destinations documented elsewhere in the current game.

## Scope and limitations

- Reviewed local fleet launch/recall/travel, combat resolver, scans, covert operations, calculator and attack-tool-facing manual text. This is not a claim that every combination of these systems has been exercised.
- The manual expressly labels combat estimates and most covert effects as browser-local practice behaviour. Lack of server-authoritative multiplayer combat is consequently not listed as an undocumented defect.
- The calculator itself discloses that EMP/theft are not supplied by its existing resolver. Do not claim its preview is equivalent to Planetarion combat.
- News Scan's placeholder intercepted history and other explicitly disclosed practice limits need a product decision before being promoted to defects.
- Root agent owns full UI checks, composed regression testing, urgent staff-page work, task registration and any subsequent remediation/publication.
- No external paused colleague was contacted. No reset, deployment, or GitHub push was performed by this audit agent.
