// SF-112: observed tick receipts settle with the colony and treasury in one CAS batch.
const ALLIANCE_INCOME_RESOURCES=['metal','crystal','eonium'];
function allianceIncomeZero(){return {metal:0,crystal:0,eonium:0};}
function allianceIncomeGalaxy(coords){return String(coords||'').split(':').slice(0,2).map(Number).join(':');}
function allianceIncomeAssessment(gross,enabled,rate,encouragement,stronghold){
 const ordinary=allianceIncomeZero(),bribe=allianceIncomeZero();
 for(const k of ALLIANCE_INCOME_RESOURCES){ordinary[k]=enabled?Math.floor(gross[k]*Math.max(0,Math.min(5,rate||0))/100):0;bribe[k]=stronghold?Math.floor(gross[k]*Math.max(0,Math.min(7.5,encouragement||0))/100):0;}
 return {ordinary,bribe};
}
async function allianceIncomePlan(env,p,b,previousTick,generation){
 const receipts=b.allianceIncomeTicks||[];
 if(!Array.isArray(receipts)||receipts.length>10000)return {error:'Invalid alliance income receipts.'};
 const ticks=new Set();
 for(const r of receipts){if(!r||!Number.isSafeInteger(r.tick)||r.tick<0||r.tick>b.publicTick||ticks.has(r.tick)||typeof r.enabled!=='boolean'||typeof r.alliance!=='string'||!r.gross||!ALLIANCE_INCOME_RESOURCES.every(k=>Number.isSafeInteger(r.gross[k])&&r.gross[k]>=0&&r.gross[k]<=1e12))return {error:'Invalid alliance income receipt.'};ticks.add(r.tick);}
 const row=p.alliance&&p.alliance!=='Unaffiliated'?await env.DB.prepare('SELECT data_json FROM planet_alliances WHERE name=?').bind(p.alliance).first():null;
 const ordinary=allianceIncomeZero(),bribe=allianceIncomeZero();
 if(!row)return {ordinary,bribe,statements:()=>[]};
 const a=JSON.parse(row.data_json),claim=await env.DB.prepare("SELECT galaxy FROM stronghold_claims WHERE generation=? AND alliance_id=? AND status='active'").bind(generation,a.registryId||'').first();
 const stronghold=!!claim&&allianceIncomeGalaxy(p.coords)===allianceIncomeGalaxy(claim.galaxy);
 for(const r of receipts.filter(r=>r.tick>previousTick&&r.alliance===(a.registryId||a.name))){
  const assessment=allianceIncomeAssessment(r.gross,r.enabled,a.tax,a.strongEncouragement,stronghold);
  for(const k of ALLIANCE_INCOME_RESOURCES){ordinary[k]+=assessment.ordinary[k];bribe[k]+=assessment.bribe[k];}
 }
 if(ALLIANCE_INCOME_RESOURCES.some(k=>ordinary[k]+bribe[k]>(p.resources[k]||0)))return {error:'Keep enough planetary resources to settle the pending alliance income levy, then retry.'};
 if(!ALLIANCE_INCOME_RESOURCES.some(k=>ordinary[k]+bribe[k]))return {ordinary,bribe,statements:()=>[]};
 a.fund=a.fund||allianceIncomeZero();a.fundSettlementVersion=1;
 a.incomeLedger=a.incomeLedger||{ordinary:allianceIncomeZero(),bribe:allianceIncomeZero()};
 for(const k of ALLIANCE_INCOME_RESOURCES){const debit=ordinary[k]+bribe[k];p.resources[k]-=debit;p.allianceIncomeTaxTotal={...p.allianceIncomeTaxTotal,[k]:(p.allianceIncomeTaxTotal?.[k]||0)+debit};a.fund[k]=(a.fund[k]||0)+debit;a.incomeLedger.ordinary[k]=(a.incomeLedger.ordinary[k]||0)+ordinary[k];a.incomeLedger.bribe[k]=(a.incomeLedger.bribe[k]||0)+bribe[k];}
 a.incomeLedger.lastTick=b.publicTick;
 return {ordinary,bribe,statements:op=>[env.DB.prepare('UPDATE planet_alliances SET data_json=?,updated_at=? WHERE name=? AND EXISTS(SELECT 1 FROM planet_directory_meta WHERE operation_id=?)').bind(JSON.stringify(a),Date.now(),a.name,op)]};
}
async function allianceIncomeProjection(env,a){
 const meta=await env.DB.prepare('SELECT reset_generation FROM planet_directory_meta WHERE id=1').first(),claim=await env.DB.prepare("SELECT galaxy FROM stronghold_claims WHERE generation=? AND alliance_id=? AND status='active'").bind(meta.reset_generation||0,a.registryId||'').first();
 const rows=(await env.DB.prepare("SELECT data_json FROM planet_directory WHERE kind='planet' AND json_extract(data_json,'$.alliance')=?").bind(a.name).all()).results||[],sources=[];
 for(const row of rows){const p=JSON.parse(row.data_json);if(!p.incomeReport||!ALLIANCE_INCOME_RESOURCES.every(k=>Number.isFinite(p.incomeReport[k]?.gross)))continue;sources.push({gross:Object.fromEntries(ALLIANCE_INCOME_RESOURCES.map(k=>[k,p.incomeReport[k].gross])),enabled:!!p.allianceTaxEnabled,stronghold:!!claim&&allianceIncomeGalaxy(p.coords)===allianceIncomeGalaxy(claim.galaxy),tick:p.publicTick||0});}
 return {sources,reported:sources.length,planets:rows.length,stronghold:claim?.galaxy||'',tax:a.tax||0,strongEncouragement:a.strongEncouragement||0,ledger:a.incomeLedger||{ordinary:allianceIncomeZero(),bribe:allianceIncomeZero()}};
}
