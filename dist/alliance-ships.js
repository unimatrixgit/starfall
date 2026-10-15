/* SF-100: provenance belongs to the existing fourth fleet, never a fifth fleet. */
let allianceShipSyncFlight=null;
function applyAllianceShipCounters(data){const old={fleets:state.fleets,missions:state.missions,ledger:state.allianceShipLedger};state.fleets=JSON.parse(JSON.stringify(old.fleets));state.missions=JSON.parse(JSON.stringify(old.missions));state.allianceShipLedger=old.ledger?JSON.parse(JSON.stringify(old.ledger)):undefined;try{return stageAllianceShipCounters(data);}catch(error){state.fleets=old.fleets;state.missions=old.missions;state.allianceShipLedger=old.ledger;throw error;}}
function allianceShipContext(){return [state.centralPlayerId||'',state.centralResetGeneration||0,state.resetEpoch||0,state.galaxy.find(p=>p.player)?.id||'',state.alliance?.registryId||state.alliance?.name||''].join('|');}
function allianceShipPhysical(id){return (state.fleets.f4?.[id]||0)+state.missions.filter(m=>m.fleet==='f4').reduce((sum,m)=>sum+(m.ships[id]||0),0);}
function allianceShipLocked(id){return Math.max(0,state.allianceShipLedger?.locked?.[id]||0);}
function allianceShipDocked(id){const away=state.missions.filter(m=>m.fleet==='f4').reduce((sum,m)=>sum+(m.allianceShips?.[id]||0),0);return Math.min(state.fleets.f4?.[id]||0,Math.max(0,allianceShipLocked(id)-away));}
function allianceShipTransferable(id,from){return Math.max(0,(state.fleets[from]?.[id]||0)-(from==='f4'?allianceShipDocked(id):0));}
function removePhysicalAllianceShips(id,quantity){let left=quantity;const dock=Math.min(allianceShipDocked(id),left);state.fleets.f4[id]=(state.fleets.f4[id]||0)-dock;left-=dock;for(const m of state.missions.filter(m=>m.fleet==='f4')){const n=Math.min(m.allianceShips?.[id]||0,m.ships[id]||0,left);m.ships[id]-=n;m.allianceShips[id]-=n;left-=n;}return quantity-left;}
function stageAllianceShipCounters(data){
 const home=state.galaxy.find(p=>p.player),inventory=data.inventory;
 if(data.allianceName!==state.alliance.name||state.alliance.registryId&&data.allianceId!==state.alliance.registryId)throw Error('Alliance ship membership changed.');
 if(data.generation!==(state.centralResetGeneration||0)||inventory&&(inventory.planetId!==home?.id||inventory.ownerId!==state.centralPlayerId||(inventory.resetEpoch||0)!==(state.resetEpoch||0)))throw Error('Alliance ship ownership changed. Refresh game data.');
 const context=allianceShipContext();let ledger=state.allianceShipLedger;
 if(ledger&&ledger.context!==context){for(const [id,n] of Object.entries(ledger.locked||{}))removePhysicalAllianceShips(id,n);ledger=null;}
 ledger=state.allianceShipLedger=ledger||{context,locked:{},deliveries:{},removals:{},losses:[]};
 if(!inventory){ledger.revision=data.revision;save();return;}
 state.fleets.f4=state.fleets.f4||{};
 for(const id of new Set([...Object.keys(inventory.deliveryTotals||{}),...Object.keys(inventory.removalTotals||{})])){
  if(!SHIPS[id])continue;
  const delivered=inventory.deliveryTotals?.[id]||0,removed=inventory.removalTotals?.[id]||0;
  if(!Number.isSafeInteger(delivered)||!Number.isSafeInteger(removed)||delivered<0||removed<0||delivered<(ledger.deliveries[id]||0)||removed<(ledger.removals[id]||0))throw Error('Alliance ship counters moved backwards.');
  const add=delivered-(ledger.deliveries[id]||0),take=removed-(ledger.removals[id]||0);
  state.fleets.f4[id]=(state.fleets.f4[id]||0)+add;ledger.locked[id]=(ledger.locked[id]||0)+add;
  if(take>ledger.locked[id])throw Error('Alliance ship removal requires reconciliation.');
  if(take){removePhysicalAllianceShips(id,take);ledger.locked[id]-=take;}
  ledger.deliveries[id]=delivered;ledger.removals[id]=removed;
 }
 ledger.revision=data.revision;ledger.allianceId=data.allianceId;save();
}
async function syncAllianceShips(){
 if(allianceShipSyncFlight)return allianceShipSyncFlight;
 if(!state.centralPlayerId||!state.alliance?.name||state.alliance.name==='Unaffiliated')return false;
 const context=allianceShipContext();
 allianceShipSyncFlight=(async()=>{
  let data=await centralDirectoryRequest('/api/alliance-shipyards?mine=1');if(context!==allianceShipContext())throw Error('Alliance ship context changed.');
  const ledger=state.allianceShipLedger;
  if(ledger?.context===context)for(const loss of [...ledger.losses]){
   await centralDirectoryRequest('/api/alliance-shipyards',{id:loss.id,action:'loss',generation:data.generation,revision:data.revision,directoryRevision:data.directoryRevision,items:loss.items});
   if(context!==allianceShipContext())throw Error('Alliance ship context changed.');
   for(const item of loss.items)ledger.removals[item.shipId]=(ledger.removals[item.shipId]||0)+item.quantity;
   ledger.losses=ledger.losses.filter(x=>x.id!==loss.id);save();
   data=await centralDirectoryRequest('/api/alliance-shipyards?mine=1');
  }
  if(context!==allianceShipContext())throw Error('Alliance ship context changed.');applyAllianceShipCounters(data);return true;
 })().finally(()=>{allianceShipSyncFlight=null;});return allianceShipSyncFlight;
}
function recordAllianceShipCombatLoss(m,before){
 if(m.fleet!=='f4'||!state.allianceShipLedger)return;
 const items=[],home=state.galaxy.find(p=>p.player),ledger=state.allianceShipLedger;
 for(const [id,n] of Object.entries(before)){
  const old=m.allianceShips?.[id]||0,dead=Math.max(0,n-(m.ships[id]||0));
  const lost=Math.min(old,dead,Math.ceil(dead*old/Math.max(1,n)));
  if(!lost)continue;m.allianceShips[id]=old-lost;ledger.locked[id]=Math.max(0,(ledger.locked[id]||0)-lost);items.push({shipId:id,quantity:lost,planetId:home.id});
 }
 if(items.length){ledger.losses.push({id:crypto.randomUUID(),items});save();}
}
const resolveAttackBeforeAllianceShips=resolveAttack;
resolveAttack=function(m){const before={...m.ships};const result=resolveAttackBeforeAllianceShips.apply(this,arguments);recordAllianceShipCombatLoss(m,before);return result;};
