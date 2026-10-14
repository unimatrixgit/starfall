const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createAssetManifest}=require('../scripts/asset-manifest.cjs');
function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starfall-manifest-'));const write=(name,data)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};try{return run(root,write);}finally{fs.rmSync(root,{recursive:true,force:true});}}
const old='portal-runtime-aaaaaaaaaaaa.js',current='portal-runtime-bbbbbbbbbbbb.js',previous='portal-runtime-cccccccccccc.js';
test('read-only manifest hashes assets and retains arbitrary dynamic assets',()=>fixture((root,write)=>{
 write('portal.html','<script src="/'+current+'"></script>');write(current,'// active');write(old,'// old');write('assets/lazy.svg','<svg/>');write('assets/test.png','png');write('assets/test.webp','webp');write('server/index.js','not an asset');write('.openai/hosting.json','{}');
 const result=createAssetManifest(root);assert.equal(result.omitted.length,0);assert.ok(result.unreferencedRuntimePaths.includes(old));assert.equal(result.files.length,6);
 assert.equal(result.files.find(f=>f.path==='assets/lazy.svg').etag,'sha256-'+crypto.createHash('sha256').update('<svg/>').digest('hex'));
 assert.ok(fs.existsSync(path.join(root,old)));assert.ok(result.files.some(f=>f.path.endsWith('.png')));assert.ok(result.files.some(f=>f.path.endsWith('.webp')));
}));
test('opt-in pruning preserves current and previous deployment runtimes without deleting input',()=>fixture((root,write)=>{
 write('portal.html','<script data-runtime="/'+current+'"></script>');write(current,'// current');write(previous,'// previous');write(old,'// obsolete');
 const result=createAssetManifest(root,{pruneUnreferencedPortalRuntimes:true,previousRuntimePaths:[previous]});assert.deepEqual(result.omitted.map(f=>f.path),[old]);assert.ok(result.files.some(f=>f.path===previous));assert.equal(result.stats.omittedBytes,Buffer.byteLength('// obsolete'));assert.ok(fs.existsSync(path.join(root,old)));
 assert.throws(()=>createAssetManifest(root,{pruneUnreferencedPortalRuntimes:true}),/previousRuntimePaths/);
}));
test('runtime references are transitive and all HTML/JS/CSS/JSON roots are checked',()=>fixture((root,write)=>{
 write('portal.html','<script data-runtime="/'+current+'"></script>');write(current,'load("/'+previous+'")');write(previous,'// chained');write('config.json',JSON.stringify({runtime:old}));write(old,'// configured');
 const result=createAssetManifest(root,{pruneUnreferencedPortalRuntimes:true,previousRuntimePaths:[]});assert.equal(result.omitted.length,0);
}));
test('unresolved dynamic runtime references disable pruning; missing literal runtime fails clearly',()=>fixture((root,write)=>{
 write('loader.js','load("portal-runtime-" + hash + ".js")');write(old,'// dynamic');
 const result=createAssetManifest(root,{pruneUnreferencedPortalRuntimes:true,previousRuntimePaths:[]});assert.equal(result.omitted.length,0);assert.equal(result.warnings.length,1);
 write('portal.html','<script src="/'+current+'"></script>');assert.throws(()=>createAssetManifest(root),/missing/);
}));
test('previous manifest paths cannot escape root or silently lose compatibility assets',()=>fixture((root,write)=>{
 write(old,'// old');for(const name of ['../'+old,'/'+old,previous])assert.throws(()=>createAssetManifest(root,{previousRuntimePaths:[name]}),/Previous runtime/);
}));
test('hash metadata changes for same-length edits and output is deterministic',()=>fixture((root,write)=>{
 write('plain.js','one');const first=createAssetManifest(root);assert.deepEqual(createAssetManifest(root),first);write('plain.js','two');const next=createAssetManifest(root);assert.equal(first.files[0].bytes,next.files[0].bytes);assert.notEqual(first.files[0].etag,next.files[0].etag);
}));
