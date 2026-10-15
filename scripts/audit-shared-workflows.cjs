const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const r=spawnSync(process.execPath,['--test','tests/alliance-treasury.test.cjs','tests/exile-shared.test.cjs'],{cwd:root,encoding:'utf8'});
const report={audit:'SF-068',sourceVersion:'0.126.7',scope:'Isolated central treasury and two-minister exile regression tests',passed:r.status===0,output:r.stdout,error:r.stderr};
fs.writeFileSync(path.join(root,'docs/SF068-SHARED-OBSERVATIONS.json'),JSON.stringify(report,null,2)+'\n');console.log(r.stdout);if(r.status!==0){console.error(r.stderr);process.exitCode=1;}
