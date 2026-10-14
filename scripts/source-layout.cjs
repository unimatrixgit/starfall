const fs=require('node:fs'),path=require('node:path');
const SOURCE_LAYOUT=Object.freeze([
 ['portal','staff-roster.js'],['portal','staff-roster.css'],['portal','diagnostics.js'],['portal','diagnostics.css'],['portal','registration-compact.css'],['portal','portal.css'],
 ['game','game.js'],['game','index.html'],['game','game-spacing.css'],['game','fleet-features.js'],
 ['shared','portal.js'],['shared','display-names.js']
].map(([owner,file])=>Object.freeze({owner,file,source:'app-src/'+owner+'/'+file,output:'dist/'+file})));
const DEFAULT_ROOT=path.resolve(__dirname,'..');
function sourceEntry(file){return SOURCE_LAYOUT.find(entry=>entry.file===file||entry.output===file)||null;}
function resolveSource(file,root=DEFAULT_ROOT){const entry=sourceEntry(file);if(!entry)throw new Error('Unknown frontend source: '+file);const canonical=path.resolve(root,entry.source);return fs.existsSync(canonical)?canonical:path.resolve(root,entry.output);}
module.exports={SOURCE_LAYOUT,resolveSource,sourceEntry};
