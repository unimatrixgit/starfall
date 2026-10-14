# Starfall repository ownership

Edit canonical frontend sources under app-src/portal, app-src/game and app-src/shared when listed in scripts/source-layout.cjs. Their dist copies are generated compatibility output; never edit both copies. Other unmapped authored dist files remain authoritative. Do not put Worker bundles or generated hash runtimes in app-src.

Use node scripts/build.cjs for the composed build: sync canonical inputs, generate game seed, build fresh portal pages, then runtime bundles/Worker and link audit. Portal builds must not mutate game seed state. Shared authentication, worker and drizzle changes require coordination with other contributors. No force pushes; notify before GitHub pushes.
