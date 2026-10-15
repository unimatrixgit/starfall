// SF-112: observed tick receipts settle with the colony and treasury in one CAS batch.
const ALLIANCE_INCOME_RESOURCES=['metal','crystal','eonium'];
function allianceIncomeZero(){return {metal:0,crystal:0,eonium:0};}
function allianceIncomeGalaxy(coords){return String(coords||'').split(':').slice(0,2).map(Number).join(':');}
function allianceIncomeAssessment(gross,enabled,rate,encouragement,stronghold){
 const ordinary=allianceIncomeZero(),bribe=allianceIncomeZero();
 for(const k of ALLIANCE_INCOME_RESOURCES){ordinary[k]=enabled?Math.floor(gross[k]*Math.max(0,Math.min(5,rate||0))/100):0;bribe[k]=stronghold?Math.floor(gross[k]*Math.max(0,Math.min(7.5,encouragement||0))/100):0;}
 return {ordinary,bribe};
}
async function allianceIncomePlan(env,p,b,previousTick,generation){
 const receipts=b.allianceIncomeTicks||[];
 if(!Array.isArray(receipts)||receipts.length>10000)return {error:'Invalid alliance income receipts.'};
 const ticks=new Set();
 for(const r of receipts){if(!r||!Number.isSafeInteger(r.tick)||r.tick<0||r.tick>b.publicTick||ticks.has(r.tick)||typeof r.enabled!=='boolean'||typeof r.alliance!=='string'||!r.gross||!ALLIANCE_INCOME_RESOURCES.every(k=>Number.isSafeInteger(r.gross[k])&&r.gross[k]>=0&&r.gross[k]<=1e12))return {error:'Invalid alliance income receipt.'};ticks.add(r.tick);}
 const row=p.alliance&&p.alliance!=='Unaffiliated'?await env.DB.prepare('SELECT data_json FROM planet_alliances WHERE name=?').bind(p.alliance).first():null;
 const ordinary=allianceIncomeZero(),bribe=allianceIncomeZero();
 if(!row)return {ordinary,bribe,statements:()=>[]};
 const a=JSON.parse(row.data_json),claim=await env.DB.prepare("SELECT galaxy FROM stronghold_claims WHERE generation=? AND alliance_id=? AND status='active'").bind(generation,a.registryId||'').first();
 const stronghold=!!claim&&allianceIncomeGalaxy(p.coords)===allianceIncomeGalaxy(claim.galaxy);
 for(const r of receipts.filter(r=>r.tick>previousTick&&r.alliance===(a.registryId||a.name))){
  const assessment=allianceIncomeAssessment(r.gross,r.enabled,a.tax,a.strongEncouragement,stronghold);
  for(const k of ALLIANCE_INCOME_RESOURCES){ordinary[k]+=assessment.ordinary[k];bribe[k]+=assessment.bribe[k];}
 }
 if(ALLIANCE_INCOME_RESOURCES.some(k=>ordinary[k]+bribe[k]>(p.resources[k]||0)))return {error:'Keep enough planetary resources to settle the pending alliance income levy, then retry.'};
 if(!ALLIANCE_INCOME_RESOURCES.some(k=>ordinary[k]+bribe[k]))return {ordinary,bribe,statements:()=>[]};
 a.fund=a.fund||allianceIncomeZero();a.fundSettlementVersion=1;
 a.incomeLedger=a.incomeLedger||{ordinary:allianceIncomeZero(),bribe:allianceIncomeZero()};
 for(const k of ALLIANCE_INCOME_RESOURCES){const debit=ordinary[k]+bribe[k];p.resources[k]-=debit;p.allianceIncomeTaxTotal={...p.allianceIncomeTaxTotal,[k]:(p.allianceIncomeTaxTotal?.[k]||0)+debit};a.fund[k]=(a.fund[k]||0)+debit;a.incomeLedger.ordinary[k]=(a.incomeLedger.ordinary[k]||0)+ordinary[k];a.incomeLedger.bribe[k]=(a.incomeLedger.bribe[k]||0)+bribe[k];}
 a.incomeLedger.lastTick=b.publicTick;
 return {ordinary,bribe,statements:op=>[env.DB.prepare('UPDATE planet_alliances SET data_json=?,updated_at=? WHERE name=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(JSON.stringify(a),Date.now(),a.name,op)]};
}
async function allianceIncomeProjection(env,a){
 const meta=await env.DB.prepare('SELECT reset_generation FROM planet_directory_meta WHERE id=1').first(),claim=await env.DB.prepare("SELECT galaxy FROM stronghold_claims WHERE generation=? AND alliance_id=? AND status='active'").bind(meta.reset_generation||0,a.registryId||'').first();
 const rows=(await env.DB.prepare("SELECT data_json FROM planet_directory WHERE kind='planet' AND json_extract(data_json,'$.alliance')=?").bind(a.name).all()).results||[],sources=[];
 for(const row of rows){const p=JSON.parse(row.data_json);if(!p.incomeReport||!ALLIANCE_INCOME_RESOURCES.every(k=>Number.isFinite(p.incomeReport[k]?.gross)))continue;sources.push({gross:Object.fromEntries(ALLIANCE_INCOME_RESOURCES.map(k=>[k,p.incomeReport[k].gross])),enabled:!!p.allianceTaxEnabled,stronghold:!!claim&&allianceIncomeGalaxy(p.coords)===allianceIncomeGalaxy(claim.galaxy),tick:p.publicTick||0});}
 return {sources,reported:sources.length,planets:rows.length,stronghold:claim?.galaxy||'',tax:a.tax||0,strongEncouragement:a.strongEncouragement||0,ledger:a.incomeLedger||{ordinary:allianceIncomeZero(),bribe:allianceIncomeZero()}};
}
// SF-068: treasury jobs are committed with balances under the directory revision fence.
const TREASURY_STRUCTURE_DEFS={transwarpHub:{name:'Transwarp Hub',share:.30,duration:12,hours:true,cooldown:12},dysonSphere:{name:'Dyson Sphere',share:.10,duration:8,cooldown:12},ancientWeapons:{name:'Ancient Weapons',share:.40,duration:4,cooldown:12},voyagerIV:{name:'Voyager IV',share:.20,building:'waveAmplifier'},solarFlares:{name:'Solar Flares',share:.20,building:'waveDistorter'}};
async function allianceTreasuryAPI(request,env){
 const user=await portalUser(request,env);if(!user)return json({error:'Sign in first.'},401);
 const access=await centralAllianceAccess(user,env);if(!access)return json({error:'Alliance membership required.'},403);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 const meta=await env.DB.prepare('SELECT * FROM planet_directory_meta WHERE id=1').first(),generation=meta.reset_generation||0;
 const raw=await env.DB.prepare('SELECT data_json FROM planet_alliances WHERE name=?').bind(access.alliance.name).first(),a=JSON.parse(raw.data_json),keys=['metal','crystal','eonium'];
 const rows=(await env.DB.prepare("SELECT * FROM planet_directory WHERE kind='planet' AND json_extract(data_json,'$.alliance')=?").bind(a.name).all()).results;
 const members=rows.map(row=>({row,p:JSON.parse(row.data_json)})),own=members.find(m=>m.row.owner_id===user.id);if(!own)return json({error:'Active membership required.'},403);
 const tick=Math.max(1,...members.map(m=>m.p.publicTick||1)),jobs=a.treasuryJobs=a.treasuryJobs||[],changed=new Map(),commands=[];let dirty=false;
 a.fund={metal:0,crystal:0,eonium:0,...a.fund};a.structures=a.structures||{};a.structures.buildQueue=a.structures.buildQueue||[];a.structures.active=a.structures.active||[];a.structures.cooldowns=a.structures.cooldowns||{};a.structures.history=a.structures.history||[];
 const structureRows=(await env.DB.prepare("SELECT * FROM planet_directory WHERE kind='structure'").all()).results;
 for(const j of jobs){
  if(j.generation!==generation)continue;
  if(j.status==='pending'&&tick>=j.due){
   dirty=true;j.status='complete';
   if(j.action==='donate')a.fund[j.resource]+=j.amount;
   else{const d=TREASURY_STRUCTURE_DEFS[j.type];if(!d)continue;a.structures.buildQueue=a.structures.buildQueue.filter(x=>x.id!==j.structureId);
    if(d.building){for(const m of members){m.p.buildings=m.p.buildings||{};m.p.buildings[d.building]=(m.p.buildings[d.building]||0)+5;m.p.allianceStructureTotal=m.p.allianceStructureTotal||{};m.p.allianceStructureTotal[d.building]=(m.p.allianceStructureTotal[d.building]||0)+5;changed.set(m.row.id,m.p);}commands.push(op=>env.DB.prepare("DELETE FROM planet_directory WHERE id=? AND kind='structure' AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)").bind(j.structureId,op));}
    else{j.status='active';j.expiresAt=j.due+(d.hours?Math.max(1,Math.ceil(d.duration/j.tickHours)):d.duration);a.structures.cooldowns[j.type]=j.due+(d.cooldown||0);a.structures.active.push({id:j.structureId,type:j.type,name:d.name,slot:j.slot,alliance:a.name,startedAt:j.due,expiresAt:j.expiresAt});const row=structureRows.find(r=>r.id===j.structureId);if(row){const p=JSON.parse(row.data_json);p.building=false;p.expiresAt=j.expiresAt;changed.set(row.id,p);}}
    a.structures.history.unshift({name:d.name,message:'Completed central build in slot '+j.slot,tick:j.due});
   }
  }
  if(j.status==='active'&&tick>=j.expiresAt){dirty=true;j.status='complete';a.structures.active=a.structures.active.filter(x=>x.id!==j.structureId);changed.delete(j.structureId);commands.push(op=>env.DB.prepare("DELETE FROM planet_directory WHERE id=? AND kind='structure' AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)").bind(j.structureId,op));}
 }
 const b=request.method==='POST'?await request.json():null;
 if(b){
  if(b.generation!==generation)return json({error:'Round changed. Refresh.'},409);
  if(!/^[-\w]{10,100}$/.test(b.id||'')||!['donate','structure'].includes(b.action))return json({error:'Invalid treasury order.'},400);
  const body=JSON.stringify({action:b.action,resource:b.resource,amount:b.amount,type:b.type,slot:b.slot}),prior=jobs.find(j=>j.id===b.id);
  if(prior){if(prior.owner!==user.id||prior.body!==body)return json({error:'Order identifier already used.'},409);}
  else{
   if(jobs.length>=10000)return json({error:'Treasury order archive is full.'},409);
   const rank=access.member.rank,permitted=a.rankPermissions?.[rank]?.[b.action==='donate'?'donate':'structures']??(b.action==='donate'?rank!=='Recruit':['Owner','HC'].includes(rank));if(!permitted)return json({error:'Your rank cannot place this treasury order.'},403);
   const job={id:b.id,owner:user.id,body,generation,action:b.action,tick,status:'pending'};
   if(b.action==='donate'){
    if(!keys.includes(b.resource)||!Number.isSafeInteger(b.amount)||b.amount<1)return json({error:'Enter a positive whole resource amount.'},400);
    const net=own.p.incomeReport?.[b.resource]?.net;if(!Number.isFinite(net)||net<0)return json({error:'Synchronise current income before donating.'},409);
    const used=jobs.filter(j=>j.generation===generation&&j.owner===user.id&&j.action==='donate'&&j.resource===b.resource&&j.at>Date.now()-86400000).reduce((n,j)=>n+j.amount,0);
    if(used+b.amount>Math.floor(net*2))return json({error:'The two-tick income allowance for the last 24 hours is exceeded.'},409);
    if((own.p.resources?.[b.resource]||0)<b.amount)return json({error:'Not enough reported planetary resources.'},409);
    own.p.resources[b.resource]-=b.amount;own.p.bankTradeTotal=own.p.bankTradeTotal||{};own.p.bankTradeTotal[b.resource]=(own.p.bankTradeTotal[b.resource]||0)-b.amount;changed.set(own.row.id,own.p);
    Object.assign(job,{resource:b.resource,amount:b.amount,at:Date.now(),due:tick+8});
   }else{
    const d=TREASURY_STRUCTURE_DEFS[b.type];if(!d||!Number.isInteger(b.slot))return json({error:'Choose a structure and slot.'},400);
    const claim=await env.DB.prepare("SELECT galaxy FROM stronghold_claims WHERE generation=? AND alliance_id=? AND status='active'").bind(generation,a.registryId||'').first();
    if(!claim||!a.tax)return json({error:'An active stronghold and ordinary tax are required.'},409);
    const gal=claim.galaxy.split(':').map(Number),slots=gal[0]===1&&gal[1]===1?[16,17,18,19,20]:[11,12,13,14,15],coords=[...gal,b.slot].map(n=>String(n).padStart(2,'0')).join(':');
    if(!slots.includes(b.slot)||structureRows.some(r=>r.coords.split(':').map(Number).join(':')===[...gal,b.slot].join(':'))||a.structures.buildQueue.some(j=>j.slot===b.slot))return json({error:'Structure slot is unavailable.'},409);
    if(a.structures.buildQueue.some(j=>j.type===b.type)||a.structures.active.some(j=>j.type===b.type)||(a.structures.cooldowns[b.type]||0)>tick)return json({error:'Structure is building, active or cooling down.'},409);
    const projection=await allianceIncomeProjection(env,a);if(!projection.reported)return json({error:'Current member income reports are required for pricing.'},409);
    const cost=Object.fromEntries(keys.map(k=>[k,Math.ceil(projection.sources.reduce((n,s)=>n+(s.enabled?Math.floor(s.gross[k]*(a.tax||0)/100):0),0)*24*d.share)]));
    if(!keys.every(k=>Number.isSafeInteger(cost[k])&&a.fund[k]>=cost[k]))return json({error:'Insufficient alliance reserves.'},409);
    for(const k of keys)a.fund[k]-=cost[k];
    Object.assign(job,{type:b.type,slot:b.slot,structureId:'structure-'+b.id,due:tick+3,cost,tickHours:Math.max(.1,Math.min(24,own.p.havocOverride?.tickHours||own.p.tickHours||DEFAULT_ROUND.config?.tickHours||1))});
    const build={id:job.structureId,type:b.type,slot:b.slot,startedAt:tick,completesAt:job.due};a.structures.buildQueue.push(build);
    const planet={...build,treasuryManaged:true,building:true,structurePlanet:true,typeName:d.name,name:d.name+' Structure Planet',ruler:a.name,alliance:a.name,coords,ships:{},resources:{metal:0,crystal:0,eonium:0},roids:{metal:0,crystal:0,eonium:0}};
    commands.push(op=>env.DB.prepare('INSERT INTO planet_directory(id,kind,coords,owner_id,data_json,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(planet.id,'structure',coords,null,JSON.stringify(planet),Date.now(),op));
   }
   jobs.push(job);dirty=true;
  }
 }
 if(dirty){
  if(!keys.every(k=>Number.isSafeInteger(a.fund[k])&&a.fund[k]>=0&&a.fund[k]<=1e12))return json({error:'Treasury capacity exceeded.'},409);
  a.fundSettlementVersion=1;a.treasurySettlementVersion=1;a.pendingDonations=[...(a.pendingDonations||[]).filter(d=>!d.id),...jobs.filter(j=>j.action==='donate'&&j.status==='pending').map(j=>({id:j.id,resource:j.resource,amount:j.amount,tick:j.due}))];a.structures.history=a.structures.history.slice(0,100);
  const op=crypto.randomUUID(),batch=[env.DB.prepare('UPDATE planet_directory_meta SET revision=revision+1,operation_id=? WHERE id=1 AND revision=? AND reset_generation=? AND EXISTS(SELECT 1 FROM planet_alliances WHERE name=? AND data_json=?)').bind(op,meta.revision,generation,a.name,raw.data_json),env.DB.prepare('UPDATE planet_alliances SET data_json=?,updated_at=? WHERE name=? AND data_json=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(JSON.stringify(a),Date.now(),a.name,raw.data_json,op),...Array.from(changed,([id,p])=>env.DB.prepare('UPDATE planet_directory SET data_json=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(JSON.stringify(p),Date.now(),id,op)),...commands.map(f=>f(op))];
  const result=await env.DB.batch(batch);if((result[0].meta?.changes??result[0].changes)!==1)return json({error:'Treasury changed. Refresh and retry the same order.'},409);
 }
 return json({ok:true,alliance:a.name,fund:a.fund,pendingDonations:a.pendingDonations||[],structures:a.structures,treasurySettlementVersion:a.treasurySettlementVersion||0});
}
