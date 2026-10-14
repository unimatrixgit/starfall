const fs=require('node:fs'),path=require('node:path');
const {SOURCE_LAYOUT}=require('./source-layout.cjs');
function syncSourceInputs(root=path.resolve(__dirname,'..')){
 const copied=[],skipped=[];
 for(const entry of SOURCE_LAYOUT){const source=path.resolve(root,entry.source),output=path.resolve(root,entry.output);if(!fs.existsSync(source)){skipped.push(entry.file);continue;}if(!fs.statSync(source).isFile())throw new Error('Canonical source must be a regular file: '+entry.source);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(source,output);copied.push(entry.file);}
 return {copied,skipped};
}
if(require.main===module){const result=syncSourceInputs();console.log('Canonical inputs copied: '+result.copied.length+'; legacy inputs retained: '+result.skipped.length);}
module.exports={syncSourceInputs};
