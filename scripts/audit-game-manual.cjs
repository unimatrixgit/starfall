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
console.log(JSON.stringify({audit:'SF-068',scope:'offline canonical game economy; no network, account, or persisted save writes',defectsObserved:observations.filter(o=>o.defectObserved).length,observations},null,2));
