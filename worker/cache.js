const CACHE_MINUTE=60000,ASSET_CACHE_LIMIT=16*1024*1024;
const assetByteCache=new Map();let assetByteCacheSize=0;
function cachedAssetBytes(path,asset){const now=Date.now(),hit=assetByteCache.get(path);if(hit&&now-hit.at<CACHE_MINUTE&&hit.source===asset.data){assetByteCache.delete(path);assetByteCache.set(path,hit);return hit.bytes;}if(hit){assetByteCacheSize-=hit.bytes.byteLength;assetByteCache.delete(path);}const bytes=decodeAssetBytes(asset.data);if(bytes.byteLength<=ASSET_CACHE_LIMIT){while(assetByteCacheSize+bytes.byteLength>ASSET_CACHE_LIMIT&&assetByteCache.size){const key=assetByteCache.keys().next().value;assetByteCacheSize-=assetByteCache.get(key).bytes.byteLength;assetByteCache.delete(key);}assetByteCache.set(path,{at:now,source:asset.data,bytes});assetByteCacheSize+=bytes.byteLength;}return bytes;}
function staticAssetHeaders(path,asset,protectedPage=false){
  // Optional digest is computed by the build collector, never per request.
  const digest=/^sha256-[a-f0-9]{64}$/.test(asset.etag||'')?asset.etag:null;
  const tag=digest||path.replace(/[^a-zA-Z0-9]/g,'_')+'-'+asset.data.length;
  const hashName=/^\/portal-runtime-([a-f0-9]{12})\.js$/.exec(path);
  const immutable=!!(digest&&hashName&&digest.slice(7).startsWith(hashName[1]));
  return {'Content-Type':asset.type,'Cache-Control':protectedPage?'private, no-store':immutable?'public, max-age=31536000, immutable':'public, max-age=60, must-revalidate','ETag':'W/"'+STARFALL_VERSION+'-'+tag+'"','X-Content-Type-Options':'nosniff'};
}
const publicReadCaches=new WeakMap();
const PUBLIC_CACHE_ROUTES=new Set(['/api/portal/worldstats','/api/staff-directory','/api/planet-catalog']);
const PUBLIC_CACHE_ENTRIES=128,PUBLIC_CACHE_BYTES=2*1024*1024,PUBLIC_BODY_LIMIT=256*1024;
// These handlers cannot change public counts, roster or the static catalogue.
// All other successful mutations retain conservative full invalidation.
const PUBLIC_CACHE_UNRELATED_WRITES=new Set(['/api/alliance-fleets','/api/fleet-movements','/api/mail','/api/tickets','/api/forums','/api/alliance-intel','/api/miday/scans','/api/miday/sharing']);
function publicReadCache(env){if(!env.DB)return null;let cache=publicReadCaches.get(env.DB);if(!cache){cache=new Map();publicReadCaches.set(env.DB,cache);}return cache;}
function invalidatePublicReadCache(env){publicReadCaches.get(env.DB)?.clear();}
function publicReadKey(request){
  const url=new URL(request.url);
  if(request.method!=='GET'||!PUBLIC_CACHE_ROUTES.has(url.pathname))return null;
  if(/(?:no-cache|no-store)/i.test(request.headers?.get?.('Cache-Control')||''))return null;
  if(request.headers?.get?.('Authorization'))return null;
  const allowed=url.pathname==='/api/planet-catalog'?new Set(['q','family','page']):new Set();
  const seen=new Set();
  for(const key of url.searchParams.keys()){
    // Unknown/duplicate parameters bypass instead of changing their semantics.
    if(!allowed.has(key)||seen.has(key))return null;
    seen.add(key);
  }
  url.searchParams.sort();return url.origin+url.pathname+(url.searchParams.size?'?'+url.searchParams.toString():'');
}
function trimPublicReads(cache,now){
  for(const [key,record] of cache)if(!record.pending&&now-record.at>=CACHE_MINUTE)cache.delete(key);
  let bytes=0;for(const record of cache.values())bytes+=record.bytes||0;
  while((cache.size>PUBLIC_CACHE_ENTRIES||bytes>PUBLIC_CACHE_BYTES)&&cache.size){
    const key=cache.keys().next().value,record=cache.get(key);bytes-=record.bytes||0;cache.delete(key);
  }
}
function publicCacheResponse(value,kind){
  const headers={...value.headers};if(value.cacheable){headers['cache-control']='public, max-age=60, must-revalidate';headers['x-starfall-cache']=kind;}
  return new Response([204,205,304].includes(value.status)?null:value.body,{status:value.status,headers});
}
async function cachedServeRequest(request,env){
  const path=new URL(request.url).pathname,cache=publicReadCache(env),key=publicReadKey(request);
  if(!key||!cache){
    const response=await serveRequest(request,env);
    if(!['GET','HEAD'].includes(request.method)&&response.ok&&!PUBLIC_CACHE_UNRELATED_WRITES.has(path))invalidatePublicReadCache(env);
    return response;
  }
  trimPublicReads(cache,Date.now());
  const hit=cache.get(key);
  if(hit){
    cache.delete(key);cache.set(key,hit);
    const value=await hit.value;
    // Future private/error responses must not cross caller boundaries even if
    // both requests were already waiting before headers became available.
    if(!value.cacheable)return serveRequest(request,env);
    return publicCacheResponse(value,'HIT');
  }
  const record={at:Date.now(),pending:true,bytes:0,value:null};
  record.value=(async()=>{
    const response=await serveRequest(request,env),headers=Object.fromEntries(response.headers);
    const body=new Uint8Array(await response.arrayBuffer());
    const vary=(response.headers.get('Vary')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const cacheable=response.status===200&&!response.headers.has('Set-Cookie')&&!/\bprivate\b/i.test(response.headers.get('Cache-Control')||'')&&vary.every(name=>name==='accept-encoding')&&/\bapplication\/json\b/i.test(response.headers.get('Content-Type')||'')&&body.byteLength<=PUBLIC_BODY_LIMIT;
    record.pending=false;record.at=Date.now();record.bytes=cacheable?body.byteLength:0;
    if(cache.get(key)===record){if(!cacheable)cache.delete(key);else trimPublicReads(cache,Date.now());}
    return {body,status:response.status,headers,cacheable};
  })();
  cache.set(key,record);trimPublicReads(cache,Date.now());
  try{return publicCacheResponse(await record.value,'MISS');}
  catch(error){if(cache.get(key)===record)cache.delete(key);throw error;}
}
