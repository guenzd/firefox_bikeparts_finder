import { chromium } from 'playwright';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const profileDirectory=resolve(dirname(fileURLToPath(import.meta.url)),'..','..','work','shop-browser-profile');
export async function launchSession({visible=false}={}){
 mkdirSync(profileDirectory,{recursive:true,mode:0o700});chmodSync(profileDirectory,0o700);
 const executablePath=[process.env.TEILEFINDER_BROWSER,'/Applications/Chromium.app/Contents/MacOS/Chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].filter(Boolean).find(existsSync);
 return chromium.launchPersistentContext(profileDirectory,{headless:!visible,...(executablePath?{executablePath}:{}),chromiumSandbox:true,locale:'de-DE',timezoneId:'Europe/Berlin',viewport:{width:1440,height:1000}});
}
