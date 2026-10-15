/* Runtime loading is ordered: the workspace bootstrap must succeed first. */
(()=>{
 const runtimeVersion=new URL(document.currentScript?.src||location.href,location.href).searchParams.get('v')||'0.125.1';
 let runtimeAttempts=0,bootstrapAttempts=0;
 const status=document.createElement('div');status.setAttribute('role','status');status.className='note';status.textContent='Connecting to planetary command…';document.getElementById('page-overview')?.prepend(status);
 function fail(message){window.starfallThemeReadiness?.failed(message);status.textContent=message;const button=document.createElement('button');button.className='btn';button.textContent='RELOAD COMMAND';button.onclick=()=>location.reload();status.append(button);}
 function runtime(){runtimeAttempts++;const script=document.createElement('script');script.src='/game-runtime.js?v='+encodeURIComponent(runtimeVersion)+(runtimeAttempts>1?'&retry='+runtimeAttempts:'');script.onload=()=>{if(window.starfallGameReady){status.remove();window.starfallThemeReadiness?.runtimeReady();}else fail('Command could not initialise. Open the error log for details.');};script.onerror=()=>{script.remove();if(runtimeAttempts<3){status.textContent='Reconnecting to planetary command…';setTimeout(runtime,500*runtimeAttempts);}else fail('Command files could not load. Your saved round has been retained.');};document.body.append(script);}
 function bootstrap(){
  if(typeof window.initializeStaffWorkspace==='function'){window.initializeStaffWorkspace();runtime();return;}
  bootstrapAttempts++;status.textContent='Loading command workspace…';const script=document.createElement('script');script.src='/staff-workspace.js?v='+encodeURIComponent(runtimeVersion)+'&retry='+bootstrapAttempts;
  script.onload=()=>{if(typeof window.initializeStaffWorkspace!=='function'){fail('Workspace initialisation is unavailable. Your saved round has been retained.');return;}window.initializeStaffWorkspace();window.starfallErrorLog?.record('Workspace bootstrap recovered before command startup.');runtime();};
  script.onerror=()=>{script.remove();if(bootstrapAttempts<3)setTimeout(bootstrap,500*bootstrapAttempts);else fail('Workspace files could not load. Command startup was stopped to preserve the correct saved workspace.');};document.body.append(script);
 }
 bootstrap();
})();
