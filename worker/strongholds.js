// SF-049: server-owned stronghold claims. Included before the Worker entrypoint.
const strongholdSchema = `
CREATE TABLE IF NOT EXISTS stronghold_states(generation INTEGER PRIMARY KEY,data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stronghold_claims(generation INTEGER NOT NULL,id TEXT NOT NULL,galaxy TEXT NOT NULL,alliance_id TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(generation,id));
CREATE UNIQUE INDEX IF NOT EXISTS stronghold_galaxy_exclusive ON stronghold_claims(generation,galaxy) WHERE status IN ('active','inactive');
CREATE UNIQUE INDEX IF NOT EXISTS stronghold_alliance_exclusive ON stronghold_claims(generation,alliance_id) WHERE status IN ('active','inactive');
CREATE TABLE IF NOT EXISTS stronghold_operations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,payload TEXT NOT NULL,response_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stronghold_audit(id TEXT PRIMARY KEY,generation INTEGER NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL);`;
const shDirectoryTransition=Symbol('trusted stronghold directory transition');
function shEqual(a,b) {
  function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])])):v;}
  return JSON.stringify(sort(a))===JSON.stringify(sort(b));
}
function shStructureData(value){if(!value)return value;const copy={...value};delete copy.player;delete copy.directoryReadOnly;return copy;}
function shAssetRefs(alliance, directory) {
  const refs=[];
  for(const [kind,items] of [['active',alliance.structures?.active||[]],['queue',alliance.structures?.buildQueue||[]]]) {
    items.forEach((item,i)=>refs.push(kind+':'+String(item.id||i)));
  }
  for(const row of directory) if(row.kind==='structure'&&JSON.parse(row.data_json).alliance===alliance.name) refs.push('directory:'+row.id);
  return [...new Set(refs)];
}
async function shLoad(env) {
  await ensureAllianceRegistry(env); await ensureSpecialWorldSchema(env);
  const meta=await env.DB.prepare('SELECT * FROM planet_directory_meta WHERE id=1').first();
  const generation=meta.reset_generation||0;
  const rows=(await env.DB.prepare('SELECT name,data_json FROM planet_alliances ORDER BY name').all()).results||[];
  const directory=(await env.DB.prepare('SELECT * FROM planet_directory ORDER BY id').all()).results||[];
  const alliances=[];
  for(const row of rows){
    const a=JSON.parse(row.data_json),registered=await env.DB.prepare('SELECT alliance_id FROM alliance_registry WHERE name_key=?').bind(a.name.toLowerCase()).first();
    // Deterministic legacy identity until it can be atomically persisted.
    a.registryId=registered?.alliance_id||a.registryId||('legacy-'+(await digest(a.name.toLowerCase())).slice(0,32));
    alliances.push(a);
  }
  const stored=await env.DB.prepare('SELECT data_json FROM stronghold_states WHERE generation=?').bind(generation).first();
  let state;
  if(stored) state={...JSON.parse(stored.data_json),revision:meta.revision};
  else {
    const legacy=alliances.filter(a=>a.fortress?.strongholdGalaxy).map(a=>({id:'legacy-'+a.registryId,roundId:String(generation),galaxy:StrongholdPolicy.normalizeGalaxy(a.fortress.strongholdGalaxy),allianceId:a.registryId,status:'active',assetRefs:shAssetRefs(a,directory)}));
    state={...StrongholdPolicy.importLegacyClaims(legacy),revision:meta.revision};
  }
  for(const c of state.claims){
    const a=alliances.find(a=>a.registryId===c.allianceId);
    if(c.status!=='released') c.assetRefs=a?shAssetRefs(a,directory):c.assetRefs;
  }
  StrongholdPolicy.validateState(state);
  return {meta,generation,rows,directory,alliances,state};
}
function shCanManage(user,alliance,directory) {
  if(!user||!alliance)return false;
  // Membership comes from the owned planet, rank from the stored alliance roster.
  const owned=directory.filter(r=>r.kind==='planet'&&r.owner_id===user.id).map(r=>({row:r,p:JSON.parse(r.data_json)}));
  return owned.some(({row,p})=>p.alliance===alliance.name&&(alliance.members||[]).some(m=>(m.planetId===row.id||m.planet===p.name)&&(alliance.rankPermissions?.[m.rank]?.fortress??['Owner','HC'].includes(m.rank))));
}
function shContext(user,snapshot,ids,staffOverride=false) {
  if(staffOverride&&user.role==='admin') return {admin:true};
  const authorizedAllianceIds=ids.filter(id=>{const a=snapshot.alliances.find(a=>a.registryId===id);return a&&shCanManage(user,a,snapshot.directory);});
  return {authorizedAllianceIds};
}
function shProject(alliances,state) {
  return alliances.map(a=>{
    const c=state.claims.find(c=>c.allianceId===a.registryId&&c.status!=='released');
    return {...a,fortress:{...(a.fortress||{}),strongholdGalaxy:c?.status==='active'?c.galaxy.split(':').map(n=>n.padStart(2,'0')).join(':'):'',claimId:c?.id||null,claimStatus:c?.status||'unclaimed',reservedGalaxy:c?.galaxy||''}};
  });
}
async function shDirectoryProjection(env,alliances) {
  const snapshot=await shLoad(env);
  // IDs derive from the server registry, never the directory request.
  return shProject(alliances.map(a=>({...a,registryId:snapshot.alliances.find(x=>x.name===a.name)?.registryId||a.registryId})),snapshot.state);
}
async function shGuardDirectory(env,body,user,providedSnapshot) {
  const snapshot=providedSnapshot||await shLoad(env);
  const stored=(await env.DB.prepare('SELECT name,data_json FROM planet_alliances ORDER BY name').all()).results||[];
  const previous=stored.map(r=>JSON.parse(r.data_json));
  const structures=(await env.DB.prepare("SELECT data_json FROM planet_directory WHERE kind='structure' ORDER BY id").all()).results.map(r=>JSON.parse(r.data_json));
  // Preserve existing staff editing only under a server-owned, undisputed claim.
  const changedAlliances=new Set();
  for(const a of body.alliances)for(const key of ['active','buildQueue']){
    const items=a.structures?.[key];
    if(items!==undefined&&(!Array.isArray(items)||items.length>200||items.some(x=>!x||typeof x.id!=='string'||!Number.isInteger(x.slot)||x.slot<11||x.slot>20)))return 'Invalid alliance structure reservations.';
  }
  const oldById=new Map(structures.map(p=>[p.id,p])),newById=new Map(body.structures.map(p=>[p.id,p]));
  for(const [id,p] of oldById)if(!shEqual(shStructureData(p),shStructureData(newById.get(id))))changedAlliances.add(p.alliance);
  for(const [id,p] of newById)if(!shEqual(shStructureData(p),shStructureData(oldById.get(id))))changedAlliances.add(p.alliance);
  for(const a of body.alliances){const old=previous.find(x=>x.name===a.name);if(old&&!shEqual(a.structures||{},old.structures||{}))changedAlliances.add(a.name);}
  for(const name of changedAlliances){
    const a=snapshot.alliances.find(a=>a.name===name),claim=a&&snapshot.state.claims.find(c=>c.allianceId===a.registryId&&c.status==='active');
    if(!a||!claim)return 'Structure writes require an active, undisputed stronghold claim.';
    if(user.role!=='admin'&&!shCanManage(user,a,snapshot.directory))return 'Your alliance leadership permission is required to edit these structures.';
    const requested=body.alliances.find(x=>x.name===name);
    if(!requested)return 'Keep the structure owner in the alliance directory.';
    const assets=body.structures.filter(p=>p.alliance===name);
    for(const p of assets){
      if(StrongholdPolicy.normalizeGalaxy(String(p.coords).split(':').slice(0,2).join(':'))!==claim.galaxy)return 'Structure coordinates must belong to the owning alliance stronghold.';
      const allowed=claim.galaxy==='1:1'?[16,17,18,19,20]:[11,12,13,14,15],previous=oldById.get(p.id);
      if(!allowed.includes(Number(p.coords.split(':')[2]))&&!(previous&&previous.coords===p.coords&&previous.alliance===p.alliance))return 'That slot is reserved for ghost planets or outside this stronghold layout.';
    }
    for(const kind of ['active','buildQueue'])for(const item of requested.structures?.[kind]||[]){
      const p=assets.find(p=>p.id===item.id);if(!p||Number(p.coords.split(':')[2])!==Number(item.slot))return 'Alliance structures and global slot reservations must match.';
    }
  }
  for(const a of body.alliances){
    const old=previous.find(x=>x.name===a.name);
    if(!old){if(a.fortress?.strongholdGalaxy||(a.structures?.active||[]).length||(a.structures?.buildQueue||[]).length)return 'New alliances cannot import stronghold claims or structures.';continue;}
    if(a.registryId&&old.registryId&&a.registryId!==old.registryId)return 'Stable alliance identity cannot be changed.';
    // Always preserve server-owned fields; clients need not echo diagnostic projection fields.
    const source=a.fortress||{},target=old.fortress||{};
    const projected=shProject([{...old,registryId:snapshot.alliances.find(x=>x.name===a.name)?.registryId}],snapshot.state)[0].fortress;
    if((source.strongholdGalaxy||'')!==(target.strongholdGalaxy||'')&&(source.strongholdGalaxy||'')!==(projected.strongholdGalaxy||''))return 'Use the stronghold API to change a claim.';
    // Preserve the existing daily-cycle cursor monotonically, bounded by reported server state.
    // No buildings/resources are granted by directory synchronization or claim changes.
    const cursor=source.lastDistorterTick,prior=target.lastDistorterTick||0;
    const latestTick=Math.max(1,...snapshot.directory.filter(r=>r.kind==='planet'&&JSON.parse(r.data_json).alliance===a.name).map(r=>JSON.parse(r.data_json).publicTick||1));
    if(Number.isSafeInteger(cursor)&&cursor>=prior&&cursor<=latestTick)target.lastDistorterTick=cursor;
    a.registryId=snapshot.alliances.find(x=>x.name===a.name)?.registryId||old.registryId; a.fortress=target;
  }
  const next=structuredClone(snapshot.state);next.revision=body.revision+1;
  const acceptedDirectory=body.structures.map(p=>({id:p.id,kind:'structure',data_json:JSON.stringify(p)}));
  for(const claim of next.claims){
    if(claim.status==='released')continue;
    const previousAlliance=snapshot.alliances.find(a=>a.registryId===claim.allianceId),accepted=body.alliances.find(a=>a.registryId===claim.allianceId);
    if(!previousAlliance||!accepted)continue;
    const before=shAssetRefs(previousAlliance,snapshot.directory),after=shAssetRefs(accepted,acceptedDirectory);
    claim.assetRefs=after;
    if(claim.status==='active'&&before.length>0&&after.length===0)claim.status='inactive';
  }
  const projectedAlliances=shProject(body.alliances,next);for(let i=0;i<body.alliances.length;i++)body.alliances[i]=projectedAlliances[i];
  body[shDirectoryTransition]=next.claims.length?{generation:snapshot.generation,state:next}:null;
  return null;
}
function shDirectoryStateStatements(env,body,operation){
  const transition=body[shDirectoryTransition];if(!transition)return [];
  const {generation,state}=transition,guard='EXISTS(SELECT 1 FROM planet_directory_meta WHERE id=1 AND operation_id=?)';
  return [env.DB.prepare(`INSERT INTO stronghold_states(generation,data_json) SELECT ?,? WHERE ${guard} ON CONFLICT(generation) DO UPDATE SET data_json=excluded.data_json`).bind(generation,JSON.stringify(state),operation),env.DB.prepare(`DELETE FROM stronghold_claims WHERE generation=? AND ${guard}`).bind(generation,operation),...state.claims.map(c=>env.DB.prepare(`INSERT INTO stronghold_claims(generation,id,galaxy,alliance_id,status) SELECT ?,?,?,?,? WHERE ${guard}`).bind(generation,c.id,c.galaxy,c.allianceId,c.status,operation))];
}
async function strongholdAPI(request,env) {
  const user=await portalUser(request,env);if(!user)return json({error:'Sign in first.'},401);
  const url=new URL(request.url);
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid origin.'},403);
  try{
    const snapshot=await shLoad(env),{state,generation}=snapshot;
    const publicState=()=>({revision:state.revision,generation,canAdjudicate:user.role==='admin',claims:state.claims.map(({assetRefs,transferOffer,...c})=>({...c,assetCount:assetRefs.length,transferTarget:transferOffer?.targetAllianceId||null})),alliances:snapshot.alliances.map(a=>({id:a.registryId,name:a.name,canManage:shCanManage(user,a,snapshot.directory)}))});
    if(request.method==='GET')return json(publicState());
    const raw=await request.text();if(raw.length>8000)return json({error:'Request too large.'},413);
    const b=JSON.parse(raw);
    if(!/^[a-zA-Z0-9_.:-]{8,120}$/.test(b.operationId||''))return json({error:'A unique operation ID is required.'},400);
    const replay=await env.DB.prepare('SELECT * FROM stronghold_operations WHERE id=?').bind(b.operationId).first();
    if(replay){if(replay.user_id!==user.id||replay.payload!==raw)return json({error:'Operation ID already used.'},409);return json(JSON.parse(replay.response_json));}
    if(b.generation!==generation)return json({error:'Round changed. Reload.'},409);
    const command={expectedRevision:b.revision,claimId:b.claimId},old=state.claims.find(c=>c.id===b.claimId);
    const ids=[b.allianceId,old?.allianceId,b.targetAllianceId].filter(Boolean);
    const context=shContext(user,snapshot,ids,b.staffOverride===true);
    if(b.staffOverride&&(!context.admin||typeof b.reason!=='string'||!b.reason.trim()))return json({error:'Administrator authority and an audit reason are required.'},403);
    let next;
    if(b.action==='claim'){
      const a=snapshot.alliances.find(a=>a.registryId===b.allianceId);
      if(!a)return json({error:'Alliance not found.'},404);
      const galaxy=StrongholdPolicy.normalizeGalaxy(b.galaxy);
      if(!snapshot.directory.some(r=>r.kind==='planet'&&JSON.parse(r.data_json).alliance===a.name&&StrongholdPolicy.normalizeGalaxy(r.coords.split(':').slice(0,2).join(':'))===galaxy))return json({error:'Choose a galaxy containing an alliance member.'},409);
      next=StrongholdPolicy.claimStronghold(state,{...command,id:crypto.randomUUID(),roundId:String(generation),allianceId:a.registryId,galaxy},context);
    }else if(b.action==='move'){
      if(!old)return json({error:'Claim not found.'},404);
      const a=snapshot.alliances.find(a=>a.registryId===old.allianceId),galaxy=StrongholdPolicy.normalizeGalaxy(b.galaxy);
      if(!snapshot.directory.some(r=>r.kind==='planet'&&JSON.parse(r.data_json).alliance===a.name&&StrongholdPolicy.normalizeGalaxy(r.coords.split(':').slice(0,2).join(':'))===galaxy))return json({error:'Choose a galaxy containing an alliance member.'},409);
      const released=StrongholdPolicy.releaseStronghold(state,command,context);
      next=StrongholdPolicy.claimStronghold(released,{expectedRevision:released.revision,id:crypto.randomUUID(),roundId:String(generation),allianceId:a.registryId,galaxy},context);
      next.revision=b.revision+1; // One atomic directory mutation, retaining the old claim as history.
    }else if(b.action==='release') next=StrongholdPolicy.releaseStronghold(state,command,context);
    else if(b.action==='offerTransfer'){
      if(!old||old.status==='released'||old.status==='disputed')return json({error:'Claim is unavailable or disputed.'},409);
      if(!context.admin&&!context.authorizedAllianceIds.includes(old.allianceId))return json({error:'Stronghold management permission required.'},403);
      if(!snapshot.alliances.some(a=>a.registryId===b.targetAllianceId)||old.allianceId===b.targetAllianceId)return json({error:'Choose an existing other alliance.'},400);
      if(b.revision!==state.revision)return json({error:'Claim changed. Refresh.'},409);
      next=structuredClone(state);next.revision++;next.claims.find(c=>c.id===old.id).transferOffer={targetAllianceId:b.targetAllianceId,approvedBy:user.id,revision:next.revision};
    }else if(b.action==='transfer'){
      if(!context.admin){
        if(!old?.transferOffer||old.transferOffer.targetAllianceId!==b.targetAllianceId||!context.authorizedAllianceIds.includes(b.targetAllianceId))return json({error:'Current source approval and target leadership acceptance are required.'},403);
        // Source authority must still exist at acceptance time.
        const sourceUser=await env.DB.prepare('SELECT id,role FROM portal_users WHERE id=?').bind(old.transferOffer.approvedBy).first();
        const source=snapshot.alliances.find(a=>a.registryId===old.allianceId);
        if(!sourceUser||!shCanManage(sourceUser,source,snapshot.directory))return json({error:'Source approval is no longer authorised.'},403);
        context.authorizedAllianceIds.push(old.allianceId);
      }
      // Existing asset transfers need a separately reviewed ownership/cost migration.
      if(old?.assetRefs.length)return json({error:'Existing structures or build reservations require an explicit asset transfer plan.'},409);
      next=StrongholdPolicy.transferStronghold(state,{...command,targetAllianceId:b.targetAllianceId},context);
      delete next.claims.find(c=>c.id===old.id).transferOffer;
    }else if(b.action==='dispute')next=StrongholdPolicy.markDisputed(state,{expectedRevision:b.revision,claimIds:b.claimIds,reason:b.reason},context);
    else if(b.action==='resolve')next=StrongholdPolicy.resolveConflict(state,{expectedRevision:b.revision,winnerClaimId:b.winnerClaimId,winnerStatus:b.winnerStatus},context);
    else return json({error:'Unknown stronghold action.'},400);
    const projected=shProject(snapshot.alliances,next);
    // Retain old move penalty; never move member planets or change membership.
    for(const a of projected){
      const previous=snapshot.alliances.find(x=>x.registryId===a.registryId);
      if(a.fortress.strongholdGalaxy&&a.fortress.strongholdGalaxy!==previous.fortress?.strongholdGalaxy){
        const ticks=snapshot.directory.filter(r=>r.kind==='planet'&&JSON.parse(r.data_json).alliance===a.name).map(r=>JSON.parse(r.data_json).publicTick||1);
        const tick=Math.max(1,...ticks),hours=Number(DEFAULT_ROUND.config?.tickHours)||1;
        a.fortress.lastDistorterTick=tick;
        if(tick>1){a.fortress.anarchyUntilTick=tick+Math.ceil(24/hours)-1;a.fortress.anarchyEnded=false;}
      }
    }
    const op=crypto.randomUUID(),guard='EXISTS(SELECT 1 FROM planet_directory_meta WHERE id=1 AND operation_id=?)';
    // Snapshot predicates protect permissions/legacy data even against older writers that omit revision bumps.
    const predicates=['id=1','revision=?','COALESCE(reset_generation,0)=?','(SELECT COUNT(*) FROM planet_alliances)=?'];
    const args=[op,b.revision,generation,snapshot.rows.length];predicates.push("EXISTS(SELECT 1 FROM portal_users WHERE id=? AND COALESCE(role,'player')=?)");args.push(user.id,user.role||'player');
    for(const row of snapshot.rows){predicates.push('EXISTS(SELECT 1 FROM planet_alliances WHERE name=? AND data_json=?)');args.push(row.name,row.data_json);}
    for(const row of snapshot.directory.filter(r=>r.owner_id===user.id||r.kind==='structure')){predicates.push('EXISTS(SELECT 1 FROM planet_directory WHERE id=? AND data_json=? AND COALESCE(owner_id,\'\')=?)');args.push(row.id,row.data_json,row.owner_id||'');}
    const response={ok:true,revision:b.revision+1,generation};
    const statements=[env.DB.prepare('UPDATE planet_directory_meta SET revision=revision+1,operation_id=? WHERE '+predicates.join(' AND ')).bind(...args),env.DB.prepare(`INSERT INTO stronghold_states(generation,data_json) SELECT ?,? WHERE ${guard} ON CONFLICT(generation) DO UPDATE SET data_json=excluded.data_json`).bind(generation,JSON.stringify(next),op),env.DB.prepare(`DELETE FROM stronghold_claims WHERE generation=? AND ${guard}`).bind(generation,op)];
    for(const c of next.claims)statements.push(env.DB.prepare(`INSERT INTO stronghold_claims(generation,id,galaxy,alliance_id,status) SELECT ?,?,?,?,? WHERE ${guard}`).bind(generation,c.id,c.galaxy,c.allianceId,c.status,op));
    for(const a of projected){
      statements.push(env.DB.prepare(`UPDATE planet_alliances SET data_json=?,updated_at=? WHERE name=? AND ${guard}`).bind(JSON.stringify(a),Date.now(),a.name,op));
      statements.push(env.DB.prepare(`INSERT INTO alliance_registry(name_key,alliance_id,name,attributes_json,created_by,updated_at) SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT(name_key) DO NOTHING`).bind(a.name.toLowerCase(),a.registryId,a.name,JSON.stringify(allianceAttributes(a)),user.id,Date.now(),op));
    }
    statements.push(env.DB.prepare(`INSERT INTO stronghold_operations SELECT ?,?,?,? WHERE ${guard}`).bind(b.operationId,user.id,raw,JSON.stringify(response),op),env.DB.prepare(`INSERT INTO stronghold_audit SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(op,generation,user.id,b.action,JSON.stringify({claimId:b.claimId||null,reason:b.reason||'',revision:next.revision}),Date.now(),op));
    const affected=new Set();for(const claim of next.claims){const before=state.claims.find(c=>c.id===claim.id);if(!before||!shEqual(before,claim)){affected.add(claim.allianceId);if(before)affected.add(before.allianceId);if(claim.transferOffer?.targetAllianceId)affected.add(claim.transferOffer.targetAllianceId);}}for(const id of affected){const a=projected.find(a=>a.registryId===id);if(!a)continue;const claim=next.claims.find(c=>c.allianceId===id&&c.status!=='released'),tick=Math.max(1,...snapshot.directory.filter(r=>r.kind==='planet'&&JSON.parse(r.data_json).alliance===a.name).map(r=>JSON.parse(r.data_json).publicTick||1)),labels={claim:'established',move:'moved',release:'released',offerTransfer:'transfer offered',transfer:'transferred',dispute:'marked disputed',resolve:'conflict resolved'},text='Stronghold '+labels[b.action]+(claim?' · Galaxy '+claim.galaxy+' · '+claim.status:'')+'.'+(a.fortress?.anarchyUntilTick>=tick?' Anarchy Mode is active through tick '+a.fortress.anarchyUntilTick+'.':'');statements.push(...allianceEventStatements(env,{operationId:b.operationId,guardToken:op,generation,alliance:a,user,type:'stronghold.'+b.action,text,tick}));}
    const results=await env.DB.batch(statements);
    if((results[0].meta?.changes??results[0].changes)!==1)return json({error:'Directory or permissions changed. Refresh before retrying.'},409);
    return json(response);
  }catch(error){
    if(error instanceof StrongholdPolicy.PolicyError)return json({error:error.code==='CONFLICT'?'This galaxy or alliance already has a reserved or disputed stronghold.':error.message,code:error.code},error.code==='FORBIDDEN'?403:error.code==='NOT_FOUND'?404:error.code==='INVALID'?400:409);
    if(error instanceof SyntaxError)return json({error:'Invalid JSON.'},400);
    // A unique index failure rolls the entire D1 batch back.
    if(/UNIQUE constraint/i.test(error.message))return json({error:'Galaxy or alliance was claimed concurrently. Refresh.'},409);
    throw error;
  }
}
