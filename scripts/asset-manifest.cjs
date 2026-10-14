// Read-only collector helper. Only obsolete portal hash bundles are candidates
// for pruning; arbitrary artwork, media and dynamic game assets stay included.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtimePattern=/^portal-runtime-[a-f0-9]{12}\.js$/;
function createAssetManifest(directory,options={}){
  const root=fs.realpathSync(directory),files=[],omitted=[],warnings=[];
  function walk(folder){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
      if(['server','.openai'].includes(entry.name))continue;
      const full=path.join(folder,entry.name);
      if(entry.isSymbolicLink())throw Error('Asset symlinks require an explicit publication plan: '+full);
      if(entry.isDirectory())walk(full);
      else if(entry.isFile()){
        const relative=path.relative(root,full).split(path.sep).join('/'),bytes=fs.readFileSync(full),hash=crypto.createHash('sha256').update(bytes).digest('hex');
        files.push({path:relative,url:'/'+relative,bytes:bytes.length,etag:'sha256-'+hash,sha256:hash});
      }
    }
  }
  walk(root);
  const candidates=files.filter(f=>!f.path.includes('/')&&runtimePattern.test(f.path));
  const byName=new Map(candidates.map(f=>[f.path,f])),reachable=new Set(),texts=new Map();
  let unresolved=false;
  function references(file){
    if(!/\.(?:html|js|css|json)$/i.test(file.path))return [];
    let text=texts.get(file.path);
    if(text===undefined){text=fs.readFileSync(path.join(root,file.path),'utf8');texts.set(file.path,text);}
    const refs=[...text.matchAll(/portal-runtime-[a-f0-9]{12}\.js/g)].map(m=>m[0]);
    if(text.replace(/portal-runtime-[a-f0-9]{12}\.js/g,'').includes('portal-runtime-'))unresolved=true;
    return refs;
  }
  const pending=[];
  // All non-hash source/assets remain roots, including loaders and lazy JS.
  for(const file of files)if(!byName.has(file.path))pending.push(...references(file));
  const previous=options.previousRuntimePaths;
  if(previous!==undefined&&!Array.isArray(previous))throw Error('previousRuntimePaths must be an array.');
  for(const name of previous||[]){
    if(typeof name!=='string'||!runtimePattern.test(name)||!byName.has(name))throw Error('Previous runtime must exist in the input: '+name);
    pending.push(name);
  }
  while(pending.length){
    const name=pending.pop();if(reachable.has(name))continue;
    const file=byName.get(name);if(!file)throw Error('Referenced portal runtime is missing: '+name);
    reachable.add(name);pending.push(...references(file));
  }
  const unreferenced=candidates.filter(f=>!reachable.has(f.path));
  if(unresolved)warnings.push('Dynamic portal-runtime reference detected; pruning is disabled.');
  const prune=options.pruneUnreferencedPortalRuntimes===true;
  if(prune&&previous===undefined)throw Error('Pruning requires explicit previousRuntimePaths for rollout compatibility.');
  const omittedNames=new Set();
  if(prune&&!unresolved)for(const file of unreferenced){omittedNames.add(file.path);omitted.push({...file,reason:'unreferenced-portal-runtime'});}
  const included=files.filter(f=>!omittedNames.has(f.path));
  return {format:1,files:included,omitted,warnings,unreferencedRuntimePaths:unreferenced.map(f=>f.path),stats:{inputFiles:files.length,includedFiles:included.length,inputBytes:files.reduce((n,f)=>n+f.bytes,0),includedBytes:included.reduce((n,f)=>n+f.bytes,0),omittedBytes:omitted.reduce((n,f)=>n+f.bytes,0)}};
}
module.exports={createAssetManifest};
if(require.main===module){
  const manifest=createAssetManifest(process.argv[2]||path.resolve(__dirname,'../dist'));
  console.log(JSON.stringify({stats:manifest.stats,warnings:manifest.warnings,unreferencedRuntimePaths:manifest.unreferencedRuntimePaths},null,2));
}
