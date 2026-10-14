const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function fixture(handler){let calls=0,now=0;const context=vm.createContext({URL,Response,Date:{now:()=>now},STARFALL_VERSION:'test',decodeAssetBytes:s=>Uint8Array.from(Buffer.from(s,'base64')),serveRequest:async request=>{calls++;return handler?handler(request,calls):Response.json({calls});}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../worker/cache.js'),'utf8'),context);return {context,run:s=>vm.runInContext(s,context),advance:n=>now+=n,calls:()=>calls,request:async(url,options={})=>{context.request=new Request('https://site.test'+url,options);context.env||={DB:{}};return vm.runInContext('cachedServeRequest(request,env)',context);}};}
test('catalogue query order shares a key; unknown and duplicate parameters bypass',async()=>{
 const f=fixture();await f.request('/api/planet-catalog?q=earth&family=Original');await f.request('/api/planet-catalog?family=Original&q=earth');assert.equal(f.calls(),1);
 for(const q of ['?noise=1','?q=a&q=b']){await f.request('/api/planet-catalog'+q);await f.request('/api/planet-catalog'+q);}assert.equal(f.calls(),5);
});
test('private/cookie/variant responses are not shared even with waiting callers',async()=>{
 for(const headers of [{'Set-Cookie':'session=secret'},{'Cache-Control':'private'},{Vary:'Cookie'},{Vary:'Authorization'}]){
  const f=fixture((r,n)=>Response.json({n},{headers}));const responses=await Promise.all([f.request('/api/staff-directory'),f.request('/api/staff-directory')]);assert.equal(f.calls(),2);assert.notEqual((await responses[0].json()).n,(await responses[1].json()).n);
 }
 const html=fixture(()=>new Response('<h1>Login</h1>',{headers:{'Content-Type':'text/html'}}));await html.request('/api/staff-directory');await html.request('/api/staff-directory');assert.equal(html.calls(),2);
 const fresh=fixture();await fresh.request('/api/staff-directory',{headers:{'Cache-Control':'no-cache'}});await fresh.request('/api/staff-directory',{headers:{Authorization:'Bearer secret'}});assert.equal(fresh.run('publicReadCache(env).size'),0);
});
test('body limits count UTF-8 bytes; private API reads stay uncached',async()=>{
 const f=fixture(()=>Response.json({text:'水'.repeat(100000)}));assert.equal((await (await f.request('/api/planet-catalog')).json()).text.length,100000);assert.equal(f.run('publicReadCache(env).size'),0);await f.request('/api/planet-catalog');assert.equal(f.calls(),2);
 const privateRead=fixture();await privateRead.request('/api/planets');await privateRead.request('/api/planets');assert.equal(privateRead.calls(),2);
});
test('aggregate bytes and entry count stay bounded across catalogue searches',async()=>{
 const f=fixture(()=>Response.json({text:'x'.repeat(200000)}));for(let i=0;i<15;i++)await f.request('/api/planet-catalog?q='+i);assert.ok(f.run('[...publicReadCache(env).values()].reduce((n,r)=>n+r.bytes,0)')<=2*1024*1024);
 const tiny=fixture();for(let i=0;i<150;i++)await tiny.request('/api/planet-catalog?q='+i);assert.equal(tiny.run('publicReadCache(env).size'),128);
});
test('old failed inflight read cannot evict its replacement',async()=>{
 let release;const f=fixture(async(r,n)=>n===1?new Promise(resolve=>release=()=>resolve(Response.json({old:true},{status:503}))):Response.json({new:true}));
 const first=f.request('/api/staff-directory');await Promise.resolve();f.run('invalidatePublicReadCache(env)');assert.equal((await (await f.request('/api/staff-directory')).json()).new,true);release();await first;assert.equal((await f.request('/api/staff-directory')).headers.get('X-Starfall-Cache'),'HIT');assert.equal(f.calls(),2);
});
test('unrelated writes keep public cache; directory mutation invalidates even inflight reads',async()=>{
 const f=fixture();await f.request('/api/portal/worldstats');await f.request('/api/fleet-movements',{method:'POST'});await f.request('/api/portal/worldstats');assert.equal(f.calls(),2);await f.request('/api/planets',{method:'POST'});await f.request('/api/portal/worldstats');assert.equal(f.calls(),4);
 let release;const racing=fixture(async(r,n)=>n===1?new Promise(resolve=>release=()=>resolve(Response.json({old:true}))):Response.json({n}));const pending=racing.request('/api/portal/worldstats');await Promise.resolve();await racing.request('/api/planets',{method:'POST'});release();await pending;assert.equal((await racing.request('/api/portal/worldstats')).headers.get('X-Starfall-Cache'),'MISS');assert.equal(racing.calls(),3);
});
test('TTL starts at completion; rejected reads permit retry',async()=>{
 let release;const f=fixture(()=>new Promise(resolve=>release=()=>resolve(Response.json({ok:true}))));const pending=f.request('/api/staff-directory');await Promise.resolve();f.advance(61000);release();await pending;f.advance(59999);assert.equal((await f.request('/api/staff-directory')).headers.get('X-Starfall-Cache'),'HIT');
 const error=fixture(()=>{throw Error('DB unavailable');});await assert.rejects(error.request('/api/staff-directory'),/DB unavailable/);assert.equal(error.run('publicReadCache(env).size'),0);
});
test('digest headers distinguish equal-sized edits; immutable requires verified hash URL',()=>{
 const f=fixture(),digest=crypto.createHash('sha256').update('one').digest('hex');f.context.asset={type:'text/javascript',data:'b25l',etag:'sha256-'+digest};f.context.file='/portal-runtime-'+digest.slice(0,12)+'.js';assert.match(f.run('staticAssetHeaders(file,asset)["Cache-Control"]'),/immutable/);assert.equal(f.run('staticAssetHeaders(file,asset,true)["Cache-Control"]'),'private, no-store');assert.doesNotMatch(f.run('staticAssetHeaders("/portal-runtime-000000000000.js",asset)["Cache-Control"]'),/immutable/);
 const before=f.run('staticAssetHeaders("/game.js",asset).ETag');f.context.asset.etag='sha256-'+crypto.createHash('sha256').update('two').digest('hex');assert.notEqual(before,f.run('staticAssetHeaders("/game.js",asset).ETag'));
});
test('non-cacheable empty statuses keep their HTTP semantics; failed writes do not invalidate',async()=>{
 for(const status of [204,205,304]){const f=fixture(()=>new Response(null,{status}));assert.equal((await f.request('/api/staff-directory')).status,status);assert.equal(f.run('publicReadCache(env).size'),0);}
 const f=fixture(r=>r.method==='POST'?Response.json({error:'rejected'},{status:409}):Response.json({ok:true}));await f.request('/api/portal/worldstats');await f.request('/api/planets',{method:'POST'});assert.equal((await f.request('/api/portal/worldstats')).headers.get('X-Starfall-Cache'),'HIT');
});
