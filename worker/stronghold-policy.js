const StrongholdPolicy=(()=>{
// Framework-independent proposal for SF-049. Context must come from server policy.
class PolicyError extends Error {
  constructor(code, message) { super(message); this.name = 'PolicyError'; this.code = code; }
}
const fail = (code, message) => { throw new PolicyError(code, message); };
const states = new Set(['active', 'inactive', 'disputed', 'released']);
const reserved = claim => claim.status !== 'released';
const identifier = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 120;
function id(value) { if (!identifier(value)) fail('INVALID', 'Invalid identifier.'); return value; }
function normalizeGalaxy(value) {
  if (typeof value !== 'string' || !/^\d{1,3}:\d{1,3}$/.test(value)) fail('INVALID', 'Use galaxy x:y.');
  const [x, y] = value.split(':').map(Number);
  if (x < 1 || y < 1) fail('INVALID', 'Galaxy coordinates must be positive.');
  return `${x}:${y}`;
}
function overlaps(a, b) {
  return a.roundId === b.roundId && (a.galaxy === b.galaxy || a.allianceId === b.allianceId);
}
function checkRows(rows) {
  if (!Array.isArray(rows)) fail('INVALID', 'Claims must be an array.');
  const ids = new Set();
  for (const row of rows) {
    if (!row || !identifier(row.id) || ids.has(row.id)) fail('INVALID', 'Claim IDs must be unique.');
    ids.add(row.id); id(row.roundId); id(row.allianceId);
    if (normalizeGalaxy(row.galaxy) !== row.galaxy || !states.has(row.status)) fail('INVALID', 'Invalid claim state.');
    if (!Array.isArray(row.assetRefs) || row.assetRefs.some(x => !identifier(x)) || new Set(row.assetRefs).size !== row.assetRefs.length) fail('INVALID', 'Invalid asset references.');
    if (row.status === 'released' && row.assetRefs.length) fail('ASSETS_REMAIN', 'Released claims cannot retain assets.');
  }
}
function validateState(state) {
  if (!state || !Number.isSafeInteger(state.revision) || state.revision < 0) fail('INVALID', 'Invalid revision.');
  checkRows(state.claims);
  for (let i = 0; i < state.claims.length; i++) {
    const a = state.claims[i];
    for (const b of state.claims.slice(i + 1)) {
      if (reserved(a) && reserved(b) && overlaps(a, b) && (a.status !== 'disputed' || b.status !== 'disputed')) fail('CONFLICT', 'Overlapping reservations must remain disputed.');
    }
  }
  return true;
}
function start(state, command) {
  validateState(state);
  if (!command || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== state.revision) fail('STALE', 'Refresh before retrying.');
  if (state.revision === Number.MAX_SAFE_INTEGER) fail('INVALID', 'Revision exhausted.');
  return structuredClone(state);
}
function finish(state) { state.revision++; validateState(state); return state; }
function find(state, claimId) {
  id(claimId);
  return state.claims.find(c => c.id === claimId) || fail('NOT_FOUND', 'Claim not found.');
}
function manage(context, allianceId) {
  if (context?.admin === true) return;
  if (!Array.isArray(context?.authorizedAllianceIds) || !context.authorizedAllianceIds.includes(allianceId)) fail('FORBIDDEN', 'Stronghold management permission required.');
}
function admin(context) { if (context?.admin !== true) fail('FORBIDDEN', 'Conflict adjudication requires administrator permission.'); }
function available(state, candidate, excluded = new Set()) {
  if (state.claims.some(c => reserved(c) && !excluded.has(c.id) && overlaps(candidate, c))) fail('CONFLICT', 'Galaxy or alliance already reserved in this round.');
}
function claimStronghold(state, command, context) {
  const next = start(state, command);
  const candidate = {id: id(command.id), roundId: id(command.roundId), allianceId: id(command.allianceId), galaxy: normalizeGalaxy(command.galaxy), status: 'active', assetRefs: []};
  manage(context, candidate.allianceId);
  if (next.claims.some(c => c.id === candidate.id)) fail('DUPLICATE_ID', 'Claim ID already exists.');
  available(next, candidate); next.claims.push(candidate); return finish(next);
}
function releaseStronghold(state, command, context) {
  const next = start(state, command), claim = find(next, command.claimId);
  manage(context, claim.allianceId);
  if (claim.status === 'disputed') fail('DISPUTED', 'Resolve the dispute first.');
  if (claim.status === 'released') fail('RELEASED', 'Claim already released.');
  if (claim.assetRefs.length) fail('ASSETS_REMAIN', 'Handle structures and build reservations before release.');
  claim.status = 'released'; return finish(next);
}
function transferStronghold(state, command, context) {
  const next = start(state, command), claim = find(next, command.claimId), target = id(command.targetAllianceId);
  // Non-admin context represents verified approvals by BOTH alliance leaderships.
  manage(context, claim.allianceId); manage(context, target);
  if (claim.status === 'disputed') fail('DISPUTED', 'Resolve the dispute first.');
  if (claim.status === 'released') fail('RELEASED', 'Released claims cannot transfer.');
  if (target === claim.allianceId) fail('INVALID', 'Choose a different alliance.');
  available(next, {...claim, allianceId: target}, new Set([claim.id]));
  claim.allianceId = target; return finish(next);
}
function markDisputed(state, command, context) {
  const next = start(state, command); admin(context);
  if (!Array.isArray(command.claimIds) || !command.claimIds.length || new Set(command.claimIds).size !== command.claimIds.length || !identifier(command.reason)) fail('INVALID', 'Supply claim IDs and a short reason.');
  for (const claimId of command.claimIds) {
    const claim = find(next, claimId);
    if (!reserved(claim)) fail('RELEASED', 'Released claims cannot be disputed.');
    claim.status = 'disputed'; claim.disputeReason = command.reason;
  }
  return finish(next);
}
function resolveConflict(state, command, context) {
  const next = start(state, command); admin(context);
  const winner = find(next, command.winnerClaimId);
  if (winner.status !== 'disputed') fail('INVALID', 'Winner must be disputed.');
  if (!['active', 'inactive'].includes(command.winnerStatus)) fail('INVALID', 'Choose the adjudicated status.');
  const losers = next.claims.filter(c => c.id !== winner.id && reserved(c) && overlaps(winner, c));
  // Assets must already have an approved and persisted remediation; never discard them.
  if (losers.some(c => c.assetRefs.length)) fail('ASSETS_REMAIN', 'Conflicting assets require an explicit remediation plan.');
  for (const loser of losers) { loser.status = 'released'; loser.resolutionWinnerId = winner.id; }
  winner.status = command.winnerStatus; delete winner.disputeReason;
  return finish(next);
}
function importLegacyClaims(rows) {
  // Trusted snapshot only: preserves IDs, assets, owners and other metadata.
  if (!Array.isArray(rows)) fail('INVALID', 'Claims must be an array.');
  const claims = structuredClone(rows).map(c => ({...c, galaxy: normalizeGalaxy(c.galaxy)}));
  checkRows(claims);
  const conflicting = new Set();
  for (const a of claims) for (const b of claims) {
    if (a.id !== b.id && reserved(a) && reserved(b) && overlaps(a, b)) { conflicting.add(a.id); conflicting.add(b.id); }
  }
  for (const c of claims) if (conflicting.has(c.id)) { c.status = 'disputed'; c.disputeReason = 'Legacy overlapping reservations'; }
  const result = {revision: 0, claims}; validateState(result); return result;
}
function bonusEligible(state, claimId, member) {
  validateState(state); const claim = find(state, claimId);
  return claim.status === 'active' && member?.hasFunctionalStructure === true && member.roundId === claim.roundId && member.allianceId === claim.allianceId && normalizeGalaxy(member.galaxy) === claim.galaxy;
}

return {PolicyError,normalizeGalaxy,validateState,claimStronghold,releaseStronghold,transferStronghold,markDisputed,resolveConflict,importLegacyClaims,bonusEligible};
})();
