#!/usr/bin/env node
'use strict';
// Read-only, offline observations. This deliberately does not register node:test cases.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const testFile = path.join(root, 'tests/game.test.cjs');
const source = fs.readFileSync(testFile, 'utf8');
const start = source.indexOf('function game(saved');
const end = source.indexOf("test('migrates", start);
if (start < 0 || end < 0) throw new Error('Offline game helper boundary changed; audit needs review.');
const helper = source.slice(start, end).replace("../dist/game.js", '../app-src/game/game.js');
const harness = vm.createContext({fs, path, vm, console, __dirname: path.dirname(testFile)});
vm.runInContext(helper + '\nthis.createAuditGame = game;', harness);
const create = () => harness.createAuditGame();
const observations = [];
{
  const g = create();
  g.run('state.construction={id:"biodome",total:250,remaining:250,cost:{metal:300,crystal:200,eonium:100}}');
  const before = JSON.parse(g.run('JSON.stringify(state.construction)'));
  g.run('constructionHTML()');
  const after = JSON.parse(g.run('JSON.stringify(state.construction)'));
  observations.push({id:'SF068-E01',name:'Rendering construction preserves work',defectObserved:before.remaining!==after.remaining||before.total!==after.total,before,after});
}
{
  const g = create();
  g.run('update=()=>{};state.buildings=Object.fromEntries(Object.keys(BUILDINGS).map(k=>[k,0]));state.buildings.biodome=19;state.construction={id:"biodome",total:250,remaining:250,cost:{}};state.startupBonusGranted=true;state.questBonuses={construction:250};');
  g.document.querySelectorAll=()=>[{dataset:{bonusCu:'biodome'},value:'250'}];
  g.run('allocateQuestBonus("construction")');
  const after=JSON.parse(g.run('JSON.stringify({built:state.buildings.biodome,pending:(state.construction?1:0)+state.constructionQueue.length,limit:buildingLimit(),unusedCU:state.questBonuses.construction})'));
  observations.push({id:'SF068-E02',name:'Bonus construction respects reserved facility slots',defectObserved:after.built+after.pending>after.limit,setup:{built:19,pending:1,limit:20,allocateCU:250},after});
}
{
  const g = create();
  g.run('state.research.fighter=3');
  const after=JSON.parse(g.run('JSON.stringify({hullLevel:state.research.fighter,branches:TECH_TREE.map(t=>t.id),mediumFactory:bonusBuildingAvailable("mediumFactory"),heavyFactory:bonusBuildingAvailable("heavyFactory"),structureDefense:bonusBuildingAvailable("structureDefense")})'));
  observations.push({id:'SF068-E03',name:'Completed hull research unlocks corresponding bonus structures',defectObserved:!after.mediumFactory||!after.heavyFactory||!after.structureDefense,after});
}

// Military observations use isolated local state, never a real scan or charge.
{
 const g=create();g.run('update=()=>{};mayGalaxyScan=()=>true;scannerFundingSource=()=>"personal";canAffordScan=()=>true;payScan=b=>{state.auditCharge=b.metal};state.userSettings.allianceScansEnabled=true;state.buildings.waveAmplifier=1;state.research.scans=7;state.missions=[];state.waves.scans=[];state.galaxy=state.galaxy.slice(0,2)');
 g.document.querySelector=()=>({value:'all'});g.run('runGalaxyScan()');
 const after=JSON.parse(g.run('JSON.stringify({chargedEach:state.auditCharge,landing:state.waves.scans.some(s=>s.type==="landing"),incoming:state.waves.scans.some(s=>s.type==="incoming"),missions:state.missions.length})'));
 observations.push({id:'SF068-M01',name:'Galaxy sweep respects special fleet eligibility',defectObserved:after.missions===0&&(after.landing||after.incoming),after});
}
{
 const g=create();g.run('var peer=state.galaxy.find(p=>!p.player);peer.ships={"terran-lumen":99};peer.covert={guards:77};peer.guards=77;state.missions=[];var jump=scanData(peer.id,"jumpgate"),planetReport=scanData(peer.id,"planet");state.missions=[{targetId:state.galaxy.find(p=>p.player).id,ships:{"terran-lumen":17},phase:"outbound",eta:2,mission:"Attack"}];var incoming=scanData(state.galaxy.find(p=>p.player).id,"incoming")');
 observations.push({id:'SF068-M02',name:'Jumpgate reports travelling fleets rather than docked ships',defectObserved:g.run('jump.includes("Lumen: 99")'),after:{missionsAtScan:0,dockedLumen:99,reportedDockedComposition:g.run('jump.includes("Lumen: 99")')}});
 observations.push({id:'SF068-M03',name:'Incoming report includes known incoming composition',defectObserved:!g.run('incoming.includes("Lumen: 17")'),after:{knownIncomingLumen:17,reportsSeventeen:g.run('incoming.includes("Lumen: 17")'),reportsZero:g.run('incoming.includes("Lumen: 0")')}});
 observations.push({id:'SF068-M04',name:'Generated reports contain actual line breaks',defectObserved:g.run('planetReport.includes(String.fromCharCode(92)+"n")'),after:{actualLineBreaks:g.run('planetReport.includes(String.fromCharCode(10))')}});
 observations.push({id:'SF068-M05',name:'Planet report includes promised known guards',defectObserved:!g.run('/guards/i.test(planetReport)'),after:{knownGuards:77,reportsGuards:g.run('/guards/i.test(planetReport)')}});
}
{
 const g=create();g.run('update=()=>{};ensureGalaxyPolitics=()=>{};planetScore=()=>1000;state.alliance.fund={metal:1000,crystal:1000,eonium:1000};state.galaxyFund={metal:5000,crystal:5000,eonium:5000};state.politics.exileCount=0;state.politics.votesToExile=[];var target=state.galaxy.find(p=>!p.player);');
 g.document.getElementById('exileTarget').value=g.run('target.id');g.document.getElementById('exileReason').value='Offline audit';g.run('politicsAction("exile")');
 const after=JSON.parse(g.run('JSON.stringify({allianceMetal:state.alliance.fund.metal,galaxyMetal:state.galaxyFund.metal,votes:state.politics.votesToExile.length})'));
 observations.push({id:'SF068-SOC03',name:'Exile funding debits Galaxy Fund',defectObserved:after.allianceMetal<1000&&after.galaxyMetal===5000,after});
}
{
 const g=create();g.run('update=()=>{};ensureGalaxyPolitics=()=>{};state.politics.gc="Other";state.politics.ministers={development:"Other"};state.politics.allowedFund={metal:true}');g.document.querySelectorAll=()=>[{dataset:{fundallow:'metal'},checked:false}];g.run('politicsAction("fund")');
 observations.push({id:'SF068-SOC05',name:'Only authorised minister changes donation policy',defectObserved:g.run('state.politics.allowedFund.metal===false'),after:{ordinaryPlayerChangedPolicy:g.run('state.politics.allowedFund.metal===false')}});
}
console.log(JSON.stringify({audit:'SF-068',scope:'offline canonical economy, scans and galaxy governance; no network, account, or persisted save writes',defectsObserved:observations.filter(o=>o.defectObserved).length,observations},null,2));
