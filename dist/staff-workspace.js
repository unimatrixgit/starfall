'use strict';
const staffParams=new URLSearchParams(location.search);
window.isStaffWorkspace=staffParams.get('staff_workspace')==='1';
if(staffParams.get('legacy_staff')==='1')localStorage.setItem('starfall-legacy-staff-view','1');
window.useLegacyStaffView=localStorage.getItem('starfall-legacy-staff-view')==='1';
if(window.isStaffWorkspace){document.body.classList.add('staff-workspace');if(!localStorage.getItem('starfall-staff-workspace-v1')){const existing=localStorage.getItem('starfall-round-v2');if(existing)localStorage.setItem('starfall-staff-workspace-v1',existing);}}
function applyStaffViewPreference(){const menu=document.getElementById('legacyStaffMenu');if(menu)menu.hidden=!window.isGameAdmin||window.isStaffWorkspace||!window.useLegacyStaffView;const toggle=document.getElementById('staffLegacyToggle');if(toggle){toggle.checked=window.useLegacyStaffView;toggle.onchange=()=>{window.useLegacyStaffView=toggle.checked;localStorage.setItem('starfall-legacy-staff-view',toggle.checked?'1':'0');};}}
function openPortalStaffWorkspace(id){const routes={control:'adminControl',alliances:'adminAlliances',multihunters:'adminMultihunters'};if(!window.isGameAdmin)return;const frame=document.querySelector('[data-staff-workspace="'+id+'"]');if(frame&&!frame.getAttribute('src'))frame.src='/game?staff_workspace=1#'+routes[id];}
function openStaffHash(){const id=location.hash.slice(1);if(!['control','alliances','multihunters','tickets','users','news','reset'].includes(id))return;const button=document.querySelector('[data-staff-tab="'+id+'"]');if(button)button.click();}
document.addEventListener('starfall-session-ready',()=>{applyStaffViewPreference();openStaffHash();});
document.addEventListener('click',e=>{const button=e.target.closest('[data-staff-tab]');if(button){location.hash=button.dataset.staffTab;openPortalStaffWorkspace(button.dataset.staffTab);}});
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='starfall-staff-height'||!Number.isFinite(e.data.height))return;for(const frame of document.querySelectorAll('[data-staff-workspace]'))if(frame.contentWindow===e.source)frame.style.height=Math.max(600,Math.min(20000,e.data.height))+'px';});
if(window.isStaffWorkspace)setInterval(()=>{if(window.parent!==window)window.parent.postMessage({type:'starfall-staff-height',height:(document.getElementById('page-admin')?.getBoundingClientRect().height||600)+40},location.origin);},1000);
applyStaffViewPreference();
if(window.isGameAdmin)openStaffHash();
