const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=fs.readFileSync(path.join(__dirname,'game.test.cjs'),'utf8'),start=base.indexOf('function game(saved'),end=base.indexOf("test('migrates",start),h=vm.createContext({fs,path,vm,console,__dirname});vm.runInContext(base.slice(start,end)+';this.game=game;',h);
const source=fs.readFileSync(path.join(__dirname,'../dist/communications.js'),'utf8'),sync=source.slice(source.indexOf('let colonySyncBusy='),source.indexOf('async function runCivilCovert'));
function fixture(){const g=h.game();g.run('var planetDirectoryReady=true,planetDirectoryRevision=0;state.centralPlayerId="owner";state.centralResetGeneration=0;');g.context.refreshAfterCentralWrite=async()=>{};g.context.refreshGalaxyDevelopment=async()=>{};vm.runInContext(sync,g.context);return g;}
test('a trade joins an in-flight colony report instead of failing with synchronise-account message',async()=>{
 const g=fixture();let finish,calls=0;g.context.centralDirectoryRequest=()=>{calls++;return new Promise(resolve=>finish=resolve);};
 const background=g.run('syncOwnedColony()'),trade=g.run('syncOwnedColony(true)');assert.equal(calls,1);finish({revision:2});assert.equal(await background,true);assert.equal(await trade,true);assert.equal(calls,1);
});
test('settlement conflict refreshes the owner and retries with updated acknowledgement',async()=>{
 const g=fixture();let calls=0,refreshes=0;
 g.context.refreshAfterCentralWrite=async()=>{refreshes++;g.run('state.appliedBankTrades={metal:25};');};
 g.context.centralDirectoryRequest=async(route,payload)=>{calls++;if(calls===1)throw Object.assign(Error('Bank settlement is waiting.'),{status:409});assert.equal(payload.appliedBankTrades.metal,25);return {revision:3};};
 assert.equal(await g.run('syncOwnedColony(true)'),true);assert.equal(calls,2);assert.equal(refreshes,2);
});
test('persistent conflicts stop after three attempts and retain the specific error',async()=>{
 const g=fixture();let calls=0;g.context.centralDirectoryRequest=async()=>{calls++;throw Object.assign(Error('Round changed. Reload.'),{status:409});};
 assert.equal(await g.run('syncOwnedColony(true)'),false);assert.equal(calls,3);assert.equal(g.run('colonySyncLastError'),'Round changed. Reload.');
});
