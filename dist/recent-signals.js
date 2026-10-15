/* SF-126: contextual signals header and independent planet preferences. */
(()=>{
 const pages=new Set(['overview','mining','construction','research','production','fleets','galaxyFund','waves','covert','alliance','politics','population']);
 let selectedKey='',lastMarkup='',browsing=false;
 const key=entry=>JSON.stringify([entry.id||'',entry.tick,entry.category,entry.text]);
 function preferences(){
  state.userSettings=state.userSettings||{};
  const stored=state.userSettings.recentSignalsCategories||{};
  return Object.fromEntries(NEWS_CATEGORIES.map(category=>[category,category!=='SYSTEM'&&(stored[category]??true)]));
 }
 function entries(){const filters=preferences();return (state.news||[]).filter(entry=>filters[newsCategory(entry)]).slice(0,8);}
 function measureHeader(){const header=document.querySelector('.shell>.topbar');if(header)document.documentElement.style.setProperty('--command-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');}
 function render(){
  const root=document.getElementById('recentSignalsModule');if(!root)return;
  const page=document.querySelector('.page.active')?.id.replace(/^page-/,'');
  root.hidden=!!window.isStaffWorkspace||!pages.has(page);
  if(root.hidden){measureHeader();return;}
  const items=entries();let index=browsing?items.findIndex(entry=>key(entry)===selectedKey):0;if(index<0){index=0;browsing=false;}
  const entry=items[index];selectedKey=entry?key(entry):'';
  const category=entry?newsCategory(entry):'',status=entry?newsStatus(entry):['','info'];
  const markup='<div class="signals-heading"><span aria-hidden="true">◉</span><strong>RECENT SIGNALS</strong></div>'+
   (entry?'<div class="signal-message" data-status="'+status[1]+'"><span class="signal-category-icon" aria-hidden="true">'+newsIcon(category)+'</span><div class="signal-message-copy"><span class="signal-message-text" title="'+esc(entry.text||'')+'">'+esc(entry.text||'Unknown signal')+'</span><small>'+esc(category.replaceAll('_',' '))+' · '+status[0]+' · T'+Number(entry.tick||0)+'</small></div></div>':'<div class="signal-message"><span class="signal-message-text">No recent signals in your selected categories.</span></div>')+
   '<div class="signal-controls"><button type="button" data-signals-step="-1" aria-label="Previous signal" '+(index<=0?'disabled':'')+'>‹</button><span aria-label="Signal position">'+(items.length?index+1:0)+'/'+items.length+'</span><button type="button" data-signals-step="1" aria-label="Next signal" '+(index>=items.length-1?'disabled':'')+'>›</button><button type="button" data-goto="planetSettings" data-signals-settings aria-label="Recent Signals settings" title="Signal preferences">⚙</button><button type="button" data-goto="news" class="signals-open-log">NEWS LOG</button></div>';
  if(markup!==lastMarkup){root.innerHTML=markup;lastMarkup=markup;}
  measureHeader();
 }
 function settings(){
  const host=document.querySelector('#planetSettingsContent .planet-settings-centered');if(!host)return;
  let panel=document.getElementById('recentSignalsSettings');if(!panel){panel=document.createElement('section');panel.id='recentSignalsSettings';panel.className='settings-card panel';host.append(panel);}
  const filters=preferences();
  panel.innerHTML='<div class="ph"><div class="pt">RECENT SIGNALS HEADER</div></div><div class="settings-body"><p>Choose which news categories appear on action pages. The full News Log has its own filters.</p><label class="signal-filter-all"><input type="checkbox" data-signals-all> All available categories</label><div class="signal-category-settings">'+NEWS_CATEGORIES.map(category=>'<label><input type="checkbox" data-signals-category="'+category+'" '+(filters[category]?'checked ':'')+(category==='SYSTEM'?'disabled ':'')+'>'+esc(category.replaceAll('_',' '))+'</label>').join('')+'</div><small>System messages remain in the full News Log. The header is shown on Overview and pages for economy, development, fleet actions and alliance operations. It is hidden on browsing, messages, forums, settings and staff pages.</small></div>';
  syncControls();
 }
 function syncControls(){const filters=preferences(),available=NEWS_CATEGORIES.filter(category=>category!=='SYSTEM'),count=available.filter(category=>filters[category]).length;document.querySelectorAll('[data-signals-category]').forEach(input=>input.checked=!!filters[input.dataset.signalsCategory]);const master=document.querySelector('[data-signals-all]');if(master){master.checked=count===available.length;master.indeterminate=count>0&&count<available.length;}}
 const originalSettings=renderPlanetSettings;
 renderPlanetSettings=function(...args){const result=originalSettings.apply(this,args);settings();return result;};
 const originalNavigate=navigate;
 navigate=function(...args){const result=originalNavigate.apply(this,args);render();return result;};
 renderRailNews=render;
 document.addEventListener('click',event=>{if(event.target.closest('[data-signals-settings]'))document.getElementById('recentSignalsSettings')?.scrollIntoView({block:'center',behavior:'smooth'});const button=event.target.closest('[data-signals-step]');if(!button)return;const items=entries(),index=Math.max(0,items.findIndex(entry=>key(entry)===selectedKey)),next=items[Math.max(0,Math.min(items.length-1,index+Number(button.dataset.signalsStep)))];if(next){selectedKey=key(next);browsing=items.indexOf(next)>0;render();}});
 document.addEventListener('change',event=>{const input=event.target.closest('[data-signals-category],[data-signals-all]');if(!input)return;const filters=preferences();if(input.hasAttribute('data-signals-all'))for(const category of NEWS_CATEGORIES)filters[category]=category!=='SYSTEM'&&input.checked;else if(input.dataset.signalsCategory!=='SYSTEM')filters[input.dataset.signalsCategory]=input.checked;state.userSettings.recentSignalsCategories=filters;selectedKey='';browsing=false;save();syncControls();render();});
 if(typeof ResizeObserver==='function'){const header=document.querySelector('.shell>.topbar');if(header)new ResizeObserver(measureHeader).observe(header);}
 window.recentSignalsModule={render,settings,preferences,entries,pages};
 render();
})();
