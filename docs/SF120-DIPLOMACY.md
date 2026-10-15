# Alliance relations validation

Reference: https://game.planetarion.com/manual.pl?page=alliance (read 2026-10-15).

Implemented the explicit war rules: shuffle gate, five planets per alliance, one primary mandate, optional target allies, 48 ticks, 5/25 primary and 3/15 secondary bonuses, and -5/-25 against other targets. Bilateral alliance proposals establish the allies needed for secondary targeting. Relations show status, bonuses, remaining ticks and the action log. Server checks permission and revisions.

Combat now credits captured asteroids even when defenders lose no ships; destroying ships alone does not earn capture XP. Regression cases cover 5/25, 3/15, non-war penalties, expiry and resource conservation.

The manual mentions automatic war escalation without giving an attack threshold. This release does not invent or enable automatic escalation. It retains Starfall's other combat formulas rather than claiming the complete Planetarion formula model.
