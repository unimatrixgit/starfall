// Alliance-scoped pa-tools battlegroups. One CAS document serialises membership changes.
function battlegroupChange(source,body,actor,members,manager=false){
 const groups=JSON.parse(JSON.stringify(source)),known=new Set(members.map(m=>m.id)),fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
 const membership=id=>groups.find(g=>g.members.some(m=>m.userId===id));
 if(body.action==='create'){
  if(!known.has(actor))fail('Current alliance membership required.',403);
  if(membership(actor))fail('Leave your current battlegroup first.',409);
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80||typeof body.description!=='string'||body.description.length>2000)fail('Use a name and a description of up to 2000 characters.');
  if(groups.length>=50)fail('Maximum fifty battlegroups.',409);
  if(groups.some(g=>g.name.toLowerCase()===body.name.trim().toLowerCase()))fail('That battlegroup name is already used.',409);
  groups.push({id:crypto.randomUUID(),name:body.name.trim(),description:body.description,ownerId:actor,members:[{userId:actor,status:'accepted'}]});return groups;
 }
 const g=groups.find(g=>g.id===body.groupId);if(!g)fail('Battlegroup not found.',404);
 const owner=g.ownerId===actor,manage=owner||manager,member=g.members.find(m=>m.userId===actor);
 if(body.action==='join'){
  if(!known.has(actor))fail('Current alliance membership required.',403);
  if(membership(actor))fail('You already have a battlegroup membership or request.',409);
  g.members.push({userId:actor,status:'requested'});
 }else if(body.action==='leave'){
  if(!member)fail('No membership to leave.',404);
  if(owner)fail('Transfer ownership or disband the group before leaving.',409);
  g.members=g.members.filter(m=>m.userId!==actor);
 }else if(['approve','decline','remove'].includes(body.action)){
  if(!manage)fail('Battlegroup owner permission required.',403);
  const target=g.members.find(m=>m.userId===body.userId);if(!target)fail('Membership not found.',404);
  if(target.userId===g.ownerId)fail('Transfer ownership first.',409);
  if(body.action==='approve'){if(target.status!=='requested'||!known.has(target.userId))fail('Only a current alliance member with a pending request can be approved.',409);target.status='accepted';}
  else {if(body.action==='decline'&&target.status!=='requested')fail('That membership is already accepted.',409);g.members=g.members.filter(m=>m!==target);}
 }else if(body.action==='transfer'){
  if(!owner)fail('Only the current owner can transfer ownership.',403);
  if(!known.has(body.userId)||!g.members.some(m=>m.userId===body.userId&&m.status==='accepted')||body.userId===actor)fail('Choose another accepted current alliance member.');
  g.ownerId=body.userId;
 }else if(body.action==='edit'){
  if(!manage)fail('Battlegroup owner permission required.',403);
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80||typeof body.description!=='string'||body.description.length>2000)fail('Use a valid name and description.');
  if(groups.some(x=>x.id!==g.id&&x.name.toLowerCase()===body.name.trim().toLowerCase()))fail('That name is already used.',409);
  g.name=body.name.trim();g.description=body.description;
 }else if(body.action==='disband'){
  if(!manage)fail('Battlegroup owner permission required.',403);
  return groups.filter(x=>x.id!==g.id);
 }else fail('Unknown battlegroup action.');
 return groups;
}
function battlegroupBookingAllowed(groups,groupId,actor,currentMemberIds){return groups.some(g=>g.id===groupId&&g.members.some(m=>m.userId===actor&&m.status==='accepted')&&currentMemberIds.has(actor));}
// Call after booking participant/owner guards, before modifying the operation.
// Include returned registryRevision in the operation UPDATE's EXISTS fence.
async function battlegroupBookingLink(env,allianceId,generation,groupId,actor,currentMemberIds){
 if(groupId===null||groupId==='')return {groupId:null,group:'',registryRevision:null};
 if(typeof groupId!=='string'||groupId.length>100){const e=new Error('Choose a valid battlegroup.');e.status=400;throw e;}
 const row=await env.DB.prepare('SELECT revision,data_json FROM alliance_battlegroups WHERE alliance_id=? AND generation=?').bind(allianceId,generation).first();
 const groups=row?JSON.parse(row.data_json):[];
 if(!battlegroupBookingAllowed(groups,groupId,actor,currentMemberIds)){const e=new Error('An accepted current alliance member may link their own battlegroup.');e.status=403;throw e;}
 return {groupId,group:groups.find(g=>g.id===groupId).name,registryRevision:row.revision};
}
function battlegroupRankings(groups,planets){return groups.map(g=>{const accepted=new Set(g.members.filter(m=>m.status==='accepted').map(m=>m.userId));const owned=planets.filter(p=>accepted.has(p.owner_id));return {...g,score:owned.reduce((sum,p)=>sum+Math.max(0,Number(p.score)||0),0),planetCount:owned.length};}).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));}
async function battlegroupsAPI(request,env){
 const user=await portalUser(request,env);if(!user)return json({error:'Sign in first.'},401);
 const meta=await env.DB.prepare('SELECT * FROM planet_directory_meta WHERE id=1').first();
 const access=await centralAllianceAccess(user,env);if(!access)return json({error:'Join an alliance first.'},403);
 const generation=meta.reset_generation||0,allianceId=access.alliance.registryId||access.alliance.name;
 await env.DB.prepare("INSERT OR IGNORE INTO alliance_battlegroups VALUES(?,?,0,'[]')").bind(allianceId,generation).run();
 const row=await env.DB.prepare('SELECT * FROM alliance_battlegroups WHERE alliance_id=? AND generation=?').bind(allianceId,generation).first();
 const members=await attackOperationMembers(env,access.alliance.name),groups=JSON.parse(row.data_json),canManage=centralIntelPermission(access,'attack');
 if(request.method==='GET'){
  const rows=(await env.DB.prepare("SELECT owner_id,data_json FROM planet_directory WHERE kind='planet' AND json_extract(data_json,'$.alliance')=?").bind(access.alliance.name).all()).results;
  const planets=rows.map(p=>({owner_id:p.owner_id,score:JSON.parse(p.data_json).publicScore??JSON.parse(p.data_json).score??0}));
  return json({generation,revision:row.revision,userId:user.id,canManage,members,groups:battlegroupRankings(groups,planets),rankingBasis:'Current registered planet scores; pending members excluded.'});
 }
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 const raw=await request.text();if(raw.length>10000)return json({error:'Request too large.'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 if(body.generation!==generation||body.revision!==row.revision)return json({error:'Battlegroups or round changed. Refresh and review.'},409);
 let next;try{next=battlegroupChange(groups,body,user.id,members,canManage);}catch(e){return json({error:e.message},e.status||400);}
 const result=await env.DB.prepare('UPDATE alliance_battlegroups SET revision=revision+1,data_json=? WHERE alliance_id=? AND generation=? AND revision=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE id=1 AND reset_generation=? AND revision=?)').bind(JSON.stringify(next),allianceId,generation,row.revision,generation,meta.revision).run();
 if(!(result.meta?.changes??result.changes))return json({error:'Battlegroups or round changed. Refresh and review.'},409);
 return json({ok:true,revision:row.revision+1});
}
