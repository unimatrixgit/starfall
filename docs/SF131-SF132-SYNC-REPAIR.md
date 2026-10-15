# Havoc and Alliance Fund synchronization — v0.126.6

Havoc was applied to directory planet records but already-open owner sessions did not consume those values. Their normal colony report could then overwrite the staff values. The coordinate 1:1:1 is not excluded by the Havoc target selector.

Staff Havoc applications now carry an operation reference. The server creates a durable per-owner delivery with the selected economy, research, construction, population, base fleet and tick interval. Clients apply it once; the initiating client acknowledges its already-applied local change. A normal colony report with an older acknowledgement is rejected. Other fleet slots and missions remain intact. Reset epochs fence old deliveries. A new Havoc restore also creates a delivery. Distributions made before this release are not recreated from guesses.

Colony synchronization now shares its in-flight promise. A trade waiting behind a background report receives its result rather than an immediate busy=false failure. A 409 triggers a direct shared-data refresh and at most three total colony attempts, rebuilding the payload and settlement acknowledgements each time. This does not automatically retry exchange POSTs; their existing operation IDs remain unchanged. Persistent failure displays its actual cause.

Validation: 577 automated tests pass. New cases cover an administrator delivering to a different owner at 1:1:1, rejection of stale reports, acknowledged reports, exactly-once local application, preservation of other fleets/missions, reset-epoch isolation, in-flight synchronization, refreshed acknowledgement retries and bounded persistent conflicts. A real local browser exchanged 1,000 metal for 975 crystal: personal balances 9,000/9,000 to 8,000/9,975; Alliance Fund 18,000/14,000 to 19,000/13,000. No browser console errors observed. Compact reserve cards measured 52.8px at a 1280px viewport, without document overflow.

Only the isolated fixture was traded. No production Havoc, resource correction, reset or trading was performed. The wider SF-068 audit remains open.
