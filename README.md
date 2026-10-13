# Starfall Command

The complete browser-local practice game, synchronized from the existing Sites source repository. The previous GitHub revision contained a smaller prototype and did not include the dashboard shown in the reference screenshot.

Serve `dist/` with a static HTTP server. The existing `starfall-round-v2` browser save key is preserved. No live multiplayer backend is supplied by this repository.

## Changes

- Planet Settings replaces Layout Module with an unchecked Exile Option. Confirmation moves the home planet to a free slot in another galaxy while preserving resources, fleets, buildings, research and alliance membership.
- Galaxy Browser and Galaxy Status always display 15 slots: ten planet slots and five alliance structure slots (11–15). Empty structure slots display Empty / Reserved, including galaxies without a stronghold.
- Existing planets occupying slots 11–15 are relocated without deleting their data; alliance member coordinates are updated. Existing structure slot 10 is migrated into the structure range.
- Under Scan Coordinates, custom and pasted coordinates select the target for the existing scan actions. `2:7` means galaxy 2, slot 7, in the home planet's sector; full `07:04:01` coordinates are also accepted. Existing scan research, funding and report behavior is retained.
- The stronghold's passive 0.25% income bonus and daily free Wave Distorter apply only to alliance members residing in its galaxy. Other alliance megastructure effects and the alliance-wide anarchy penalty retain their existing scope.

## Tests

Run `node --test tests/game.test.cjs`. Tests cover save migration, both galaxy views, structures, exile cancellation and persistence, stronghold reward eligibility, scan inputs and prerequisites, rendering and hourly income.

Live site: https://starfall-command.bonnystoat9.chatgpt.site/
