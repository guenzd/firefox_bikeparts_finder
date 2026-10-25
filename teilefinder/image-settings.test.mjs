import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./src/ui/image-settings.js',import.meta.url),'utf8');
test('Image checkbox loads persisted preference, changes rules and restores the value on failure',async()=>{
 const ctx=vm.createContext({});vm.runInContext(source,ctx);let fail=false;const sent=[],status={};
 const control={disabled:true,checked:false,addEventListener(type,fn){this[type]=fn;}};
 const platform={runtime:{async sendMessage(data){sent.push(data);if(fail)throw Error('Unavailable');return {loadImages:data.loadImages??true};}}};
 await ctx.bindShopImageSetting(platform,control,status);assert.equal(control.checked,true);assert.equal(control.disabled,false);
 control.checked=false;await control.change();assert.equal(sent.at(-1).loadImages,false);assert.equal(control.checked,false);
 fail=true;control.checked=true;await control.change();assert.equal(control.checked,false);assert.equal(control.disabled,false);assert.match(status.textContent,/nicht geändert/);
});
