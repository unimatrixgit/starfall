# Frontend source ownership — SF-041 phase 1

Starfall remains one repository and one composed Worker. Domain folders let portal and game contributors edit separate canonical sources. Shared files require coordination before editing. Session cookies, URLs, database migrations and saved games remain unchanged.

- `portal/`: portal presentation, roster, diagnostics and registration styles.
- `game/`: game shell, gameplay and game presentation.
- `shared/`: authentication/navigation client and display names used by both runtimes.
- `worker/` and `drizzle/` remain at repository root with one integration owner.

The explicit mapping is `scripts/source-layout.cjs`. The twelve mapped files are now migrated into these domain folders. When a mapped file is absent here, its existing `dist/` file remains authoritative. After the integration owner migrates a file here, this canonical source becomes the only editable authority; the mapped `dist/` copy becomes generated compatibility output. Never edit both copies. The sync tool copies canonical inputs to compatibility paths, never the other way around, and skips canonical files not migrated yet. Do not place generated runtimes or Worker output here.

Run `node scripts/build.cjs` for the composed build and `node --test tests/*.test.cjs` after building. Builds must sync inputs before catalogue generation. Portal page generation must relinquish game seed generation to a dedicated game build step. Preserve one ordered runtime bootstrap and fresh portal inputs before hashing bundles. Phase 1 does not claim a fully clean build from an empty `dist/`; unmigrated authored assets still live there. Separate repositories or deployments are outside this change.
