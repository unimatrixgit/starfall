# SF-068: social and shared-governance audit

Date: 2026-10-15. Scope: alliance, galaxy governance, forums, bank, Battlegroups, reset and permissions. This is a read-only source audit against the local Starfall players' manual, not a claim of exhaustive live multiplayer verification. No player assets were changed.

The manual reference is `dist/manual.html`, chapter anchors listed below. It is generated as a single line; anchors are more useful than a line number. Later runtime modules were searched for replacement definitions or reassignment of the affected functions. No later override of the functions below was found. Generated `dist/game.js` and composed runtimes reproduce the canonical implementation.

## Confirmed findings

### SOC-01 — High: ordinary-player alliance donations and exchanges are not shared

Manual: `#alliance`, Funds and taxes, describes donations arriving in the Alliance Fund after eight ticks and permission-controlled fund exchanges.

Evidence:

- `app-src/game/game.js:306`: alliance dispatcher centrally routes recruitment, tax, fortress and diplomacy; donations and exchanges use local functions.
- `app-src/game/game.js:489`: `donateAllianceFund` deducts personal resources and appends to local `state.alliance.pendingDonations`.
- `app-src/game/game.js:490`: `exchangeAllianceResources` mutates local personal or alliance accounts.
- `dist/planets.js:9–10`: directory sync exits for `!planetDirectoryEditable`.
- `worker/planets.js:20`: directory updates require staff planet-management permission.
- `dist/planets.js:7`: applying a newer central directory replaces the local alliance with its server profile.

Reproduction path: an ordinary member donates, observes the local charge and scheduled donation, then another member inspects the fund. No central write communicates that donation. A subsequent central-directory revision can replace the pending donation/fund with the unchanged server copy. The shared-fund exchange has the same missing persistence path. This does not imply that all browser-local personal exchanges are inherently invalid; the defect is the shared alliance account and charged donation promise.

### SOC-02 — High: two real ministers cannot complete the same exile vote

Manual: `#politics` requires funding and minister approvals. UI explicitly requires two approvals.

Evidence: `app-src/game/game.js:308–309` stores votes and approvals only in `state.politics.votesToExile`. The central-mode interception in line308 covers only commander votes and minister appointments. `dist/population-development.js:4–5` neither sends nor receives exile votes. `worker/population-development.js:9–13` supports deposit, payout, tax, ministers and commander vote, but no exile operation.

Reproduction path: minister A opens/approves a vote; minister B's browser has no copy to approve. This is a shared-workflow failure. The existing local exile simulation and its displayed limitation do not resolve the missing real-minister coordination.

### SOC-03 — Medium: exile withdraws from the wrong fund

Manual: `#politics` distinguishes Galaxy Fund from Alliance Fund. `app-src/game/game.js:279` presents the exile funding requirement as Galaxy Fund.

Evidence: `app-src/game/game.js:308` checks and debits `state.alliance.fund`, not `state.galaxyFund`.

Deterministic VM reproduction of the canonical function: target score1,000 and exileCount0 charged100 Metal, Crystal and Eonium from an alliance balance of1,000 each, producing900 each. No Galaxy Fund access occurred. An unaffiliated player can be blocked despite adequate galaxy reserves. In central mode this is a local wrong-account charge; this audit did not demonstrate an unauthorized server withdrawal.

### SOC-04 — Medium: galaxy identity and message save only in the commander's browser

Manual: `#politics` describes galaxy-wide message and banner governance.

Evidence: `app-src/game/game.js:308` checks the local commander's identity, updates `p.banner` and `p.message`, and displays success. It sends no central request for action `message`. `dist/population-development.js:4` refreshes commander, ministers, votes and fund, but no message/banner. The server action list above has no identity/message operation.

Reproduction path: GC saves a new name/message; another galaxy member continues to see their own prior values. This is not a demonstrated bypass of the GC check; it is absent shared persistence.

### SOC-05 — Medium: Galaxy Fund permission controls lack the advertised restriction and enforcement

Manual: `#politics`; UI `app-src/game/game.js:279` says the Development Minister controls allowed donation resources.

Evidence: the `fund` branch in `app-src/game/game.js:308` has no role check. Direct VM reproduction with GC and Development Minister set to another ruler allowed an ordinary ruler to set `allowedFund.metal=false`. The central deposit branch `worker/population-development.js:9` does not consult those flags.

Impact: any player can change their own local controls, while a minister's disabled-resource choice does not govern central donations. This is inconsistent local UI and missing shared policy, not a proven central authorization escalation.

### SOC-06 — Medium: staff structure GUI offers the wrong slots for an active1:1 stronghold

Evidence: `dist/admin-alliances.js:34` hardcodes11–15 for displayed structure cards and the generator selector. `dist/galaxy-slots.js:7,15` defines fresh structure slots16–20 for active1:1, with11–15 ghost slots. No later replacement of `adminStructureWorkspace` was found.

Reproduction path: select an alliance whose active stronghold is1:1 and open its staff Structures module. The generator cannot select any of the five correct fresh slots. Server rejection of an invalid choice would protect data but does not make the GUI usable. Existing retained legacy structures require separate handling.

## Documentation drift

`dist/manual.html#galaxies` still describes deterministic simulated galaxies and exactly15slots everywhere. `#alliance` universally describes structure slots11–15. These conflict with player-only mode and the special active1:1 layout. They are documentation findings, separate from the functional bugs above.

## Caveats and checked areas without a confirmed finding

- `#start` explicitly discloses browser-local practice simulation progress. Browser-local state alone is not a bug; the findings concern shared operations presented as galaxy/alliance actions.
- `#launch-bay` explicitly states that officer orders wait for an offline member's game to reopen. Do not report that disclosed limitation as a new defect.
- `#galaxies` explicitly discloses immediate practice self-exile rather than Planetarion's delayed move. Do not file that difference as a new regression.
- `worker/forums.js:3` checks current galaxy/alliance scope for topic reads and replies. No confirmed forum isolation defect was established in this pass.
- No new confirmed defect was established for Battlegroups, personal reset or Spacing Bank within this bounded review. This is not a certification that every path in those systems works.
- No live two-account multiplayer mutations were performed. Reproduction descriptions distinguish source-proven missing data paths from the two direct VM demonstrations.
