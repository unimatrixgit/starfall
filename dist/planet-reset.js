// Included after game.js; renderPlanetSettings calls renderPersonalPlanetReset().
let personalResetInfo=null,personalResetBusy=false;
// Await before applying an owned colony/report. Pass the freshly fetched server row.
async function reconcilePersonalPlanetReset(owned){
 const epoch=owned?.resetEpoch||0;if(epoch<=(state.resetEpoch||0))return false;
 const response=await fetch('/api/planet-reset?epoch='+encodeURIComponent(state.resetEpoch||0),{credentials:'same-origin',cache:'no-store'}),data=await response.json();
 if(!response.ok||!data.resetState||data.resetEpoch!==epoch)throw new Error(data.error||'Planet reset changed. Refresh the current colony.');
 const next=data.resetState,resetFoundingPopulation=next.population;next.userSettings={...next.userSettings,...state.userSettings,skinRace:owned.theme||next.userSettings.skinRace};next.config={...state.config};
 for(const key of ['resources','roids','buildings','research','workforce','researchProgress','researchActive','population','populationGrowthCarry','biodomeDamage'])if(owned[key]!==undefined)next[key]=JSON.parse(JSON.stringify(owned[key]));
 for(const key of ['centralPlayerId','centralResetGeneration','enrolledGeneration','enrolledPlanetType','accountId'])next[key]=state[key];next.tick=owned.publicTick||1;next.xp=owned.publicXP||0;next.galaxy=[{...owned,player:true}];next.resetEpoch=epoch;if(typeof initializePopulationHistory==='function')initializePopulationHistory(next,resetFoundingPopulation);state=next;save();return true;
}
async function loadPersonalPlanetReset(){
 try{const response=await fetch('/api/planet-reset',{credentials:'same-origin',cache:'no-store'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load reset status.');personalResetInfo=data;renderPersonalPlanetReset(false);}catch(error){const box=document.getElementById('personalResetStatus');if(box)box.textContent=error.message;}
}
function renderPersonalPlanetReset(load=true){
 if(window.isStaffWorkspace||window.isGameDiagnostic)return;const root=document.getElementById('planetSettingsContent');if(!root)return;let panel=document.getElementById('personalPlanetReset');if(!panel){panel=document.createElement('section');panel.id='personalPlanetReset';panel.className='settings-card panel';panel.innerHTML='<div class="ph"><div class="pt">PLANET RESET</div></div><div class="settings-body"><p class="note">Reset this planet to its founding state. Before the round ticker has ever started, reset is immediate and your alliance membership remains. After its first start, request a reset and wait 72 hours; completing it also removes your alliance membership.</p><label class="reset-confirm" for="personalResetConfirm"><input type="checkbox" id="personalResetConfirm"><span>I understand that this clears this planet’s progress, achievements, ships and orders.</span></label><p id="personalResetStatus" role="status" aria-live="polite">Loading reset status…</p><button type="button" class="btn" id="personalResetAction" disabled>RESET PLANET</button></div>';(root.querySelector('.planet-settings-centered')||root).append(panel);}
 const status=document.getElementById('personalResetStatus'),button=document.getElementById('personalResetAction'),checked=document.getElementById('personalResetConfirm').checked;
 if(personalResetInfo){const d=personalResetInfo;status.textContent=d.readyAt?(d.canReset?'Waiting period complete. Ready to reset.':'Reset available '+new Date(d.readyAt).toLocaleString()+'.'):(d.tickerEverStarted?'A reset request starts a 72-hour waiting period.':'Ticker has never started. Reset is immediate.');button.textContent=d.tickerEverStarted&&!d.readyAt?'REQUEST RESET':'RESET PLANET';button.disabled=personalResetBusy||!checked||!!(d.readyAt&&!d.canReset);}
 if(load)loadPersonalPlanetReset();
}
document.addEventListener('change',event=>{if(event.target.id==='personalResetConfirm')renderPersonalPlanetReset(false);});
document.addEventListener('click',async event=>{
 if(event.target.id!=='personalResetAction'||personalResetBusy||!personalResetInfo||!document.getElementById('personalResetConfirm')?.checked)return;
 personalResetBusy=true;renderPersonalPlanetReset(false);
 try{const d=personalResetInfo,response=await fetch('/api/planet-reset',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:d.tickerEverStarted&&!d.readyAt?'request':'complete',confirmation:true,generation:d.generation,revision:d.revision,resetEpoch:d.resetEpoch})}),data=await response.json();if(!response.ok)throw new Error(data.error||'Reset failed.');
 if(data.reset){const previous=state;state=data.resetState;state.config={...previous.config};state.userSettings={...state.userSettings,...previous.userSettings,skinRace:data.planet.theme||state.userSettings.skinRace};save();location.reload();return;}personalResetInfo=data;notify('Reset requested. Your 72-hour waiting period has started.');
 }catch(error){notify(error.message,true);await loadPersonalPlanetReset();}finally{personalResetBusy=false;renderPersonalPlanetReset(false);}
});
