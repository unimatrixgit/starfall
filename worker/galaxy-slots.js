// Canonical slot policy. Callers supply authoritative claim and asset records.
function canonicalSlotGalaxy(value) {
  const parts=String(value||'').split(':').map(Number);
  return parts.length>=2&&parts.slice(0,2).every(n=>Number.isInteger(n)&&n>=1&&n<=100)?parts.slice(0,2).join(':'):'';
}
function galaxySlotLayout(galaxy, alliances=[], structures=[], ghosts=[]) {
  const key=canonicalSlotGalaxy(galaxy);
  const special=key==='1:1'&&alliances.some(a=>a?.fortress?.claimStatus==='active'&&canonicalSlotGalaxy(a.fortress.strongholdGalaxy)===key);
  const occupied=new Map();
  for(const record of structures) if(canonicalSlotGalaxy(record.coords)===key){const slot=Number(record.slot||String(record.coords).split(':')[2]);if(slot>=11&&slot<=20)occupied.set(slot,'structure');}
  for(const record of ghosts) if(record.ghostPlanet===true&&canonicalSlotGalaxy(record.coords)===key){const slot=Number(String(record.coords).split(':')[2]);if(key==='1:1'&&slot>=11&&slot<=15&&!occupied.has(slot))occupied.set(slot,'ghost');}
  const result=Array.from({length:special?20:15},(_,i)=>({slot:i+1,kind:i<10?'planet':special&&i<15?'ghost':'structure',available:true}));
  // Retain existing assets after claim loss without advertising fresh special slots.
  for(const [slot,kind] of occupied){let entry=result.find(x=>x.slot===slot);if(!entry){entry={slot,kind,available:false,retained:true};result.push(entry);}entry.kind=kind;entry.available=false;}
  return {special,slots:result.sort((a,b)=>a.slot-b.slot),structureSlots:(special?[16,17,18,19,20]:[11,12,13,14,15]).filter(slot=>!occupied.has(slot)),ghostSlots:special?[11,12,13,14,15]:[],tributeSlot:key==='1:1'?11:null};
}
function validGalaxyScanSlot(galaxy,slot,alliances=[],structures=[],ghosts=[]){
 const value=Number(slot),key=canonicalSlotGalaxy(galaxy);if(!key||!Number.isInteger(value)||value<1)return false;
 if(value<=15)return true;if(key!=='1:1'||value>20)return false;
 const layout=galaxySlotLayout(key,alliances,structures,ghosts),entry=layout.slots.find(s=>s.slot===value);
 return !!entry&&entry.kind==='structure'&&(layout.special||entry.retained===true);
}
