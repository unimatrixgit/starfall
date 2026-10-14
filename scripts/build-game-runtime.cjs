const fs=require('fs');
const files=["ship-catalog.js","display-names.js","admin-alliances.js","fleet-features.js","game.js","attack-operations.js","forums.js","miday.js","portal.js","planets.js","tickets.js","ambient.js","communications.js","population-development.js","special-worlds.js","spacing-bank.js","site-management.js"];
let bundle=files.map(file=>{let source=fs.readFileSync('dist/'+file,'utf8');if(file==='game.js')source=source.replace('normalizeGalaxySlots();update();setInterval(updateCountdown,1000);','');return '\n// '+file+'\n'+source+'\n';}).join('');
bundle+='\nnormalizeGalaxySlots();update();setInterval(updateCountdown,1000);window.starfallGameReady=true;\n';
fs.writeFileSync('dist/game-runtime.js',bundle);
console.log('Game runtime: '+Buffer.byteLength(bundle)+' bytes; one ordered script.');
