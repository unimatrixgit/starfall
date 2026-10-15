/* SF-092: navigation refreshes data, without reloading the document or its theme. */
(()=>{
 if(window.isStaffWorkspace||typeof navigate!=='function')return;
 let pending=null,sequence=0,latestPage='',lastTick=state.tick;
 const context=()=>({snapshot:state,user:state.centralPlayerId,generation:state.centralResetGeneration||0,epoch:state.resetEpoch||0});
 const same=c=>c.snapshot===state&&c.user===state.centralPlayerId&&c.generation===(state.centralResetGeneration||0)&&c.epoch===(state.resetEpoch||0);
 const status=text=>{let el=document.getElementById('gameDataRefreshStatus');if(!el){const host=document.getElementById('crumb')?.parentElement||document.querySelector('.content');if(host){el=document.createElement('span');el.id='gameDataRefreshStatus';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.className='meta';host.append(el);}}if(el)el.textContent=text;};
 function readDirectory(c){if(pending&&same(pending.context))return pending.promise;const request={context:c};request.promise=centralDirectoryRequest('/api/planets?navigation='+Date.now()).finally(()=>{if(pending===request)pending=null;});pending=request;return request.promise;}
 function renderPage(page){
  const text=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  text('tickNumber',String(state.tick).padStart(3,'0'));text('populationStat',nfmt(state.population));text('valueStat',nfmt(playerValue()));text('xpStat',nfmt(state.xp)+' XP');
  const resources=document.getElementById('railResources');if(resources)resources.innerHTML=resourceHTML();
  const html=(id,fn)=>{const el=document.getElementById(id);if(el)el.innerHTML=fn();};
  if(page==='construction'){html('constructionQueue',constructionHTML);html('buildingCards',buildingCards);html('currentStructures',currentStructuresHTML);}
  if(page==='research'){html('researchCurrent',researchCurrentHTML);html('researchCards',researchCards);text('researchRate',nfmt(researchRate()));}
  if(page==='mining'){html('mineCards',miningCards);html('incomeTable',incomeRows);}
  if(page==='production'){html('productionQueue',productionHTML);html('shipCards',shipCards);}
  if(page==='overview'){html('activeOrders',activeOrderHTML);}
  if(page==='population'){text('popTotal',nfmt(state.population)+' / '+nfmt(populationCapacity()));html('governmentPanel',governmentHTML);html('populationSliders',populationHTML);html('workforceEffects',workforceEffectsHTML);html('populationDetailBlock',()=>populationDetailHTML()+(typeof governmentTaxRegisterHTML==='function'?governmentTaxRegisterHTML():''));}
  if(page==='galaxy'&&typeof renderGalaxyBrowser==='function')renderGalaxyBrowser();
  if(page==='universe'&&typeof renderUniverse==='function')renderUniverse();
  if(page==='politics'&&typeof renderPolitics==='function')renderPolitics();
  if(page==='galaxyFund'&&typeof renderGalaxyFund==='function')renderGalaxyFund();
  if(page==='alliance'&&typeof renderAlliance==='function')renderAlliance();
  if(page==='waves'&&typeof renderWaves==='function')renderWaves();
  if(page==='news'&&typeof renderNews==='function')renderNews();
  if(page==='covert'&&typeof renderCovert==='function')renderCovert();
  if(['quests','bonuses','achievements'].includes(page)&&typeof renderQuests==='function')renderQuests();
  if(page==='planetSettings'&&typeof renderPlanetSettings==='function')renderPlanetSettings();
  if(page==='fleets'){html('fleetRoster',fleetRosterHTML);html('missionList',missionHTML);}
 }
 async function refresh(page){
  const token=++sequence,c=context();latestPage=page;if(!c.user||!planetDirectoryReady)return false;
  save();status('Refreshing game data…');
  try{
   const data=await readDirectory(c);if(token!==sequence||!same(c))return false;
   if(data.userId!==c.user){applySharedDirectory(data);status('Account changed; its current planet was loaded.');return true;}
   const generation=data.resetGeneration||0,own=(data.planets||[]).find(p=>p.player);
   if(generation!==c.generation||(own?.resetEpoch||0)>c.epoch){applySharedDirectory(data);status('Planet reset reconciled with the central game.');return true;}
   if(!own||data.revision<planetDirectoryRevision)return false;
   if(planetDirectorySaving||window.personalResetReconcileBusy){status('A game change is settling. Open the page again to refresh.');return false;}
   if(planetDirectoryEditable&&JSON.stringify(canonicalDirectory(directorySnapshot()))!==planetDirectoryBaseline){status('Local directory changes are waiting to save; they were preserved.');return false;}
   // Local colony projects/tick/resources are authoritative in this practice model.
   // Apply only central directory state and idempotent settlement deltas.
   state.galaxy=copy(data.planets);state.structurePlanets=copy(data.structures||[]);state.ghostPlanets=copy(data.ghostPlanets||[]);
   const profile=(data.alliances||[]).find(a=>a.name===own.alliance);
   if(profile){const ui={intelRecords:state.alliance?.name===profile.name?state.alliance.intelRecords:{},intelBrowserCoords:state.alliance?.intelBrowserCoords,intelTarget:state.alliance?.intelTarget,intelSearch:state.alliance?.intelSearch};state.alliance={...state.alliance,...copy(profile),...ui};}else if(own.alliance==='Unaffiliated'){state.alliance={...(typeof freshState==='function'?copy(freshState().alliance):{}),name:'Unaffiliated',tag:'',members:[],applicants:[],fund:{metal:0,crystal:0,eonium:0},structures:{active:[],buildQueue:[],cooldowns:{},history:[]},fortress:{strongholdGalaxy:'',anarchyUntilTick:0},rankPermissions:{},intelRecords:{},log:[],wars:[]};}
   state.allianceDirectory=copy((data.alliances||[]).filter(a=>a.name!==profile?.name));
   if(typeof applyCentralPopulationImpact==='function')applyCentralPopulationImpact(own);
   planetDirectoryRevision=data.revision;renderPage(page);planetDirectoryBaseline=JSON.stringify(canonicalDirectory(directorySnapshot()));save();
   const changedTick=lastTick!==state.tick;lastTick=state.tick;status('Game data refreshed'+(changedTick?' · tick '+state.tick:'')+'.');
   if(['politics','population','galaxyFund'].includes(page)){
    const requestedGalaxy=homeGalaxy(),development=await centralDirectoryRequest('/api/galaxy-development');
    if(token!==sequence||!same(c)||homeGalaxy()!==requestedGalaxy||development.galaxy!==requestedGalaxy||development.generation!==c.generation)return false;
    state.populationTax=development;state.galaxyFundTradeReceipts=development.trades||[];state.galaxyFund={...development.fund,log:(development.log||[]).map(x=>({text:x.text,tick:state.tick}))};
    state.politics.gc=development.gc;state.politics.ministers={communication:'',development:'',war:'',economics:'',scanner:'',...development.ministers};state.politics.votes={};for(const name of Object.values(development.votes||{}))state.politics.votes[name]=(state.politics.votes[name]||0)+1;
    renderPage(page);save();
   }
   // These modules already fence their own account/generation and current DOM.
   if(['alliance','galaxyFund'].includes(page)&&typeof loadAllianceTreasuryQuote==='function')await loadAllianceTreasuryQuote();
   if(token!==sequence||!same(c))return false;
   if(page==='mail'&&typeof renderMail==='function')void renderMail();
   if(['forums','galaxyForums','allianceForums'].includes(page)&&typeof renderForums==='function')void renderForums();
   if(page==='galaxyFund'&&typeof renderSpacingBank==='function')void renderSpacingBank(true);
   if(['alliance','news'].includes(page)&&typeof pollAllianceEvents==='function')void pollAllianceEvents();
   return true;
  }catch(error){if(token===sequence&&same(c))status('Game data could not refresh: '+error.message+' Your local progress is preserved.');return false;}
 }
 const originalNavigate=navigate;
 navigate=function(page){const result=originalNavigate.apply(this,arguments);void refresh(page);return result;};
 window.refreshCurrentGameData=()=>refresh(latestPage||document.querySelector('.page.active')?.id?.replace(/^page-/,'')||'overview');
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-game-data-retry]'))void window.refreshCurrentGameData();});
 const host=document.getElementById('crumb')?.parentElement;
 if(host){const message=document.createElement('span');message.id='gameDataRefreshStatus';message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.className='meta';host.append(message);}
})();
