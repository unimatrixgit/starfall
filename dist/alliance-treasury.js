/* SF-068: one central receipt for every donation and structure order. */
let centralTreasuryOrdersBusy=false;
async function refreshAllianceTreasury(){
 if(!state.centralPlayerId||!planetDirectoryReady||centralTreasuryOrdersBusy)return;
 const name=state.alliance.name,generation=state.centralResetGeneration||0;
 const d=await centralDirectoryRequest('/api/alliance-treasury');
 if(name!==state.alliance.name||generation!==(state.centralResetGeneration||0)||d.alliance!==name)return;
 state.alliance.fund=d.fund;state.alliance.pendingDonations=d.pendingDonations;state.alliance.structures=d.structures;state.alliance.treasurySettlementVersion=d.treasurySettlementVersion;
 await refreshAfterCentralWrite();save();
}
async function centralTreasuryOrder(action,values){
 if(centralTreasuryOrdersBusy)return;
 const signature=JSON.stringify({action,...values}),prior=state.pendingTreasuryOrder;
 if(prior&&prior.signature!==signature)return notify('An earlier treasury order needs a retry before another order can be placed.',true);
 const pending=prior||{id:crypto.randomUUID(),signature};state.pendingTreasuryOrder=pending;save();centralTreasuryOrdersBusy=true;
 try{
  if(!await syncOwnedColony(true))throw Error('Synchronisation is still pending. Retry this order shortly.');
  await centralDirectoryRequest('/api/alliance-treasury',{action,...values,id:pending.id,generation:state.centralResetGeneration||0});
  delete state.pendingTreasuryOrder;await refreshAfterCentralWrite();save();renderAlliance();notify(action==='donate'?'Donation recorded. Arrival in 8 ticks.':'Structure paid and queued. Completion in 3 ticks.');
 }catch(error){if([400,403].includes(error.status)||(error.status===409&&!/changed|retry/i.test(error.message))){delete state.pendingTreasuryOrder;save();}notify(error.message,true);}finally{centralTreasuryOrdersBusy=false;}
}
function applyAllianceStructureGrants(planet){
 state.appliedAllianceStructures=state.appliedAllianceStructures||{};
 for(const key of ['waveAmplifier','waveDistorter']){const total=planet.allianceStructureTotal?.[key]||0,previous=state.appliedAllianceStructures[key]||0;if(total>previous)state.buildings[key]=(state.buildings[key]||0)+total-previous;state.appliedAllianceStructures[key]=total;}
}
setInterval(()=>{if(!document.hidden&&state.centralPlayerId&&isAllianceMember('A. Commander'))refreshAllianceTreasury().catch(()=>{});},10000);

