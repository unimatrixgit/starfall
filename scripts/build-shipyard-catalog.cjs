// Keep the server Shipyards catalogue aligned with the authored official ship data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'dist/ship-catalog.js'),'utf8')+';this.rows=SHIP_CATALOG;',context);
const catalog={};for(const row of context.rows){const id=row[0].toLowerCase()+'-'+row[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(catalog[id])throw Error('Duplicate shipyard hull '+id);catalog[id]={id,race:row[0],name:row[1],class:row[2],factory:['Fighter','Corvette'].includes(row[2])?'lightFactory':['Frigate','Destroyer'].includes(row[2])?'mediumFactory':'heavyFactory',pod:row[6]==='Pod',cost:{metal:row[13],crystal:row[14],eonium:row[15]}};}
const output='// Generated from the current official client catalogue; regenerate when catalogue changes.\nconst SHIPYARD_CATALOG='+JSON.stringify(catalog)+';\n',target=path.join(root,'worker/shipyards-catalog.js');
if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==output)fs.writeFileSync(target,output);
