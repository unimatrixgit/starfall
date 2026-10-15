const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function bundleGameStyles(root){const file=path.join(root,'dist/index.html');let html=fs.readFileSync(file,'utf8');const used=new Set();
 // Combine only adjacent enabled links: inline rules and disabled staff styles retain their exact cascade positions.
 html=html.replace(/(?:<link\b(?![^>]*\bdisabled\b)(?=[^>]*\brel="stylesheet")[^>]*>\s*){2,}/g,group=>{const links=[...group.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)];if(links.length<2)return group;const css=links.map(([,url])=>{const parsed=new URL(url,'https://local.test');if(parsed.origin!=='https://local.test'||!/^\/[\w.-]+\.css$/.test(parsed.pathname))throw Error('Unsupported stylesheet bundle input');return '/* '+parsed.pathname+' */\n'+fs.readFileSync(path.join(root,'dist',parsed.pathname.slice(1)),'utf8').replace(/@charset\s+[^;]+;/gi,'');}).join('\n');const hash=crypto.createHash('sha256').update(css).digest('hex').slice(0,12),name='game-styles-'+hash+'.css';used.add(name);fs.writeFileSync(path.join(root,'dist',name),css);return '<link rel="stylesheet" href="/'+name+'">\n';});
 fs.writeFileSync(file,html);for(const file of fs.readdirSync(path.join(root,'dist')))if(/^game-styles-[a-f0-9]{12}\.css$/.test(file)&&!used.has(file))fs.unlinkSync(path.join(root,'dist',file));return used.size;
}
if(require.main===module)console.log('Game stylesheet bundles: '+bundleGameStyles(path.resolve(__dirname,'..')));
module.exports={bundleGameStyles};
