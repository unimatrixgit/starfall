const fs=require('node:fs'),path=require('node:path');
function packageWorker(root,target){
 const output=path.join(target,'dist');fs.mkdirSync(path.join(output,'server'),{recursive:true});fs.copyFileSync(path.join(root,'dist/server/index.js'),path.join(output,'server/index.js'));
 // Hosting discovers migrations beside the manifest, not beside the server folder.
 fs.cpSync(path.join(root,'dist/.openai'),path.join(output,'.openai'),{recursive:true});
 const expected=fs.readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort(),actual=fs.readdirSync(path.join(output,'.openai/drizzle')).filter(n=>n.endsWith('.sql')).sort();
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('The release is missing database migrations');return expected.length;
}
if(require.main===module){if(!process.argv[2])throw Error('An output directory is required');console.log('Packaged Worker with '+packageWorker(path.resolve(__dirname,'..'),path.resolve(process.argv[2]))+' migrations');}
module.exports={packageWorker};
