const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const scaffold=fs.readFileSync(path.join(__dirname,'planets.test.cjs'),'utf8').split("test('colony reports")[0],{database,api,seed,colonyFixture}=new Function('require','__dirname',scaffold+'\nreturn {database,api,seed,colonyFixture};')(require,__dirname);
test('Havoc reaches another logged-in owner at 1:1:1 and rejects stale colony reports',async()=>{
 const db=database();await seed(db);
 const own=JSON.parse(db.sqlite.prepare('SELECT data_json FROM planet_directory WHERE id=?').get('home').data_json);own.coords='01:01:01';
 db.sqlite.prepare('UPDATE planet_directory SET coords=?,data_json=? WHERE id=?').run(own.coords,JSON.stringify(own),'home');
 db.sqlite.prepare("UPDATE portal_users SET role='admin' WHERE id='player-b'").run();
 const directory=(await api(db,'/api/planets','GET',null,'player-b')).data;
 const planet=directory.planets.find(p=>p.id==='home');assert.equal(planet.player,false);
 Object.assign(planet,{resources:{metal:700000,crystal:800000,eonium:900000},roids:{metal:42,crystal:43,eonium:44},ships:{'terran-lumen':321},population:1000,buildings:{biodome:2},research:{demography:1},adminHavocRequest:{id:'havoc-test-request-0001',tickHours:1/12}});
 const saved=await api(db,'/api/planets','POST',directory,'player-b');assert.equal(saved.status,200,JSON.stringify(saved.data));
 const received=(await api(db,'/api/planets')).data.planets.find(p=>p.player);
 assert.equal(received.coords,'01:01:01');assert.equal(received.havocOverride.values.ships['terran-lumen'],321);
 const stale=await api(db,'/api/colony','POST',colonyFixture(1000));assert.equal(stale.status,409);assert.match(stale.data.error,/Havoc/);
 const ack={...colonyFixture(1000),...received.havocOverride.values,publicPopulation:1000,appliedHavocOverride:received.havocOverride.id};
 const accepted=await api(db,'/api/colony','POST',ack);assert.equal(accepted.status,200,JSON.stringify(accepted.data));
 const latest=(await api(db,'/api/planets')).data.planets.find(p=>p.player);assert.equal(latest.resources.metal,700000);
});
test('owner consumes a Havoc delivery once, retaining other fleets and active missions',()=>{
 const state={resetEpoch:0,resources:{metal:2},roids:{metal:1},research:{},buildings:{},fleets:{base:{},f1:{scout:12},f4:{alliance:9}},missions:[{id:'flight'}],config:{tickHours:1}};
 const c=vm.createContext({state,copy:x=>JSON.parse(JSON.stringify(x)),normalizeFleet:x=>x,gameTickMs:()=>300000,save(){}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/havoc-sync.js'),'utf8'),c);
 const p={havocOverride:{id:'delivery-1',requestId:'request-1',resetEpoch:0,tickHours:1/12,values:{resources:{metal:700000},roids:{metal:42},research:{fighter:3},buildings:{biodome:2},ships:{lumen:321},population:1000,biodomeDamage:0}}};
 assert.equal(c.applyCentralHavocOverride(p),true);assert.equal(state.resources.metal,700000);assert.equal(state.fleets.base.lumen,321);assert.equal(state.fleets.f1.scout,12);assert.equal(state.fleets.f4.alliance,9);assert.equal(state.missions.length,1);
 state.resources.metal-=100;assert.equal(c.applyCentralHavocOverride(p),false);assert.equal(state.resources.metal,699900);
 assert.equal(c.applyCentralHavocOverride({havocOverride:{...p.havocOverride,id:'old-reset',resetEpoch:3}}),false);
});
