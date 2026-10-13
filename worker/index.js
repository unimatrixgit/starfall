const TYPES=new Set(['planet','landing','development','unit','news','incoming','jumpgate','advanced']);
const RETENTION=14*24*60*60*1000;
function json(value,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function text(value,max){return typeof value==='string'?value.slice(0,max):'';}
function sanitizeScan(scan,now){
  if(!scan||!TYPES.has(scan.type)||typeof scan.id!=='string'||!scan.id||scan.id.length>100||typeof scan.text!=='string'||scan.text.length>30000)throw Error('Invalid scan report.');
  const anonymous=!!scan.anonymous;
  const savedAt=Number(scan.savedAt)||now;
  if(!Number.isSafeInteger(savedAt)||savedAt>now+60000||savedAt<now-RETENTION)throw Error('The scan is outside the two-week archive window.');
  const rawCoords=text(scan.coords,30);
  if(!/^\d{1,3}:\d{1,3}:\d{1,2}$/.test(rawCoords))throw Error('Invalid scan coordinates.');
  const coords=rawCoords.split(':').map(v=>String(Number(v)).padStart(2,'0')).join(':');
  const report=anonymous?scan.text.replace(/\b\d{1,3}\s*:\s*\d{1,3}\s*:\s*\d{1,2}\b/g,'[coordinates hidden]'):scan.text;
  return {scanId:scan.id,type:scan.type,name:text(scan.name,80),targetName:text(scan.targetName,100),coords:anonymous?'':coords,report,tick:Math.max(0,Math.min(1000000,Math.trunc(Number(scan.tick)||0))),savedAt,expiresAt:savedAt+RETENTION,anonymous:anonymous?1:0};
}
async function api(request,env){
  const url=new URL(request.url),path=url.pathname;
  const user=(await portalUser(request,env))?.id;
  if(!user)return json({error:'Sign in with ChatGPT to use the Miday array.'},401);
  if(!env.DB)return json({error:'The central scan database is unavailable.'},503);
  if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  const now=Date.now();
  if(path==='/api/miday/sharing'){
    if(request.method==='GET'){const row=await env.DB.prepare('SELECT enabled FROM scan_sharing WHERE owner_id = ?').bind(user).first();return json({enabled:!!row?.enabled});}
    if(request.method==='POST'){
      const body=await request.json();if(typeof body.enabled!=='boolean')return json({error:'Choose whether to enable sharing.'},400);
      await env.DB.prepare('INSERT INTO scan_sharing (owner_id,enabled,updated_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at').bind(user,body.enabled?1:0,now).run();
      return json({enabled:body.enabled});
    }
    return json({error:'Method not allowed.'},405);
  }
  if(path!=='/api/miday/scans')return json({error:'Not found.'},404);
  if(request.method==='DELETE'){
    const body=await request.json();if(!Array.isArray(body.ids)||body.ids.length>100||body.ids.some(id=>typeof id!=='string'||id.length>100))return json({error:'Invalid scan selection.'},400);
    if(body.ids.length)await env.DB.batch(body.ids.map(id=>env.DB.prepare('DELETE FROM shared_scans WHERE owner_id=? AND scan_id=?').bind(user,id)));
    return json({deleted:body.ids.length});
  }
  if(request.method==='POST'){
    if(Number(request.headers.get('Content-Length')||0)>3500000)return json({error:'Scan upload is too large.'},413);
    const raw=await request.text();if(raw.length>3500000)return json({error:'Scan upload is too large.'},413);
    const body=JSON.parse(raw);const generation=await env.DB.prepare('SELECT reset_generation FROM planet_directory_meta WHERE id=1').first();if((generation?.reset_generation||0)!==(body.resetGeneration||0))return json({error:'The round was reset. Reload before saving scans.'},409);if(!Array.isArray(body.scans)||body.scans.length>100)return json({error:'Upload up to 100 scans at a time.'},400);
    await env.DB.prepare('INSERT INTO scan_sharing (owner_id,enabled,updated_at) VALUES (?,0,?) ON CONFLICT(owner_id) DO NOTHING').bind(user,now).run();
    let scans;try{scans=body.scans.map(scan=>sanitizeScan(scan,now));}catch(error){return json({error:error.message},400);}
    const statements=scans.map(scan=>env.DB.prepare('INSERT INTO shared_scans (id,owner_id,scan_id,type,name,target_name,coords,report,tick,saved_at,expires_at,anonymous) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scan_id) DO UPDATE SET type=excluded.type,name=excluded.name,target_name=excluded.target_name,coords=excluded.coords,report=excluded.report,tick=excluded.tick,saved_at=excluded.saved_at,expires_at=excluded.expires_at,anonymous=excluded.anonymous').bind(crypto.randomUUID(),user,scan.scanId,scan.type,scan.name,scan.targetName,scan.coords,scan.report,scan.tick,scan.savedAt,scan.expiresAt,scan.anonymous));
    if(statements.length)await env.DB.batch(statements);
    await env.DB.prepare('DELETE FROM shared_scans WHERE expires_at <= ?').bind(now).run();
    return json({saved:scans.length});
  }
  if(request.method==='GET'){
    const query=(url.searchParams.get('q')||'').trim().slice(0,200),coords=(url.searchParams.get('coords')||'').trim(),types=url.searchParams.getAll('type');
    if(types.some(type=>!TYPES.has(type)))return json({error:'Unknown scan type.'},400);
    const offset=Math.max(0,Math.min(100000,Math.trunc(Number(url.searchParams.get('offset'))||0))),limit=50;
    let where='s.enabled=1 AND r.expires_at > ?',args=[now];
    if(coords){where+=' AND r.anonymous=0 AND r.coords=?';args.push(coords);}
    if(query){where+=" AND instr(lower(r.name || ' ' || r.target_name || ' ' || r.coords || ' ' || r.report), lower(?)) > 0";args.push(query);}
    if(types.length){where+=` AND r.type IN (${types.map(()=>'?').join(',')})`;args.push(...types);}
    const rows=await env.DB.prepare(`SELECT r.id,r.type,r.name,r.target_name AS targetName,r.coords,r.report AS text,r.tick,r.saved_at AS savedAt,r.anonymous FROM shared_scans r JOIN scan_sharing s ON s.owner_id=r.owner_id WHERE ${where} ORDER BY r.saved_at DESC,r.id LIMIT ? OFFSET ?`).bind(...args,limit+1,offset).all();
    const results=rows.results||[];return json({scans:results.slice(0,limit).map(r=>({...r,anonymous:!!r.anonymous})),hasMore:results.length>limit,nextOffset:offset+limit});
  }
  return json({error:'Method not allowed.'},405);
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/version')return json({version:'0.78.0',serverTime:Date.now()});
  if(['/api/planets','/api/alliance-intel','/api/alliance-settings'].includes(url.pathname)){try{return await (url.pathname==='/api/planets'?planetDirectoryAPI:url.pathname==='/api/alliance-settings'?allianceSettingsAPI:allianceIntelAPI)(request,env);}catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':'The central planet database is unavailable.'},error instanceof SyntaxError?400:503);}}
  if(url.pathname.startsWith('/api/portal/')){try{return await portalAPI(request,env);}catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':'The portal could not complete this request. Try again.'},error instanceof SyntaxError?400:503);}}
  if(url.pathname.startsWith('/api/miday/')){try{return await api(request,env);}catch(error){return json({error:error instanceof SyntaxError?'Invalid JSON request.':'The scan database could not complete this request. Try again.'},error instanceof SyntaxError?400:503);}}
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(['/profile.html','/staff.html'].includes(url.pathname)){const user=await portalUser(request,env);if(!user)return Response.redirect(url.origin+'/login.html',302);if(url.pathname==='/staff.html'&&user.role!=='admin')return new Response('Staff access required',{status:403});}
  const game=['/game','/game/','/index.html'].includes(url.pathname);
  if(game&&!await portalUser(request,env))return Response.redirect(url.origin+'/login.html',302);
  const path=url.pathname==='/'?'/portal.html':game?'/index.html':url.pathname;
  const asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404});
  const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':path.endsWith('.html')||path.endsWith('.js')||path.endsWith('.css')?'no-cache':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
}};
export {sanitizeScan,calculateRetention};
function calculateRetention(){return RETENTION;}
