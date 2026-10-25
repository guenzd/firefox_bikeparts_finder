import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./src/ui/theme.js',import.meta.url),'utf8');
function setup(saved,matches=false,storageOverride={}){
 const root={dataset:{}},writes=[],media={matches,addEventListener(_name,fn){this.change=fn;}};
 const storage={async get(){return {themePreference:saved};},async set(data){writes.push(data.themePreference);},...storageOverride};
 const ctx=vm.createContext({});vm.runInContext(source,ctx);
 return {root,media,writes,controller:ctx.createThemeController({root,media,storage})};
}
test('Theme defaults to browser preference and follows live changes without persisting an override',async()=>{
 const e=setup(undefined,true);assert.equal(e.root.dataset.theme,'dark');await e.controller.ready;
 e.media.matches=false;e.media.change();assert.equal(e.root.dataset.theme,'light');assert.deepEqual(e.writes,[]);
});
test('Manual toggle persists, survives reload and ignores browser changes until reset to Automatic',async()=>{
 const e=setup(undefined,true);await e.controller.ready;await e.controller.toggle();assert.equal(e.root.dataset.theme,'light');assert.deepEqual(e.writes,['light']);
 e.media.change();assert.equal(e.root.dataset.theme,'light');
 const reloaded=setup(e.writes.at(-1),true);await reloaded.controller.ready;assert.equal(reloaded.root.dataset.theme,'light');
 await reloaded.controller.select('auto');assert.equal(reloaded.root.dataset.theme,'dark');reloaded.media.matches=false;reloaded.media.change();assert.equal(reloaded.root.dataset.theme,'light');
});
test('Late storage reads cannot undo a user toggle; failed storage does not break switching',async()=>{
 let release;const e=setup(undefined,false,{get:()=>new Promise(resolve=>{release=resolve;}),set:()=>Promise.reject(Error('Unavailable'))});
 await Promise.resolve();await e.controller.toggle();release({themePreference:'light'});await e.controller.ready;assert.equal(e.root.dataset.theme,'dark');
 await e.controller.toggle();assert.equal(e.root.dataset.theme,'light');
 const bad=setup(undefined,true,{get:()=>Promise.reject(Error('Unavailable'))});await bad.controller.ready;assert.equal(bad.root.dataset.theme,'dark');
});
test('Native keyboard-accessible controls reflect loaded preference and reset visibility',async()=>{
 const controls=Object.fromEntries(['theme-toggle','theme-auto'].map(id=>[id,{attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn){this[type]=fn;}}]));
 const root={dataset:{}},events={};
 const ctx=vm.createContext({document:{documentElement:root,getElementById:id=>controls[id],addEventListener:(type,fn)=>{events[type]=fn;}},matchMedia:()=>({matches:false,addEventListener(){}}),installedPlatform:()=>({storage:{local:{async get(){return {themePreference:'dark'};},async set(){}}}})});
 vm.runInContext(source,ctx);await new Promise(setImmediate);events.DOMContentLoaded();
 assert.equal(controls['theme-toggle'].attrs['aria-pressed'],'true');assert.equal(controls['theme-auto'].hidden,false);
 controls['theme-auto'].click();assert.equal(root.dataset.theme,'light');assert.equal(controls['theme-auto'].hidden,true);
 controls['theme-toggle'].click();assert.equal(root.dataset.theme,'dark');assert.equal(controls['theme-auto'].hidden,false);
});
