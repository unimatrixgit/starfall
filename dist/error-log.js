(()=>{'use strict';const entries=[];let history=[],box;const path=location.pathname;const clean=v=>String(v||'Unknown error').replace(/SF-[A-Za-z0-9_-]+/g,'[passkey removed]').replace(/https?:\/\/[^\s)]+/g,value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return '[URL]';}}).slice(0,900);try{const prior=JSON.parse(sessionStorage.getItem('starfall-error-log')||'[]');history=Array.isArray(prior)?prior.slice(-12).map(e=>typeof e==='string'?{at:(e.match(/\d{4}-\d\d-\d\dT[\d:.]+Z/g)||[]).at(-1)||'',path:'Earlier page',message:clean(e.replace(/^(?:\d{4}-\d\d-\d\dT[\d:.]+Z\s*·\s*)+/,''))}:{at:e.at,path:e.path||'Earlier page',message:clean(e.message)}):[];}catch{}
function format(e){return (e.at?e.at+' · ':'')+e.path+' · '+e.message;}
function render(){if(!box){box=document.createElement('details');box.className='starfall-error-log';box.innerHTML='<summary aria-label="Open error log">×</summary><div><b>Current page errors</b><pre data-current-errors></pre><details class="previous-error-history"><summary>Previous errors</summary><pre data-previous-errors></pre></details><a href="/profile.html#tickets">OPEN SUPPORT TICKET →</a></div>';(document.body||document.documentElement).append(box);const style=document.createElement('style');style.textContent='.starfall-error-log{position:fixed;right:16px;bottom:16px;z-index:10000;color:#eef8ff;font:12px system-ui;background:#101c28;border:1px solid var(--skin-accent,#89cfea);border-radius:8px;box-shadow:0 0 20px #0008;max-width:calc(100vw - 32px)}.starfall-error-log>summary{cursor:pointer;padding:8px 14px;font-size:22px;list-style:none}.starfall-error-log>div{padding:14px;max-width:min(440px,85vw)}.starfall-error-log pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}.starfall-error-log a{color:#a7e1ff;display:inline-block;max-width:100%;overflow-wrap:anywhere}.previous-error-history{margin:12px 0}.previous-error-history>summary{cursor:pointer;font-size:12px}';document.head.append(style);}box.querySelector('[data-current-errors]').textContent=entries.length?entries.map(format).join('\n'):'No errors recorded on this page.';box.querySelector('[data-previous-errors]').textContent=history.map(format).join('\n');box.querySelector('.previous-error-history').hidden=!history.length;}
function record(message){entries.push({at:new Date().toISOString(),path,message:clean(message)});if(entries.length>12)entries.shift();try{sessionStorage.setItem('starfall-error-log',JSON.stringify([...history,...entries].slice(-12)));}catch{}render();}
window.starfallErrorLog={text:()=>entries.map(format).join('\n'),current:()=>entries.map(e=>({...e})),record};if(history.length)render();window.addEventListener('error',e=>record(e.message?e.message+' · '+(e.filename||'')+':'+(e.lineno||0):'Failed to load '+(e.target?.tagName||'resource')+' · '+(e.target?.src||e.target?.href||'')),true);window.addEventListener('unhandledrejection',e=>record(e.reason?.message||e.reason));})();
/* SF-072: retry public same-origin styles and images after transient failures. */
(()=>{
 const attempts=new WeakMap();
 function publicResource(node){
  const attr=node?.tagName==='IMG'?'src':node?.tagName==='LINK'&&node.rel==='stylesheet'&&!node.disabled?'href':null;
  if(!attr)return null;
  try{const url=new URL(node[attr],location.href);if(url.origin!==location.origin||!(attr==='href'?url.pathname.endsWith('.css'):url.pathname.startsWith('/assets/')))return null;url.searchParams.delete('sf_retry');return {attr,url};}catch{return null;}
 }
 window.addEventListener('error',event=>{
  const node=event.target,resource=publicResource(node);if(!resource)return;
  let entry=attempts.get(node);if(!entry||entry.url!==resource.url.href){entry={url:resource.url.href,count:0,pending:false};attempts.set(node,entry);}
  if(entry.pending)return;if(entry.count>=2){if(entry.loaded)node.removeEventListener('load',entry.loaded);return;}if(entry.loaded)node.removeEventListener('load',entry.loaded);
  entry.count++;entry.pending=true;
  const label=resource.url.pathname;
  const loaded=()=>{node.removeEventListener('load',loaded);if(attempts.get(node)===entry)window.starfallErrorLog?.record('Resource recovered after retry: '+label);};
  entry.loaded=loaded;node.addEventListener('load',loaded,{once:true});
  setTimeout(()=>{entry.pending=false;const current=publicResource(node);if(!node.isConnected||!current||current.url.href!==entry.url){node.removeEventListener('load',loaded);return;}const retry=new URL(entry.url);retry.searchParams.set('sf_retry',String(entry.count));node[resource.attr]=retry.href;},entry.count===1?500:1500);
 },true);
})();
