# Starfall Command

The complete browser-local practice game, synchronized from the existing Sites source repository. The previous GitHub revision contained a smaller prototype and did not include the dashboard shown in the reference screenshot.

The practice round remains browser-local and preserves the `starfall-round-v2` save key. Scan storage now uses a central D1 database, with Sites-managed ChatGPT identity. Existing Site access rules are preserved.

## the Miday array

- Planet Settings → Quick Actions has an unchecked sharing option. Scans are stored centrally; only opted-in players' scans appear in the shared archive.
- Archive → the Miday array displays shared scans with type icons, search, individual type filters, an all-types toggle and pagination.
- The archive button beside the Galaxy Browser scan letters opens all shared scans for that planet.
- The server validates signed-in identity, isolates ownership, excludes hidden coordinates from searches, and retains scans for two weeks. Turning sharing off hides that player's scans from the shared feed. Deleting a scan removes its central copy as well.
- `worker/index.js` contains the server; `drizzle/0000_miday_array.sql` defines the central tables. Sites applies this bounded schema migration at deployment.

Build with `node scripts/build-worker.cjs`. Run the local preview with `node scripts/preview.cjs`; its example scans and identities exist only in a temporary in-memory test database. The generated Worker embeds game assets, so no frontend functionality depends on a separate static deployment.

## Changes

- Planet Settings replaces Layout Module with an unchecked Exile Option. Confirmation moves the home planet to a free slot in another galaxy with the Planetarion manual self-exile cost displayed and charged for each resource. Fleets, buildings, research and alliance membership are preserved. Costs rise with previous self exiles; free planets pay double. Cost statistics use tracked local counted galaxy scores, and payments are retained in the origin galaxy fund. Relocation remains immediate in this practice game.
- Galaxy Browser and Galaxy Status always display 15 slots: ten planet slots and five alliance structure slots (11–15). Empty structure slots display Empty / Reserved, including galaxies without a stronghold.
- Existing planets occupying slots 11–15 are relocated without deleting their data; alliance member coordinates are updated. Existing structure slot 10 is migrated into the structure range.
- Under Scan Coordinates, custom and pasted coordinates select the target for the existing scan actions. `2:7` means galaxy 2, slot 7, in the home planet's sector; full `07:04:01` coordinates are also accepted. Existing scan research, funding and report behavior is retained.
- The stronghold's passive 0.25% income bonus and daily free Wave Distorter apply only to alliance members residing in its galaxy. Other alliance megastructure effects and the alliance-wide anarchy penalty retain their existing scope.

## Tests

Run `node --test tests/game.test.cjs`. Tests cover save migration, both galaxy views, structures, exile cancellation and persistence, stronghold reward eligibility, scan inputs and prerequisites, rendering and hourly income.

Live site: https://starfall-command.bonnystoat9.chatgpt.site/

## Game portal
The root URL serves the portal; /manual.html has 15 detailed searchable categories, /login.html signs in, and /game requires a game session. The initial admin is created once through the owner-access-controlled setup flow. Passwords are salted PBKDF2 hashes; sessions use hashed tokens and HttpOnly cookies. No account password is stored in source.
