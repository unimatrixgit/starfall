const SESSION_AGE=7*86400000;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
function equalHash(a,b){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
async function portalUser(request,env){const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)starfall_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token||!env.DB)return null;return env.DB.prepare('SELECT u.id,u.username,u.role FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first();}
async function portalAPI(request,env){
  const url=new URL(request.url),action=url.pathname.split('/').pop();if(!env.DB)return json({error:'The portal database is unavailable.'},503);
  if(action==='register')return registerAccount(request,env);if(['profile','staff','staff-assign','reset'].includes(action))return accountControlAPI(request,env);
  // Sites dispatch enforces the existing owner-private audience for visitors and service callers.
  if(request.method==='GET'&&action==='session'){const user=await portalUser(request,env);const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM portal_users').first();return json({user,setupRequired:row.count===0});}
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  if(action==='logout'){const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)starfall_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(token)await env.DB.prepare('DELETE FROM portal_sessions WHERE token_hash=?').bind(await digest(token)).run();return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':'starfall_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'}});}
  const body=await request.json(),username=String(body.username||'').trim(),password=body.password;
  if(typeof password!=='string'||password.length<8||password.length>128||!username||username.length>40)return json({error:'Enter a username and a password of 8–128 characters.'},400);
  if(action==='setup'){
    const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM portal_users').first();if(count.count)return json({error:'The administrator account has already been created.'},409);
    if(username!=='admin')return json({error:'The initial administrator username must be admin.'},400);
    const salt=hex(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt);
    await env.DB.prepare('INSERT INTO portal_users (id,username,password_hash,password_salt,role,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM portal_users)').bind(crypto.randomUUID(),username,hash,salt,'admin',Date.now()).run();
  }else if(action!=='login')return json({error:'Not found.'},404);
  const user=await env.DB.prepare('SELECT * FROM portal_users WHERE username=?').bind(username).first();
  if(user?.locked_until>Date.now())return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  if(!user||!equalHash(await passwordHash(password,user.password_salt),user.password_hash)){
    if(user)await env.DB.prepare('UPDATE portal_users SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=5 THEN ? ELSE 0 END WHERE id=?').bind(Date.now()+15*60000,user.id).run();
    return json({error:'Incorrect username or password.'},401);
  }
  await env.DB.prepare('UPDATE portal_users SET failed_attempts=0,locked_until=0 WHERE id=?').bind(user.id).run();
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+SESSION_AGE;
  await env.DB.prepare('INSERT INTO portal_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),user.id,expires).run();
  await env.DB.prepare('DELETE FROM portal_sessions WHERE expires_at<=?').bind(Date.now()).run();
  const secure=url.protocol==='https:'?' Secure;':'';
  return new Response(JSON.stringify({user:{username:user.username,role:user.role}}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`starfall_session=${token}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${SESSION_AGE/1000}`}});
}
