import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./src/ui/theme.js',import.meta.url),'utf8');
function setup(matches=false){
 const root={dataset:{}},media={matches,addEventListener(_name,fn){this.change=fn;}};
 const ctx=vm.createContext({});vm.runInContext(source,ctx);
 return {root,media,controller:ctx.createThemeController({root,media})};
}
test('Theme starts with the browser preference and follows live browser changes',()=>{
 const e=setup(true);assert.equal(e.root.dataset.theme,'dark');
 e.media.matches=false;e.media.change();assert.equal(e.root.dataset.theme,'light');
});
test('Sun/moon toggles only the current page; reopening starts with the browser theme again',()=>{
 const e=setup(true);e.controller.toggle();assert.equal(e.root.dataset.theme,'light');
 e.media.change();assert.equal(e.root.dataset.theme,'light');
 e.controller.toggle();assert.equal(e.root.dataset.theme,'dark');
 const reopened=setup(false);assert.equal(reopened.root.dataset.theme,'light');
});
test('Single native toggle reflects the browser theme and remains keyboard accessible without storage APIs',()=>{
 const toggle={attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn){this[type]=fn;}};
 const root={dataset:{}},events={};
 const ctx=vm.createContext({document:{documentElement:root,getElementById:id=>id==='theme-toggle'?toggle:null,addEventListener:(type,fn)=>{events[type]=fn;}},matchMedia:()=>({matches:true,addEventListener(){}})});
 vm.runInContext(source,ctx);events.DOMContentLoaded();
 assert.equal(toggle.attrs['aria-pressed'],'true');toggle.click();assert.equal(root.dataset.theme,'light');assert.equal(toggle.attrs['aria-pressed'],'false');
 const html=readFileSync(new URL('./src/ui/home.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/theme-auto/);assert.match(html,/<button id="theme-toggle" type="button" aria-label="Dunkles Design"/);
});
