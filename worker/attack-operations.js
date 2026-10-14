// pa-tools attack/booking workflow adapted for Starfall's Worker runtime.
// Reference: liamrigg/pa-tools, 564f02157c7c028beb57c16b4c8a2c02869b35ba.
async function ensureAttackOperations(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS alliance_attack_operations(id TEXT PRIMARY KEY,alliance_id TEXT NOT NULL,generation INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 0,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS alliance_attack_operations_scope ON alliance_attack_operations(alliance_id,generation,created_at)').run();
}
function attackOperationPhase(op,now=Date.now()){return op.closed?'Closed':!op.releaseAt||op.releaseAt<=now?'Open':op.prereleaseAt&&op.prereleaseAt<=now?'Prereleased':'Scheduled';}
function attackCoordinateOrder(a,b){const x=a.coords.split(':').map(Number),y=b.coords.split(':').map(Number);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];}
function attackBooking(id,tick){return {id,landTick:tick,ownerId:null,ownerName:'',users:[],notes:'',battleCalc:'',group:'',groupId:null,status:'none'};}
async function attackOperationMembers(env,alliance){return (await env.DB.prepare("SELECT DISTINCT u.id,u.username FROM portal_users u JOIN planet_directory p ON p.owner_id=u.id WHERE p.kind='planet' AND json_extract(p.data_json,'$.alliance')=? ORDER BY u.username").bind(alliance).all()).results;}
async function importLegacyAttackTargets(env,allianceId,generation){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='alliance_attack_targets'").first();if(!exists)return;
 const rows=(await env.DB.prepare("SELECT * FROM alliance_attack_targets WHERE alliance_id=? AND status='Open'").bind(allianceId).all()).results;
 for(const row of rows){const id='legacy-'+generation+'-'+row.id,booking={...attackBooking(id+'-wave',1),ownerId:row.claim_user_id||null,ownerName:row.claim_name||'',status:row.claim_user_id?'none':'none'},op={id,title:row.title,notes:row.notes,landTick:1,waves:1,releaseAt:null,prereleaseAt:null,closed:false,legacy:true,targets:[{id:id+'-target',coords:row.target_coords,bookings:[booking]}]};await env.DB.prepare('INSERT OR IGNORE INTO alliance_attack_operations VALUES(?,?,?,0,?,?,?)').bind(id,allianceId,generation,JSON.stringify(op),row.created_at,Date.now()).run();}
}
async function attackOperationsAPI(request,env){
 const user=await portalUser(request,env);if(!user)return json({error:'Sign in first.'},401);
 const access=await centralAllianceAccess(user,env);if(!access)return json({error:'Join an alliance first.'},403);
 await ensureAttackOperations(env);const meta=await env.DB.prepare('SELECT * FROM planet_directory_meta WHERE id=1').first(),generation=meta.reset_generation||0,allianceId=access.alliance.registryId||access.alliance.name,canManage=centralIntelPermission(access,'attack'),canClaim=centralIntelPermission(access,'attackClaim');
 const members=await attackOperationMembers(env,access.alliance.name),memberIds=new Set(members.map(m=>m.id));
 if(request.method==='GET'){
  await importLegacyAttackTargets(env,allianceId,generation);const rows=(await env.DB.prepare('SELECT * FROM alliance_attack_operations WHERE alliance_id=? AND generation=? ORDER BY created_at DESC LIMIT 100').bind(allianceId,generation).all()).results;
  const operations=rows.map(r=>({...JSON.parse(r.data_json),revision:r.revision,phase:attackOperationPhase(JSON.parse(r.data_json))})).map(op=>op.phase==='Scheduled'&&!canManage?{id:op.id,title:op.title,releaseAt:op.releaseAt,prereleaseAt:op.prereleaseAt,landTick:op.landTick,waves:op.waves,phase:op.phase,revision:op.revision,targets:[],notes:''}:op);
  const groupRow=await env.DB.prepare('SELECT data_json FROM alliance_battlegroups WHERE alliance_id=? AND generation=?').bind(allianceId,generation).first(),battlegroups=groupRow?JSON.parse(groupRow.data_json):[];
  for(const operation of operations)for(const target of operation.targets)for(const booking of target.bookings)if(booking.groupId)booking.group=battlegroups.find(g=>g.id===booking.groupId)?.name||'Unavailable battlegroup';
  return json({generation,userId:user.id,canManage,canClaim,members,operations,battlegroups:battlegroups.filter(g=>g.members.some(m=>m.userId===user.id&&m.status==='accepted')).map(g=>({id:g.id,name:g.name})),source:{name:'pa-tools',url:'https://bitbucket.org/liamrigg/pa-tools',commit:'564f02157c7c028beb57c16b4c8a2c02869b35ba'}});
 }
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 const raw=await request.text();if(raw.length>50000)return json({error:'Operation request is too large.'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid operation request.'},400);}
 if(body.generation!==generation)return json({error:'Round changed. Refresh the attack planner.'},409);
 if(body.action==='create'){
  if(!canManage)return json({error:'Attack management permission required.'},403);
  if(!safeDirectoryName(body.title,80)||typeof body.notes!=='string'||body.notes.length>4000||!Number.isSafeInteger(body.landTick)||body.landTick<1||body.landTick>1000000||!Number.isInteger(body.waves)||body.waves<1||body.waves>10||!Array.isArray(body.targets)||!body.targets.length||body.targets.length>50)return json({error:'Use a title, 1–50 targets, a land tick and 1–10 waves.'},400);
  const coords=[...new Set(body.targets)];if(coords.some(c=>!validDirectoryCoords(c,'planet')))return json({error:'Use valid planet coordinates.'},400);
  const planets=(await env.DB.prepare("SELECT coords,data_json FROM planet_directory WHERE kind='planet'").all()).results;
  if(coords.some(c=>!planets.some(p=>p.coords===c)))return json({error:'Every target must be a registered planet.'},400);
  const releaseAt=body.releaseAt||null,prereleaseAt=body.prereleaseAt||null;if([releaseAt,prereleaseAt].some(t=>t!==null&&(!Number.isSafeInteger(t)||t<0||t>Date.now()+365*86400000))||prereleaseAt&&(!releaseAt||prereleaseAt>=releaseAt))return json({error:'Prerelease must precede the scheduled opening.'},400);
  const id=crypto.randomUUID(),now=Date.now(),op={id,title:body.title.trim(),notes:body.notes,landTick:body.landTick,waves:body.waves,releaseAt,prereleaseAt,closed:false,targets:coords.map(c=>({id:crypto.randomUUID(),coords:c,bookings:Array.from({length:body.waves},(_,i)=>attackBooking(crypto.randomUUID(),body.landTick+i))})).sort(attackCoordinateOrder)};
  const result=await env.DB.prepare('INSERT INTO alliance_attack_operations SELECT ?,?,?,0,?,?,? WHERE EXISTS(SELECT 1 FROM planet_directory_meta WHERE id=1 AND reset_generation=?)').bind(id,allianceId,generation,JSON.stringify(op),now,now,generation).run();if(!(result.meta?.changes??result.changes))return json({error:'Round changed. Refresh before creating an operation.'},409);return json({ok:true,id});
 }
 const row=await env.DB.prepare('SELECT * FROM alliance_attack_operations WHERE id=? AND alliance_id=? AND generation=?').bind(String(body.id||''),allianceId,generation).first();if(!row)return json({error:'Operation not found.'},404);
 if(body.revision!==row.revision)return json({error:'The booking changed. Refresh and review.'},409);
 const op=JSON.parse(row.data_json),phase=attackOperationPhase(op);let groupFence=null;if(phase==='Closed'&&body.action!=='reopen')return json({error:'This operation is closed.'},409);
 if(['close','reopen','release','wave','removeWave','edit','targets','removeTarget'].includes(body.action)){
  if(!canManage)return json({error:'Attack management permission required.'},403);
  if(body.action==='close')op.closed=true;if(body.action==='reopen')op.closed=false;if(body.action==='release'){op.releaseAt=null;op.prereleaseAt=null;}
  if(body.action==='wave'){if(op.waves>=10)return json({error:'Maximum ten waves per operation.'},400);for(const t of op.targets)t.bookings.push(attackBooking(crypto.randomUUID(),op.landTick+op.waves));op.waves++;}
  if(body.action==='removeWave'){if(op.waves<=1)return json({error:'Keep at least one wave.'},400);if(op.targets.some(t=>t.bookings[t.bookings.length-1]?.ownerId))return json({error:'The last wave is booked; release its bookings before removing it.'},409);for(const t of op.targets)t.bookings.pop();op.waves--;}
  if(body.action==='edit'){if(!safeDirectoryName(body.title,80)||typeof body.notes!=='string'||body.notes.length>4000||!Number.isSafeInteger(body.landTick)||body.landTick<1||body.landTick>1000000)return json({error:'Use a valid title, notes and land tick.'},400);if(body.landTick!==op.landTick&&op.targets.some(t=>t.bookings.some(b=>b.ownerId)))return json({error:'Release bookings before changing their land ticks.'},409);op.title=body.title;op.notes=body.notes;op.landTick=body.landTick;for(const t of op.targets)t.bookings.forEach((b,i)=>b.landTick=op.landTick+i);}
  if(body.action==='targets'){if(!Array.isArray(body.targets)||!body.targets.length||body.targets.length>50||body.targets.some(c=>!validDirectoryCoords(c,'planet')))return json({error:'Use 1–50 valid target coordinates.'},400);const coords=[...new Set(body.targets)].filter(c=>!op.targets.some(t=>t.coords===c));if(op.targets.length+coords.length>50)return json({error:'Maximum fifty targets per operation.'},400);const known=(await env.DB.prepare("SELECT coords FROM planet_directory WHERE kind='planet'").all()).results;if(coords.some(c=>!known.some(p=>p.coords===c)))return json({error:'Every target must be a registered planet.'},400);for(const c of coords)op.targets.push({id:crypto.randomUUID(),coords:c,bookings:Array.from({length:op.waves},(_,i)=>attackBooking(crypto.randomUUID(),op.landTick+i))});op.targets.sort(attackCoordinateOrder);}
  if(body.action==='removeTarget'){const target=op.targets.find(t=>t.id===body.targetId);if(!target)return json({error:'Target not found.'},404);if(op.targets.length<=1)return json({error:'Keep one target or close the operation.'},400);if(target.bookings.some(b=>b.ownerId))return json({error:'Release the target bookings before removing it.'},409);op.targets=op.targets.filter(t=>t.id!==body.targetId);}
 }else{
  if(!['claim','drop','booking','share','transfer'].includes(body.action))return json({error:'Unknown booking action.'},400);
  if(!['Open','Prereleased'].includes(phase))return json({error:'This operation has not been released yet.'},409);
  const booking=op.targets.flatMap(t=>t.bookings).find(b=>b.id===body.bookingId);if(!booking)return json({error:'Booking not found.'},404);
  if(body.action==='claim'){if(!canClaim)return json({error:'Your alliance rank cannot book waves.'},403);if(booking.ownerId)return json({error:'This wave has already been claimed.'},409);booking.ownerId=user.id;booking.ownerName=user.username;booking.status='none';}
  else{
   const owner=booking.ownerId===user.id,participant=owner||booking.users.includes(user.id);if(!participant)return json({error:'Only the owner or shared booking users can edit this booking.'},403);
   if(body.action==='drop'){if(!owner){booking.users=booking.users.filter(id=>id!==user.id);}else{if(booking.users.length)return json({error:'Transfer ownership before dropping a shared booking.'},409);Object.assign(booking,{ownerId:null,ownerName:'',status:'none',notes:'',battleCalc:'',group:'',groupId:null});}}
   if(body.action==='transfer'){if(!owner||!memberIds.has(body.userId)||body.userId===user.id)return json({error:'Only the owner can transfer to another current alliance member.'},403);if(booking.groupId){try{const link=await battlegroupBookingLink(env,allianceId,generation,booking.groupId,body.userId,memberIds);groupFence=link.registryRevision;booking.group=link.group;}catch(e){return json({error:e.message},e.status||400);}}booking.users=[...new Set([...booking.users.filter(id=>id!==body.userId),user.id])];booking.ownerId=body.userId;booking.ownerName=members.find(m=>m.id===body.userId).username;}
   if(body.action==='share'){if(!owner||!Array.isArray(body.users)||body.users.length>20||body.users.some(id=>!memberIds.has(id)||id===user.id))return json({error:'The owner may share with up to twenty current alliance members.'},400);booking.users=[...new Set(body.users)];}
   if(body.action==='booking'){
    if(!['none','land','recall'].includes(body.status)||typeof body.notes!=='string'||body.notes.length>2000||typeof body.battleCalc!=='string'||body.battleCalc.length>2000||body.group!==undefined&&(typeof body.group!=='string'||body.group.length>80))return json({error:'Use a booking status and bounded notes, group and calculator reference.'},400);
    const desired=body.groupId===undefined?(booking.groupId||null):body.groupId;
    if(!owner&&desired!==(booking.groupId||null))return json({error:'Only the booking owner may change its battlegroup.'},403);
    if(desired){try{const link=await battlegroupBookingLink(env,allianceId,generation,desired,booking.ownerId,memberIds);groupFence=link.registryRevision;booking.groupId=link.groupId;booking.group=link.group;}catch(e){return json({error:e.message},e.status||400);}}
    else{booking.groupId=null;if(body.groupId!==undefined)booking.group='';else if(body.group!==undefined)booking.group=body.group;}
    booking.status=body.status;booking.notes=body.notes;booking.battleCalc=body.battleCalc;
   }
  }
 }
 const fence=groupFence===null?'':' AND EXISTS(SELECT 1 FROM alliance_battlegroups WHERE alliance_id=? AND generation=? AND revision=?)',args=[JSON.stringify(op),Date.now(),row.id,allianceId,generation,row.revision,generation];if(groupFence!==null)args.push(allianceId,generation,groupFence);
 const result=await env.DB.prepare('UPDATE alliance_attack_operations SET revision=revision+1,data_json=?,updated_at=? WHERE id=? AND alliance_id=? AND generation=? AND revision=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE id=1 AND reset_generation=?)'+fence).bind(...args).run();if(!(result.meta?.changes??result.changes))return json({error:'The booking, battlegroup or round changed. Refresh and review.'},409);return json({ok:true,revision:row.revision+1});
}
