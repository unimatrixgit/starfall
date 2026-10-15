/* SF-100 draft. Compose after shipyards-catalog.js and existing alliance helpers. */
const SHIPYARD_RESOURCES=['metal','crystal','eonium'];
const SHIPYARD_FACTORIES=['lightFactory','mediumFactory','heavyFactory'];
const SHIPYARD_COMMAND_ROLES=['Owner','HC','Officer'];
function shipyardCopy(value){return JSON.parse(JSON.stringify(value));}
function shipyardInputError(message){return Object.assign(Error(message),{status:400});}
function shipyardCanonical(value){if(Array.isArray(value))return value.map(shipyardCanonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,shipyardCanonical(value[k])]));return value;}
function shipyardRequestJSON(body){return JSON.stringify(shipyardCanonical({...body,revision:undefined,directoryRevision:undefined}));}
function shipyardCount(value){return Number.isSafeInteger(value)&&value>=0&&value<=1e9;}
function shipyardInventoryKey(planet){return planet.id+':'+planet.ownerId+':'+(planet.resetEpoch||0);}
function shipyardClock(members){return members.length?Math.max(...members.map(p=>Math.max(1,Math.min(10000,Math.floor(p.publicTick||1))))):1;}
function shipyardFactorySnapshot(members){
 const count={lightFactory:0,mediumFactory:0,heavyFactory:0},weighted={lightFactory:0,mediumFactory:0,heavyFactory:0};
 const raceBonus={Terran:10,Cathaar:0,Xandathrii:5,Zikonian:15,Eitraides:0};
 for(const p of members)for(const factory of SHIPYARD_FACTORIES){const n=Math.max(0,Math.min(1e5,Math.floor(p.buildings?.[factory]||0))),bonus=Math.max(0,Math.min(60,p.workforce?.shipwright||0))+(raceBonus[p.race]||0);count[factory]+=n;weighted[factory]+=n*Math.max(0,1+bonus/100);}
 const rates=Object.fromEntries(SHIPYARD_FACTORIES.map(factory=>[factory,count[factory]?Math.floor((4000*count[factory])**.98*(weighted[factory]/count[factory])):0]));
 return {count,rates,fingerprint:JSON.stringify([count,rates])};
}
function shipyardUnlocked(ship,members){const hull={Fighter:1,Corvette:1,Frigate:2,Destroyer:2,Cruiser:3,Battleship:3}[ship.class]||1;return members.some(p=>p.race===ship.race&&(p.research?.fighter||0)>=hull&&(!ship.pod||(p.research?.cargo||0)>=1));}
function shipyardInventory(board,planet){const key=shipyardInventoryKey(planet);board.inventory[key]??={planetId:planet.id,ownerId:planet.ownerId,resetEpoch:planet.resetEpoch||0,available:{},deliveryTotals:{},removalTotals:{}};return board.inventory[key];}
function shipyardDeliver(board,planet,shipId,quantity){const inventory=shipyardInventory(board,planet);inventory.available[shipId]=(inventory.available[shipId]||0)+quantity;inventory.deliveryTotals[shipId]=(inventory.deliveryTotals[shipId]||0)+quantity;}
function shipyardRemove(inventory,shipId,quantity){if((inventory.available[shipId]||0)<quantity)throw shipyardInputError('Insufficient Alliance Ships provenance.');inventory.available[shipId]-=quantity;inventory.removalTotals[shipId]=(inventory.removalTotals[shipId]||0)+quantity;}
function shipyardPrices(items,sale=false){const total={metal:0,crystal:0,eonium:0};for(const item of items){const ship=SHIPYARD_CATALOG[item.shipId];for(const k of SHIPYARD_RESOURCES)total[k]+=sale?Math.floor(ship.cost[k]*item.quantity*.5):ship.cost[k]*item.quantity;}return total;}
function shipyardNormalizeItems(input,members){
 if(!Array.isArray(input)||input.length<1||input.length>200)throw shipyardInputError('Choose between 1 and 200 hull allocations.');
 const seen=new Set();return input.map(item=>{const ship=SHIPYARD_CATALOG[item?.shipId],planet=members.find(p=>p.id===item?.planetId),key=item?.planetId+'|'+item?.shipId;if(!ship||!planet||!shipyardCount(item.quantity)||item.quantity<1||item.quantity>20000||seen.has(key))throw shipyardInputError('Choose valid member destinations and whole hull quantities.');seen.add(key);return {shipId:ship.id,quantity:item.quantity,planetId:planet.id,ownerId:planet.ownerId,resetEpoch:planet.resetEpoch||0};});
}
function shipyardResolveTarget(item,members){return members.find(p=>p.id===item.planetId&&p.ownerId===item.ownerId&&(p.resetEpoch||0)===item.resetEpoch);}
function shipyardAdvance(c){
 const board=c.board,clock=shipyardClock(c.members),factory=shipyardFactorySnapshot(c.members),elapsed=Math.max(0,clock-board.lastTick);if(!elapsed)return false;
 // A changed pool has no historic factory proof: use one observed tick, skip older gaps.
 const steps=factory.fingerprint===board.factoryFingerprint?Math.min(24,elapsed):1;
 const first=factory.fingerprint===board.factoryFingerprint?board.lastTick+1:clock;
 if(first===clock&&elapsed>1)board.skippedTicks=(board.skippedTicks||0)+elapsed-1;
 for(let index=0;index<steps;index++){
  const tick=first+index,active=board.orders.find(o=>o.status==='Queued'||o.status==='Building');
  if(active){active.status='Building';for(const key of Object.keys(active.work)){const pool=active.work[key],added=Math.max(0,factory.count[key]-(pool.preparedFactories||0));if(added){pool.total+=10000*added;pool.remaining+=10000*added;pool.preparedFactories=factory.count[key];}pool.remaining=Math.max(0,pool.remaining-(factory.rates[key]||0));}if(Object.values(active.work).every(pool=>pool.remaining<=0)){const valid=active.items.every(item=>shipyardResolveTarget(item,c.members));if(valid){for(const item of active.items)shipyardDeliver(board,shipyardResolveTarget(item,c.members),item.shipId,item.quantity);active.status='Delivered';active.completedTick=tick;}else{active.status='Escrow';active.completedTick=tick;}}}
  for(const sale of board.sales.filter(s=>s.status==='Selling'||s.status==='Returning'))if(sale.dueTick<=tick){if(sale.status==='Returning'){if(sale.items.every(item=>shipyardResolveTarget(item,c.members))){for(const item of sale.items)shipyardDeliver(board,shipyardResolveTarget(item,c.members),item.shipId,item.quantity);sale.status='Returned';sale.completedTick=tick;}else sale.status='Escrow';}else if(SHIPYARD_RESOURCES.every(k=>(c.alliance.fund[k]||0)+sale.quote[k]<=1e12)){for(const k of SHIPYARD_RESOURCES)c.alliance.fund[k]=(c.alliance.fund[k]||0)+sale.quote[k];sale.status='Paid';sale.completedTick=tick;}}
  board.lastTick=tick;
 }
 board.factoryFingerprint=factory.fingerprint;board.orders=board.orders.slice(-200);board.sales=board.sales.slice(-200);return true;
}
async function shipyardContext(user,env){
 const meta=await env.DB.prepare('SELECT * FROM planet_directory_meta WHERE id=1').first(),access=await centralAllianceAccess(user,env);if(!access)return null;
 const raw=await env.DB.prepare('SELECT data_json FROM planet_alliances WHERE name=?').bind(access.alliance.name).first();if(!raw)return null;const alliance=JSON.parse(raw.data_json),allianceId=alliance.registryId||alliance.name,generation=meta.reset_generation||0;
 const rows=(await env.DB.prepare("SELECT id,owner_id,data_json FROM planet_directory WHERE kind='planet' AND owner_id IS NOT NULL AND json_extract(data_json,'$.alliance')=?").bind(alliance.name).all()).results;
 const members=rows.map(row=>({...JSON.parse(row.data_json),id:row.id,ownerId:row.owner_id})).filter(p=>(alliance.members||[]).some(m=>m.planetId===p.id));
 const row=await env.DB.prepare('SELECT revision,data_json FROM alliance_shipyards WHERE alliance_id=? AND generation=?').bind(allianceId,generation).first();
 const board=row?JSON.parse(row.data_json):{lastTick:shipyardClock(members),factoryFingerprint:shipyardFactorySnapshot(members).fingerprint,orders:[],sales:[],inventory:{},skippedTicks:0};
 return {meta,access,rawAlliance:raw.data_json,alliance,allianceId,generation,members,row,revision:row?.revision||0,board};
}
async function shipyardCommit(env,c,command=null,response=null){
 const operation=crypto.randomUUID(),readinessSQL=(c.readinessFences||[]).map(()=>" AND EXISTS(SELECT 1 FROM alliance_fleet_readiness WHERE planet_id=? AND alliance_name=? AND data_json=? AND updated_at=?) AND NOT EXISTS(SELECT 1 FROM alliance_fleet_commands WHERE planet_id=? AND status='Pending')").join(''),readinessValues=(c.readinessFences||[]).flatMap(f=>[f.planetId,c.alliance.name,f.data,f.at,f.planetId]),statements=[env.DB.prepare('UPDATE planet_directory_meta SET revision=revision+1,operation_id=? WHERE id=1 AND revision=? AND reset_generation=? AND EXISTS(SELECT 1 FROM planet_alliances WHERE name=? AND data_json=?) AND ((?=1 AND NOT EXISTS(SELECT 1 FROM alliance_shipyards WHERE alliance_id=? AND generation=?)) OR EXISTS(SELECT 1 FROM alliance_shipyards WHERE alliance_id=? AND generation=? AND revision=?))'+readinessSQL).bind(operation,c.meta.revision,c.generation,c.alliance.name,c.rawAlliance,c.row?0:1,c.allianceId,c.generation,c.allianceId,c.generation,c.revision,...readinessValues),env.DB.prepare('INSERT INTO alliance_shipyards(alliance_id,generation,revision,data_json) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?) ON CONFLICT(alliance_id,generation) DO UPDATE SET revision=excluded.revision,data_json=excluded.data_json').bind(c.allianceId,c.generation,c.revision+1,JSON.stringify(c.board),operation),env.DB.prepare('UPDATE planet_alliances SET data_json=?,updated_at=? WHERE name=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(JSON.stringify(c.alliance),Date.now(),c.alliance.name,operation)];
 if(command)statements.push(env.DB.prepare('INSERT INTO alliance_shipyard_commands SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(command.body.id,c.allianceId,c.generation,command.user.id,shipyardRequestJSON(command.body),JSON.stringify(response),Date.now(),operation));
 const result=await env.DB.batch(statements);return (result[0].meta?.changes??result[0].changes)===1;
}
async function shipyardReadiness(env,c,items){
 for(const id of new Set(items.map(i=>i.planetId))){const row=await env.DB.prepare('SELECT data_json,updated_at FROM alliance_fleet_readiness WHERE planet_id=? AND alliance_name=?').bind(id,c.alliance.name).first(),planet=c.members.find(p=>p.id===id),snapshot=row?JSON.parse(row.data_json):null;if(!row||Date.now()-row.updated_at>300000||!snapshot||(snapshot.resetEpoch||0)!==(planet.resetEpoch||0)||snapshot.awaySlots?.includes('f4'))throw shipyardInputError('Fresh docked Alliance Fleet readiness is required before selling.');for(const item of items.filter(i=>i.planetId===id))if((snapshot.fleets?.f4?.[item.shipId]||0)<item.quantity)throw shipyardInputError('The selected hulls are not docked in this member’s Alliance Fleet.');(c.readinessFences??=[]).push({planetId:id,data:row.data_json,at:row.updated_at});}
}
async function allianceShipyardsAPI(request,env){
 const user=await portalUser(request,env);if(!user)return json({error:'Sign in first.'},401);let c=await shipyardContext(user,env);if(!c)return json({error:'Current alliance membership required.'},403);
 if(request.method==='GET'){
  const mine=new URL(request.url).searchParams.get('mine')==='1';if(!mine&&!SHIPYARD_COMMAND_ROLES.includes(c.access.member.rank))return json({error:'Shipyard command rank required.'},403);
  if(shipyardAdvance(c)){if(!await shipyardCommit(env,c))return json({error:'Shipyards changed. Refresh.'},409);c=await shipyardContext(user,env);}
  if(mine){const own=c.members.find(p=>p.ownerId===user.id);return json({generation:c.generation,revision:c.revision,directoryRevision:c.meta.revision,allianceId:c.allianceId,allianceName:c.alliance.name,inventory:own?c.board.inventory[shipyardInventoryKey(own)]||null:null});}const factory=shipyardFactorySnapshot(c.members);return json({generation:c.generation,revision:c.revision,directoryRevision:c.meta.revision,allianceId:c.allianceId,allianceName:c.alliance.name,canManage:SHIPYARD_COMMAND_ROLES.includes(c.access.member.rank),fund:c.alliance.fund,clock:shipyardClock(c.members),factories:factory,catalog:Object.values(SHIPYARD_CATALOG).filter(ship=>shipyardUnlocked(ship,c.members)||Object.values(c.board.inventory).some(row=>(row.available?.[ship.id]||0)>0)).map(ship=>({...ship,canProduce:shipyardUnlocked(ship,c.members)})),members:c.members.map(p=>({id:p.id,name:p.name,race:p.race,resetEpoch:p.resetEpoch||0})),...c.board});
 }
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 const text=await request.text();if(text.length>100000)return json({error:'Command too large.'},413);const body=JSON.parse(text),ownerLoss=body.action==='loss';if(!ownerLoss&&!SHIPYARD_COMMAND_ROLES.includes(c.access.member.rank))return json({error:'Only Owners, High Command and Officers manage Alliance Shipyards.'},403);
 if(!/^[-\w]{10,100}$/.test(body.id||'')||body.generation!==c.generation)return json({error:'Invalid command reference or round generation.'},409);
 const duplicate=await env.DB.prepare('SELECT * FROM alliance_shipyard_commands WHERE id=?').bind(body.id).first();if(duplicate){if(duplicate.alliance_id!==c.allianceId||duplicate.generation!==c.generation||duplicate.user_id!==user.id||duplicate.request_json!==shipyardRequestJSON(body))return json({error:'Command reference belongs to a different request.'},409);return json({...JSON.parse(duplicate.response_json),duplicate:true,revision:c.revision,fund:c.alliance.fund});}
 if(body.revision!==c.revision||body.directoryRevision!==c.meta.revision)return json({error:'Shipyards or membership changed. Refresh before ordering.'},409);
 try{
  if(c.board.lastTick!==shipyardClock(c.members))return json({error:'Shipyard tick catch-up is pending. Refresh until current before issuing commands.'},409);
  if(body.action==='order'){
   if(c.board.orders.filter(o=>['Queued','Building'].includes(o.status)).length>=2)return json({error:'One active and one queued shipyard order are allowed.'},409);
   const items=shipyardNormalizeItems(body.items,c.members);if(items.some(item=>!shipyardUnlocked(SHIPYARD_CATALOG[item.shipId],c.members)))return json({error:'A current member race has not unlocked that hull.'},403);
   const factory=shipyardFactorySnapshot(c.members),cost=shipyardPrices(items);if(!SHIPYARD_RESOURCES.every(k=>Number.isSafeInteger(cost[k])&&cost[k]<=1e12&&(c.alliance.fund[k]||0)-cost[k]>=(c.alliance.fundMinimum?.[k]||0)))return json({error:'Insufficient alliance reserves above minimums.'},409);
   const paid={};for(const item of items){const ship=SHIPYARD_CATALOG[item.shipId];paid[ship.factory]=(paid[ship.factory]||0)+SHIPYARD_RESOURCES.reduce((n,k)=>n+ship.cost[k]*item.quantity,0);}const work={};for(const [key,value]of Object.entries(paid)){if(!factory.count[key])return json({error:'The alliance lacks matching factories.'},409);const total=Math.sqrt(value)*Math.log(value*value)+10000*factory.count[key];work[key]={total,remaining:total,preparedFactories:factory.count[key]};}
   for(const k of SHIPYARD_RESOURCES)c.alliance.fund[k]-=cost[k];c.alliance.fundSettlementVersion=1;c.board.orders.push({id:body.id,createdBy:user.id,createdTick:shipyardClock(c.members),status:'Queued',items,cost,work});
  }else if(body.action==='cancelOrder'){
   const order=c.board.orders.find(o=>o.id===body.orderId&&['Queued','Building'].includes(o.status));if(!order)return json({error:'No cancellable order.'},409);for(const k of SHIPYARD_RESOURCES)c.alliance.fund[k]+=(Math.floor(order.cost[k]*.5));order.status='Cancelled';
  }else if(body.action==='sell'){
   const items=shipyardNormalizeItems(body.items,c.members);await shipyardReadiness(env,c,items);for(const item of items)shipyardRemove(shipyardInventory(c.board,shipyardResolveTarget(item,c.members)),item.shipId,item.quantity);c.board.sales.push({id:body.id,items,quote:shipyardPrices(items,true),createdTick:shipyardClock(c.members),dueTick:shipyardClock(c.members)+12,status:'Selling'});
  }else if(body.action==='cancelSale'){
   const sale=c.board.sales.find(s=>s.id===body.saleId&&s.status==='Selling');if(!sale)return json({error:'No cancellable sale.'},409);sale.status='Returning';sale.dueTick=shipyardClock(c.members)+12;
  }else if(ownerLoss){
   const items=shipyardNormalizeItems(body.items,c.members);if(items.some(item=>item.ownerId!==user.id))return json({error:'Only the owning player can acknowledge these combat losses.'},403);for(const item of items)shipyardRemove(shipyardInventory(c.board,shipyardResolveTarget(item,c.members)),item.shipId,item.quantity);
  }else return json({error:'Unknown shipyard action.'},400);
  if(!SHIPYARD_RESOURCES.every(k=>Number.isSafeInteger(c.alliance.fund[k]||0)&&(c.alliance.fund[k]||0)>=0&&(c.alliance.fund[k]||0)<=1e12))return json({error:'Alliance reserve limit exceeded.'},409);const response={ok:true,id:body.id,action:body.action,revision:c.revision+1,fund:c.alliance.fund};if(!await shipyardCommit(env,c,{user,body},response))return json({error:'Alliance reserves or membership changed. No command settled.'},409);return json(response);
 }catch(error){if(error.status===400)return json({error:error.message},400);console.error('Alliance Shipyard settlement failed',error?.name||'Error');return json({error:'Shipyard settlement unavailable. No automatic retry was submitted.'},503);}
}

// Reused by existing Launch Bay snapshot/launch paths; this is not another fleet.
async function shipyardFleetFence(env,alliance,generation){const row=await env.DB.prepare('SELECT revision FROM alliance_shipyards WHERE alliance_id=? AND generation=?').bind(alliance.registryId||alliance.name,generation).first();return row?{allianceId:alliance.registryId||alliance.name,generation,revision:row.revision}:null;}
