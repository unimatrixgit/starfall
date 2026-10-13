const fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=path.resolve(__dirname,'..'),assets={};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.css':'text/css; charset=utf-8'};
function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['server','.openai'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())collect(full);else{if(entry.name.endsWith('.png')&&fs.existsSync(full.replace(/\.png$/,'.webp')))continue;const url='/'+path.relative(path.join(root,'dist'),full).replaceAll('\\','/');assets[url]={data:fs.readFileSync(full).toString('base64'),type:mime[path.extname(full)]||'application/octet-stream'};}}}
collect(path.join(root,'dist'));
const output=path.join(root,'dist/server');fs.mkdirSync(output,{recursive:true});
const worker='const DEFAULT_ROUND='+fs.readFileSync(path.join(root,'worker/default-round.json'),'utf8')+';\n'+'const ASSETS='+JSON.stringify(assets)+';\n'+fs.readFileSync(path.join(root,'worker/portal.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'worker/planets.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'worker/accounts.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'worker/alliance.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'worker/forums.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'worker/index.js'),'utf8');
fs.writeFileSync(path.join(output,'index.js'),worker);
fs.mkdirSync(path.join(root,'dist/.openai'),{recursive:true});fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
fs.cpSync(path.join(root,'drizzle'),path.join(root,'dist/.openai/drizzle'),{recursive:true});
console.log('Worker bundle: '+Object.keys(assets).length+' assets, '+Math.round(zlib.gzipSync(worker).length/1024)+' KiB compressed');
