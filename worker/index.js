const STARFALL_VERSION='0.121.1';
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
async function serveRequest(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/battlegroups')return battlegroupsAPI(request,env);
  if(url.pathname==='/api/planet-reset')return planetResetAPI(request,env);
  if(url.pathname==='/api/tribute-ghost/activate')return tributeGhostActivationAPI(request,env);
  if(url.pathname==='/api/alliance-events')return allianceEventsAPI(request,env);
  if(url.pathname==='/api/alliance-policy')return alliancePolicyAPI(request,env);
  if(url.pathname==='/api/strongholds')return strongholdAPI(request,env);
  if(url.pathname==='/api/staff/diagnostics')return diagnosticsAPI(request,env);
  if(['/diagnostics.html','/game-diagnostic.html'].includes(url.pathname)){const user=await portalUser(request,env);if(!user)return Response.redirect(url.origin+'/login.html',302);if(!portalStaffPermission(user,'diagnostics'))return json({error:'Diagnostics permission required.'},403);}
  if(url.pathname.startsWith('/botfiles/')){try{return await gameDumpAPI(request,env);}catch{return json({error:'The gamedump is temporarily unavailable.'},503);}}
  if(['/game','/game/','/index.html'].includes(url.pathname)&&url.searchParams.get('staff_workspace')==='1'){const user=await portalUser(request,env);if(!portalStaffPermission(user,({control:'adminControl',alliances:'allianceAdmin',multihunters:'multihunter',bank:'bank'})[url.searchParams.get('staff_tool')]||'adminControl'))return json({error:'Staff access required.'},403);}
  if(url.pathname==='/api/admin/planet-audit')return staffPlanetAuditAPI(request,env);
  if(url.pathname==='/api/admin/account-ranks')return accountRanksAPI(request,env);
  if(url.pathname==='/api/portal/alliance-manager'){try{return await portalAllianceManagerAPI(request,env);}catch{return json({error:'Alliance manager could not complete this request.'},503);}}
  if(url.pathname==='/api/fleet-movements')return movementAuditAPI(request,env);
  if(url.pathname==='/api/admin/access-logs')return accessLogAPI(request,env);
  if(url.pathname==='/api/alliance-fleets'){try{return await allianceFleetAPI(request,env);}catch{return json({error:'The alliance fleet service is unavailable.'},503);}}
  if(url.pathname==='/api/tickets'){try{return await ticketAPI(request,env);}catch{return json({error:'The support system could not complete this request.'},503);}}
  if(url.pathname==='/api/forums'){try{return await forumAPI(request,env);}catch{return json({error:'The forum could not complete this request.'},503);}}
  if(url.pathname==='/api/alliance-operations'){try{return await attackOperationsAPI(request,env);}catch{return json({error:'Attack planner unavailable.'},503);}}
  if(url.pathname==='/api/alliance-attack'){try{return await allianceAttackAPI(request,env);}catch{return json({error:'Attack board unavailable.'},503);}}
  if(url.pathname.startsWith('/api/alliance-control/')){try{return await allianceControlAPI(request,env);}catch{return json({error:'The alliance could not complete this operation.'},503);}}
  if(['/api/mail','/api/diplomacy','/api/admin/key-reveal','/api/colony','/api/civil-covert'].includes(url.pathname)){try{return await (url.pathname==='/api/mail'?mailAPI:url.pathname==='/api/diplomacy'?diplomacyAPI:url.pathname==='/api/colony'?colonyAPI:url.pathname==='/api/civil-covert'?civilCovertAPI:forceKeyAPI)(request,env);}catch{return json({error:'The communication service could not complete this request.'},503);}}
  if(url.pathname==='/api/galaxy-development'){try{return await galaxyDevelopmentAPI(request,env);}catch{return json({error:'Galaxy development unavailable.'},503);}}
  if(/^\/staff-manual(?:-(admin|support|multihunter))?\.html$/.test(url.pathname)){const staff=await portalUser(request,env);if(!staff)return Response.redirect(url.origin+'/login.html',302);if(!isPortalStaff(staff))return new Response('Staff access required',{status:403});const requested=url.pathname.match(/staff-manual-(admin|support|multihunter)/)?.[1];if(requested&&requested!==staff.role&&staff.role!=='admin')return new Response('This manual is outside your staff role',{status:403});const file=ASSETS['/staff-manual-'+(requested||staff.role)+'.html'];return file?new Response(Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':file.type,'Cache-Control':'private, no-store','Vary':'Cookie'}}):new Response('Staff manual unavailable',{status:404});}
  if(url.pathname==='/api/planet-catalog')return planetCatalogueAPI(request);
  if(url.pathname==='/api/site-management')return siteManagementAPI(request,env);
  if(url.pathname==='/api/round-history')return roundHistoryAPI(request,env);
  if(url.pathname==='/api/staff-directory')return staffDirectoryAPI(request,env);
  if(url.pathname==='/api/spacing-bank')return spacingBankAPI(request,env);
  if(url.pathname==='/api/earth-salvage')return earthSalvageAPI(request,env);
  if(url.pathname==='/api/world-announcements')return worldAnnouncementsAPI(request,env);
  if(url.pathname==='/api/planet-enrolment')return planetEnrolmentAPI(request,env);
  if(url.pathname==='/api/admin/shuffle')return galaxyShuffleAPI(request,env);
  if(url.pathname==='/api/alliance-applications')return allianceApplicationsAPI(request,env);
  if(url.pathname==='/api/alliance-economy')return allianceEconomyAPI(request,env);
  if(url.pathname==='/api/version')return json({version:STARFALL_VERSION,serverTime:Date.now()});
  if(['/api/planets','/api/alliance-intel','/api/alliance-settings'].includes(url.pathname)){try{return await (url.pathname==='/api/planets'?planetDirectoryAPI:url.pathname==='/api/alliance-settings'?allianceSettingsAPI:allianceIntelAPI)(request,env);}catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':'The central planet database is unavailable.'},error instanceof SyntaxError?400:503);}}
  if(url.pathname.startsWith('/api/portal/')){try{return await portalAPI(request,env);}catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':'The portal could not complete this request. Try again.'},error instanceof SyntaxError?400:503);}}
  if(url.pathname.startsWith('/api/miday/')){try{return await api(request,env);}catch(error){return json({error:error instanceof SyntaxError?'Invalid JSON request.':'The scan database could not complete this request. Try again.'},error instanceof SyntaxError?400:503);}}
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(['/profile.html','/staff.html','/forums.html'].includes(url.pathname)){const user=await portalUser(request,env);if(!user)return Response.redirect(url.origin+'/login.html',302);if(url.pathname==='/staff.html'&&!isPortalStaff(user))return new Response('Staff access required',{status:403});}
  const game=['/game','/game/','/index.html'].includes(url.pathname);
  if(game||url.pathname==='/onboarding.html'){const user=await portalUser(request,env);if(!user)return Response.redirect(url.origin+'/login.html',302);if(game&&!(isPortalStaff(user)&&(url.searchParams.get('staff')==='1'||url.searchParams.get('legacy_staff')==='1'||url.searchParams.get('staff_workspace')==='1'))){const owned=await env.DB.prepare("SELECT id FROM planet_directory WHERE owner_id=? AND kind='planet' LIMIT 1").bind(user.id).first();if(!owned)return Response.redirect(url.origin+'/onboarding.html',302);}}
  const path=url.pathname==='/'?'/portal.html':game?'/index.html':url.pathname;
  const asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404});
  const protectedPage=game||['/onboarding.html','/profile.html','/staff.html','/diagnostics.html','/game-diagnostic.html'].includes(path),headers=staticAssetHeaders(path,asset,protectedPage);if(!protectedPage&&request.headers.get('If-None-Match')===headers.ETag)return new Response(null,{status:304,headers});const bytes=cachedAssetBytes(path,asset);
  if(asset.type==='video/mp4'){const range=request.headers.get('Range');if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.length}});const start=match[1]?Number(match[1]):Math.max(0,bytes.length-Number(match[2])),end=match[1]?(match[2]?Math.min(bytes.length-1,Number(match[2])):bytes.length-1):bytes.length-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=bytes.length||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.length}});return new Response(request.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers:{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Range':'bytes '+start+'-'+end+'/'+bytes.length,'Content-Length':String(end-start+1),'Cache-Control':'public, max-age=60, must-revalidate'}});}return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(bytes.length),'Cache-Control':'public, max-age=60, must-revalidate'}});}
  return new Response(request.method==='HEAD'?null:bytes,{headers});
}
export default {async fetch(request,env,ctx){const response=await cachedServeRequest(request,env);const audit=recordAccountAccess(request,response,env).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(audit);else await audit;return response;}};
function decodeAssetBytes(encoded){if(typeof Uint8Array.fromBase64==='function')return Uint8Array.fromBase64(encoded);const binary=atob(encoded),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
export {sanitizeScan,calculateRetention};
function calculateRetention(){return RETENTION;}
