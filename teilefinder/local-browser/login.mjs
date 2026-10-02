import { launchSession } from './browser-session.mjs';
let context;
try{
 context=await launchSession({visible:true});
 const page=context.pages()[0]||await context.newPage();
 await page.goto('https://www.bike24.de/',{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
 console.log('\nMelde dich im geöffneten BIKE24-Browser selbst an und führe eventuelle Sicherheitsprüfungen selbst durch.');
 console.log('Passwörter nicht in dieses Terminal oder in den Chat eingeben.');
 console.log('Danach alle Fenster dieses separaten Browsers schließen. Die Sitzung bleibt lokal gespeichert.');
 await new Promise(resolve=>context.once('close',resolve));
 console.log('Browser geschlossen. Jetzt Teilefinder-starten.command öffnen.');
}catch(e){console.error('Der Anmelde-Browser konnte nicht öffnen. Falls Teilefinder noch läuft, dort Strg+C drücken und erneut starten.');console.error(String(e.message).split('\n')[0]);process.exitCode=1;}finally{await context?.close().catch(()=>{});}
