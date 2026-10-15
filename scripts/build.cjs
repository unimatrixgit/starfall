const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const script of ['sync-source-inputs.cjs','build-game-seed.cjs','build-portal.cjs','build-game-styles.cjs','build-worker.cjs','audit-links.cjs']){const result=spawnSync(process.execPath,[path.join(__dirname,script)],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
