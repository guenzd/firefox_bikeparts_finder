import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
if(Number(process.versions.node.split('.')[0])<22){console.error('Bitte Node.js 22 oder neuer installieren.');process.exit(1);}
const env={...process.env,TEILEFINDER_STARTED_BY_LAUNCHER:'1',PLAYWRIGHT_BROWSERS_PATH:resolve(root,'..','work','browsers'),npm_config_cache:resolve(root,'..','work','npm-cache')};
function run(file,args){return new Promise((ok,fail)=>{const p=spawn(file,args,{cwd:root,env,stdio:'inherit'});p.on('error',fail);p.on('exit',code=>code===0?ok():fail(Error('Start fehlgeschlagen.')));});}
try{
 if(!existsSync('node_modules/vinext'))await run('npm',['ci','--ignore-scripts']);
 if(!existsSync('local-browser/node_modules/playwright'))await run('npm',['ci','--prefix','local-browser','--ignore-scripts']);
 if(!['/Applications/Chromium.app/Contents/MacOS/Chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',env.TEILEFINDER_BROWSER].filter(Boolean).some(existsSync))await run(process.execPath,['local-browser/node_modules/playwright/cli.js','install','chromium']);
 if(process.argv.includes('--login')){await run(process.execPath,['local-browser/login.mjs']);process.exit(0);}
 const occupied=await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(1000)}).then(()=>true).catch(()=>false);
 if(occupied)throw Error('Auf Port 5173 läuft bereits eine Seite. Bitte den bisherigen Teilefinder im zugehörigen Terminal mit Strg+C beenden und erneut starten.');
 const server=spawn(process.execPath,['--experimental-strip-types','scripts/run-framework.mjs','dev'],{cwd:root,env,stdio:'inherit'});
 let opened=false;
 const timer=setInterval(async()=>{if(opened)return;try{const r=await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(1500)});if(r.ok){opened=true;clearInterval(timer);spawn('open',['http://127.0.0.1:5173/'],{stdio:'ignore'});console.log('\nTeilefinder ist geöffnet. Dieses Terminal offen lassen. Beenden: Strg+C.');}}catch{}},1000);
 server.on('exit',code=>{clearInterval(timer);process.exit(code||0);});
 server.on('error',e=>{clearInterval(timer);console.error(e.message);process.exit(1);});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.kill(signal);});
}catch(e){console.error(e.message);process.exit(1);}
