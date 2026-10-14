const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('create form captured while affiliated is reopened and visible on the unaffiliated welcome',()=>{
 const source=fs.readFileSync('dist/population-development.js','utf8');
 const create={hidden:true,open:false,closest:()=>null,remove(){},get outerHTML(){return '<details id="allianceCreatePanel"'+(this.hidden?' hidden':'')+(this.open?' open':'')+'><input id="newAllianceName"></details>';}};
 const page={dataset:{}};
 const context=vm.createContext({state:{alliance:{name:'Unaffiliated'}},document:{getElementById:id=>id==='allianceCreatePanel'?create:page,querySelector:()=>null}});
 vm.runInContext(source.slice(source.indexOf("let allianceWelcomeCreate="),source.indexOf('\n',source.indexOf('function allianceWelcomeHTML'))),context);
 const html=vm.runInContext('prepareAllianceWelcome();allianceWelcomeHTML()',context);
 assert.match(html,/id="newAllianceName"/);assert.match(html,/id="allianceCreatePanel" open/);assert.doesNotMatch(html,/id="allianceCreatePanel" hidden/);
});
