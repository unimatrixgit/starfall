// Deliver staff Havoc changes once to every owner, including an already-open game.
function queueHavocOverride(){
 const id=crypto.randomUUID();
 state.localHavocRequest=id;
 for(const p of state.galaxy)p.adminHavocRequest={id,tickHours:state.config.tickHours};
 if(typeof queuePlanetDirectorySync==='function')queuePlanetDirectorySync();
}
function applyCentralHavocOverride(planet){
 const command=planet.havocOverride;
 if(!command||command.id===state.appliedHavocOverride||(command.resetEpoch||0)!==(state.resetEpoch||0))return false;
 const values=command.values;
 if(command.requestId!==state.localHavocRequest){
 for(const key of ['resources','roids','research','buildings'])if(values[key])state[key]=copy(values[key]);
 state.population=values.population;state.biodomeDamage=values.biodomeDamage||0;
 state.fleets.base=normalizeFleet(copy(values.ships||{}));state.ships=copy(state.fleets.base);
 state.researchActive=null;state.researchProgress={};state.construction=null;
 state.config.tickHours=command.tickHours;state.nextTickAt=Date.now()+gameTickMs();
 }
 for(const [local,remote] of [['appliedBankTrades','bankTradeTotal'],['appliedAllianceIncomeTax','allianceIncomeTaxTotal'],['appliedEarthSalvage','earthSalvageTotal'],['appliedGalaxyAid','galaxyAidTotal']])state[local]=copy(command[remote]||{});
 state.appliedPopulationTaxTotal=command.populationTaxTotal||0;
 state.appliedHavocOverride=command.id;
 save();return true;
}
