const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('worker/galaxy-slots.js','utf8'),context);
const layout=(...args)=>JSON.parse(JSON.stringify(context.galaxySlotLayout(...args)));
const claim=(status='active',galaxy='01:01')=>({fortress:{claimStatus:status,strongholdGalaxy:galaxy}});
test('only an active canonical 1:1 claim opens the twenty-slot layout',()=>{
 for(const status of ['inactive','disputed',null])assert.equal(layout('01:01',[claim(status)]).slots.length,15);
 assert.equal(layout('01:01',[claim()]).slots.length,20);
 assert.equal(layout('1:1',[claim('active','1:1')]).special,true);
 assert.equal(layout('01:02',[claim('active','01:02')]).slots.length,15);
 assert.equal(layout('01:01',[{fortress:{strongholdGalaxy:'01:01'}}]).special,false);
});
test('special player, ghost and structure categories do not overlap',()=>{
 const result=layout('1:1',[claim()]);
 assert.deepEqual(result.slots.filter(s=>s.kind==='planet').map(s=>s.slot),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(result.ghostSlots,[11,12,13,14,15]);assert.deepEqual(result.structureSlots,[16,17,18,19,20]);assert.equal(result.tributeSlot,11);
 assert.deepEqual(layout('1:2',[claim('active','1:2')]).structureSlots,[11,12,13,14,15]);
});
test('occupied structures survive claim loss without opening fresh extended slots',()=>{
 const assets=[{id:'kept',coords:'01:01:19',slot:19}],before=JSON.stringify(assets);
 const result=layout('01:01',[claim('inactive')],assets);
 assert.equal(result.special,false);assert.deepEqual(result.slots.filter(s=>s.slot>15),[{slot:19,kind:'structure',available:false,retained:true}]);
 assert.equal(JSON.stringify(assets),before);assert.ok(!result.structureSlots.includes(19));
});
test('legacy occupied structure ghost-range slots remain structures and are not allocated twice',()=>{
 const result=layout('1:1',[claim()],[{coords:'01:01:11',slot:11},{coords:'01:01:16',slot:16}],[{ghostPlanet:true,coords:'01:01:11'}]);
 assert.equal(result.slots.find(s=>s.slot===11).kind,'structure');assert.deepEqual(result.structureSlots,[17,18,19,20]);
});
test('ghosts have no playable or construction allocation and source/browser policies match',()=>{
 const result=layout('1:1',[claim('inactive')],[],[{ghostPlanet:true,coords:'01:01:12'}]);
 assert.equal(result.slots.find(s=>s.slot===12).kind,'ghost');assert.ok(!result.structureSlots.includes(12));
 assert.equal(fs.readFileSync('worker/galaxy-slots.js','utf8'),fs.readFileSync('dist/galaxy-slots.js','utf8'));
});
test('game galaxy rows show special placeholders only during an active claim and retain an occupied extended asset',()=>{
 const source=fs.readFileSync('dist/game.js','utf8');
 const ctx={state:{alliance:claim(),allianceDirectory:[],galaxy:[],structurePlanets:[],ghostPlanets:[]},homeGalaxy:()=> '01:01',galaxyOf:c=>String(c).split(':').slice(0,2).join(':'),padCoord:n=>String(n).padStart(2,'0'),esc:s=>String(s),galaxyPlanetHTML:()=>''};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/galaxy-slots.js','utf8'),ctx);
 for(const name of ['currentGalaxySlotLayout','galaxyExtraRows','galaxyHTML'])vm.runInContext(source.split(/\r?\n/).find(line=>line.startsWith('function '+name+'(')),ctx);
 assert.equal((ctx.galaxyHTML().match(/data-slot=/g)||[]).length,20);assert.match(ctx.galaxyHTML(),/data-slot="11" data-slot-kind="ghost"/);
 ctx.state.alliance=claim('inactive');ctx.state.structurePlanets=[{name:'Preserved relay',coords:'01:01:19',slot:19}];
 const html=ctx.galaxyHTML();assert.match(html,/Preserved relay/);assert.doesNotMatch(html,/data-slot="16"/);assert.doesNotMatch(html,/data-slot-kind="ghost"/);
});

test('extended scan slots require authoritative special claim or an existing retained 1:1 asset',()=>{const client={};vm.createContext(client);vm.runInContext(fs.readFileSync('dist/galaxy-slots.js','utf8'),client);for(const slot of [16,17,18,19,20]){assert.equal(client.validGalaxyScanSlot('1:1',slot,[claim()]),true);assert.equal(client.validGalaxyScanSlot('1:2',slot,[claim('active','1:2')]),false);assert.equal(client.validGalaxyScanSlot('1:1',slot,[claim('inactive')]),false);}assert.equal(client.validGalaxyScanSlot('1:1',20,[claim('inactive')],[{coords:'01:01:20',slot:20}]),true);assert.equal(client.validGalaxyScanSlot('1:1',21,[claim()]),false);assert.equal(client.validGalaxyScanSlot('0:1',5),false);});
