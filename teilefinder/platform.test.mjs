import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=name=>readFileSync(new URL('./src/platform/'+name,import.meta.url),'utf8');
const event=()=>{const listeners=new Set();return {listeners,addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit(...args){for(const fn of [...listeners])fn(...args);}};};
function environment(kind='chrome'){
 const session={},local={},tabs=new Map(),removed=[],messages=[];let nextId=100;
 const scheme=kind==='chrome'?'chrome-extension':'moz-extension',home=scheme+'://unit/ui/home.html';
 tabs.set(1,{id:1,url:home});tabs.set(2,{id:2,url:home});
 const native={runtime:{id:'unit',getURL:path=>scheme+'://unit/'+path,onMessage:event(),async sendMessage(data){messages.push(data);return {ok:true};}},tabs:{onRemoved:event(),async get(id){if(!tabs.has(id))throw Error('Closed');return {...tabs.get(id)};},async getCurrent(){return {...tabs.get(1)};},async query(){return [...tabs.values()];},async create(options){const tab={id:++nextId,...options};tabs.set(tab.id,tab);return tab;},async update(id,options){if(!tabs.has(id))throw Error('Closed');Object.assign(tabs.get(id),options);return {...tabs.get(id)};},async remove(id){if(!tabs.has(id))throw Error('Closed');removed.push(id);tabs.delete(id);native.tabs.onRemoved.emit(id);},async sendMessage(id,data){return {id,data};}},storage:Object.fromEntries([['local',local],['session',session]].map(([name,storage])=>[name,{async get(key){return {[key]:structuredClone(storage[key])};},async set(data){Object.assign(storage,structuredClone(data));}}]))};
 native[kind==='chrome'?'action':'browserAction']={onClicked:event()};
 const ctx=vm.createContext({URL});vm.runInContext(source('api.js')+source('registry.js'),ctx);
 const api=ctx.createNativePlatform(native),sender={id:'unit',url:home,tab:{id:1}};
 return {ctx,native,api,session,local,tabs,removed,messages,home,sender};
}
for(const kind of ['firefox','chrome'])test(`${kind} adapter preserves native methods, async replies, errors and unhandled-message channels`,async()=>{
 const e=environment(kind);await e.api.storage.local.set({wishlist:[{name:'one'}]});assert.equal((await e.api.storage.local.get('wishlist')).wishlist[0].name,'one');assert.equal((await e.api.tabs.getCurrent()).id,1);
 assert.equal(e.api.action,e.native[kind==='chrome'?'action':'browserAction']);
 e.api.runtime.onMessage.addListener(data=>data.type==='handled'?Promise.resolve({value:42}):undefined);
 const listener=[...e.native.runtime.onMessage.listeners][0];let response;
 assert.equal(listener({type:'ignored'},e.sender,value=>{response=value;}),false);assert.equal(response,undefined);
 assert.equal(listener({type:'handled'},e.sender,value=>{response=value;}),true);await new Promise(setImmediate);assert.equal(response.value,42);
 const reject=()=>Promise.reject(Error('Read failed'));e.api.runtime.onMessage.addListener(reject);
 [...e.native.runtime.onMessage.listeners][1]({},e.sender,value=>{response=value;});await new Promise(setImmediate);assert.equal(response.__teilefinderPlatformError,'Read failed');
 e.native.runtime.sendMessage=async()=>({__teilefinderPlatformError:'Read failed'});await assert.rejects(e.api.runtime.sendMessage({}),/Read failed/);
 e.api.runtime.onMessage.removeListener(reject);assert.equal(e.native.runtime.onMessage.listeners.size,1);
});

test('Registry restores ownership after restart and closes only the correct parent’s registered shop tabs',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);
 for(const id of [11,12,21,99])e.tabs.set(id,{id,url:'https://www.bike24.de/product'});
 await Promise.all([11,12].map(tabId=>registry.register({type:'register-shop-tab',owner:1,tabId},e.sender)));
 await registry.register({type:'register-shop-tab',owner:2,tabId:21},{...e.sender,tab:{id:2}});
 assert.equal(registry.register({type:'register-shop-tab',owner:1,tabId:99},{id:'unit',url:'https://www.bike24.de/',tab:{id:1}}),undefined);
 assert.equal(registry.register({type:'register-shop-tab',owner:1,tabId:99},{...e.sender,id:'foreign'}),undefined);
 assert.equal(registry.register({type:'register-shop-tab',owner:2,tabId:99},e.sender),undefined);
 assert.equal((await registry.register({type:'register-shop-tab',owner:2,tabId:11},{...e.sender,tab:{id:2}})).registered,false);
 const restarted=e.ctx.createTabRegistry(e.api);await restarted.removed(1);
 assert.deepEqual(e.removed.sort(),[11,12]);assert.ok(e.tabs.has(21));assert.ok(e.tabs.has(99));assert.deepEqual(e.session.ownedShopTabs['2'],[21]);
 await restarted.removed(21);assert.deepEqual(e.session.ownedShopTabs['2'],[]);
});

test('Registry handles a parent closing during registration without orphaning existing children',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);
 for(const id of [11,12])e.tabs.set(id,{id,url:'https://www.bike24.de/product'});
 await registry.register({type:'register-shop-tab',owner:1,tabId:11},e.sender);
 const set=e.api.storage.session.set;e.api.storage.session.set=async data=>{await set(data);if(data.ownedShopTabs['1']?.includes(12))e.tabs.delete(1);};
 assert.equal((await registry.register({type:'register-shop-tab',owner:1,tabId:12},e.sender)).registered,false);
 assert.deepEqual(e.removed.sort(),[11,12]);assert.equal(e.session.ownedShopTabs['1'],undefined);
});

test('Page platform keeps UI/manual tabs separate from search tabs and rolls back rejected registrations',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);
 const page=e.ctx.createPagePlatforms(e.api);let seen;
 page.ui.runtime.onMessage.addListener((data,sender)=>{seen=sender;return {accepted:data.type==='search'};});
 assert.equal((await page.ui.runtime.sendMessage({type:'search'})).accepted,true);assert.equal(seen.tab.id,1);assert.equal(seen.url,e.home);
 assert.equal(e.native.runtime.onMessage.listeners.size,0,'UI command bus is not exposed to content scripts');
 const owned=await page.search.tabs.create({url:'https://r2-bike.com/example'}),manual=await page.ui.tabs.create({url:'https://r2-bike.com/manual'});
 assert.deepEqual(e.session.ownedShopTabs['1'],[owned.id]);assert.ok(!e.session.ownedShopTabs['1'].includes(manual.id));
 e.native.runtime.sendMessage=async()=>({registered:false});await assert.rejects(page.search.tabs.create({url:'https://r2-bike.com/rejected'}),/zugeordnet/);assert.ok([...e.tabs.values()].every(tab=>!tab.url.endsWith('/rejected')));
});

for(const kind of ['firefox','chrome'])test(`${kind} search controller finishes four shops across a background restart`,async()=>{
 const e=environment(kind);let registry=e.ctx.createTabRegistry(e.api),reads=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 e.native.tabs.sendMessage=async(id,data)=>{reads++;await gate;return {ready:true,offers:[{name:'Example product',ean:'1234567890128',price:20,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/product'}]};};
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);const page=e.ctx.createPagePlatforms(e.api);
 const results=[],fast=(fn,ms)=>ms>=10000?setTimeout(fn,ms):setImmediate(fn);
 const ctx=vm.createContext({searchPlatform:page.search,URL,setTimeout:fast,clearTimeout});
 for(const file of ['identifiers.js','products.js','variant-match.js','catalog.js','search-controller.js'])vm.runInContext(readFileSync(new URL('./src/core/'+file,import.meta.url),'utf8'),ctx);
 page.ui.runtime.onMessage.addListener(data=>{if(data.type==='result')results.push(data);});
 const accepted=await page.ui.runtime.sendMessage({type:'search',id:'first',query:'Example product'});assert.equal(accepted.accepted,true);
 for(let i=0;i<15;i++)await new Promise(setImmediate);assert.ok(reads>0);
 registry=e.ctx.createTabRegistry(e.api);release();
 for(let i=0;i<80;i++)await new Promise(setImmediate);
 assert.equal(results.length,4);assert.ok(results.every(row=>row.target===1&&row.offers.length===1));
 await registry.removed(1);assert.equal(e.removed.length,4);
});

test('Background entry registers only lifecycle handlers and toolbar action, not a search engine',async()=>{
 const e=environment('firefox');const ctx=vm.createContext({URL,browser:e.native});
 for(const name of ['api.js','registry.js','background.js'])vm.runInContext(source(name),ctx);
 e.native.browserAction.onClicked.emit();await new Promise(setImmediate);
 assert.ok([...e.tabs.values()].some(tab=>tab.id>100&&tab.url===e.home));
 assert.equal([...e.native.runtime.onMessage.listeners][0]({type:'search'},{id:'unit',url:e.home,tab:{id:1}},()=>assert.fail('worker cannot accept search jobs')),false);
});

test('Reloaded extension pages reuse registered tabs and close old tabs even before starting a new search',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);
 const first=e.ctx.createPagePlatforms(e.api),original=await first.search.tabs.create({url:'https://www.bike24.de/first'});
 const manual=await first.ui.tabs.create({url:'https://www.bike24.de/manual'});
 const reloaded=e.ctx.createPagePlatforms(e.api),reused=await reloaded.search.tabs.create({url:'https://www.bike24.de/updated'});
 assert.equal(reused.id,original.id);assert.equal(e.tabs.get(original.id).url,'https://www.bike24.de/updated');
 const anotherReload=e.ctx.createPagePlatforms(e.api);assert.equal((await anotherReload.ui.runtime.sendMessage({type:'close-shop-tabs'})).closed,1);
 assert.ok(!e.tabs.has(original.id));assert.ok(e.tabs.has(manual.id));
});

test('Real Chrome worker entry registers tabs and cleans them up after terminating and restarting the worker context',async()=>{
 const e=environment('chrome');e.tabs.set(11,{id:11,url:'https://r2-bike.com/owned'});e.tabs.set(99,{id:99,url:'https://r2-bike.com/manual'});
 const start=()=>{let worker;worker=vm.createContext({chrome:e.native,URL,importScripts(...names){for(const name of names)vm.runInContext(source(name),worker);}});vm.runInContext(source('chrome-worker.js'),worker);return worker;};
 start();const listener=[...e.native.runtime.onMessage.listeners][0];
 const response=await new Promise(resolve=>assert.equal(listener({type:'register-shop-tab',owner:1,tabId:11},e.sender,resolve),true));assert.equal(response.registered,true);
 e.native.runtime.onMessage.listeners.clear();e.native.tabs.onRemoved.listeners.clear();e.native.action.onClicked.listeners.clear();
 start();e.tabs.delete(1);e.native.tabs.onRemoved.emit(1);
 for(let i=0;i<20;i++)await new Promise(setImmediate);
 assert.deepEqual(e.removed,[11]);assert.ok(e.tabs.has(99));
});

test('Registry accepts owned tabs while Chrome reports a pending navigation rather than a committed URL',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);
 e.tabs.set(11,{id:11,url:'about:blank',pendingUrl:'https://www.bike24.de/product'});
 assert.equal((await registry.register({type:'register-shop-tab',owner:1,tabId:11},e.sender)).registered,true);
 assert.equal((await registry.lookup({type:'find-shop-tab',owner:1,host:'www.bike24.de'},e.sender)).tab.id,11);
 await registry.removed(1);assert.deepEqual(e.removed,[11]);
});

test('Firefox registers a blank owned tab before navigating, without relying on pendingUrl',async()=>{
 const e=environment('firefox'),registry=e.ctx.createTabRegistry(e.api);
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 const create=e.native.tabs.create,update=e.native.tabs.update;let blankId;
 e.native.tabs.create=async options=>{assert.equal(options.url,'about:blank');const tab=await create(options);blankId=tab.id;return tab;};
 e.native.tabs.update=async(id,options)=>{assert.ok(e.session.ownedShopTabs['1'].includes(id));return update(id,options);};
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);const page=e.ctx.createPagePlatforms(e.api);
 const tab=await page.search.tabs.create({url:'https://www.bike24.de/search',active:false});assert.equal(tab.id,blankId);assert.equal(tab.url,'https://www.bike24.de/search');assert.deepEqual(e.removed,[]);
 const reused=await page.search.tabs.create({url:'https://www.bike24.de/next',active:false});assert.equal(reused.id,tab.id);
});

for(const kind of ['firefox','chrome'])test(`${kind} shop content scripts initialise and answer reader messages without the privileged tabs API`,async()=>{
 const e=environment(kind);delete e.native.tabs;delete e.native.action;delete e.native.browserAction;delete e.native.storage.session;
 const ctx=vm.createContext({[kind==='firefox'?'browser':'chrome']:e.native});
 vm.runInContext(source('api.js')+source('content.js'),ctx);
 vm.runInContext("platform.runtime.onMessage.addListener(async data=>data.type==='detail'?{ready:true,offers:[{price:42}]}:undefined)",ctx);
 const listener=[...e.native.runtime.onMessage.listeners][0];let reply;
 assert.equal(listener({type:'detail'},e.sender,value=>{reply=value;}),true);await new Promise(setImmediate);
 assert.equal(reply.ready,true);assert.equal(reply.offers[0].price,42);
});

for(const kind of ['firefox','chrome'])test(`${kind} transports safe reader error locations through sync and async message failures`,async()=>{
 const e=environment(kind);const error=new ReferenceError('missingReader is not defined');error.stack='missingReader@moz-extension://private-id/shops/reader.js:52:19\nhttps://shop.example/product?ean=1234567890128';
 for(const asyncFailure of [false,true]){
  let reply;const listener=()=>{if(asyncFailure)return Promise.reject(error);throw error;};
  e.api.runtime.onMessage.addListener(listener);const wrapped=[...e.native.runtime.onMessage.listeners].at(-1);wrapped({},e.sender,value=>{reply=value;});await new Promise(setImmediate);
  assert.equal(reply.__teilefinderPlatformError,error.message);assert.equal(reply.errorInfo.site,'shops/reader.js:52:19');assert.equal(reply.errorInfo.signature,'missingReader is not defined');
  e.native.tabs.sendMessage=async()=>reply;
  await assert.rejects(e.api.tabs.sendMessage(1,{}),failure=>failure.code==='REMOTE_SCRIPT_ERROR'&&failure.info.name==='ReferenceError'&&failure.info.site==='shops/reader.js:52:19');
  e.api.runtime.onMessage.removeListener(listener);
 }
 const safe=e.ctx.platformErrorInfo({name:'Error',message:'Product secret 1234567890128 at https://shop.example/product',stack:'secret'});assert.equal(safe.signature,'');assert.equal(safe.site,'');
});

for(const kind of ['firefox','chrome'])test(`${kind} image rules cover only owned shop tabs, precede first navigation, persist preference and survive worker restart`,async()=>{
 const e=environment(kind),rules=new Map(),calls=[];
 e.native.declarativeNetRequest={async updateSessionRules(change){calls.push(change);for(const id of change.removeRuleIds)rules.delete(id);for(const rule of change.addRules)rules.set(rule.id,rule);}};
 const api=e.ctx.createNativePlatform(e.native),registry=e.ctx.createTabRegistry(api);
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 const update=e.native.tabs.update;
 e.native.tabs.update=async(id,options)=>{assert.ok(rules.get(840001)?.condition.tabIds.includes(id),'Images blocked before shop navigation');assert.ok(rules.get(840002)?.condition.tabIds.includes(id),'Document image policy installed before shop navigation');return update(id,options);};
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);const page=e.ctx.createPagePlatforms(api);
 const owned=await page.search.tabs.create({url:'https://r2-bike.com/product',active:false});
 const manual=await page.ui.tabs.create({url:'https://r2-bike.com/manual'});
 assert.equal(rules.size,2);const rule=rules.get(840001);assert.equal(rule.action.type,'block');assert.deepEqual(Array.from(rule.condition.resourceTypes),['image']);assert.deepEqual(Array.from(rule.condition.tabIds),[owned.id]);assert.ok(!rule.condition.tabIds.includes(manual.id));
 assert.ok(rule.condition.initiatorDomains.includes('r2-bike.com'));assert.ok(rule.condition.excludedRequestDomains.includes('challenges.cloudflare.com'));
 assert.equal((await page.ui.runtime.sendMessage({type:'shop-image-settings'})).loadImages,false);
 await page.ui.runtime.sendMessage({type:'shop-image-settings',loadImages:true});assert.equal(rules.size,0);assert.equal(e.local.loadShopImages,true);
 await page.ui.runtime.sendMessage({type:'shop-image-settings',loadImages:false});assert.equal(rules.get(840001).condition.tabIds.length,1);
 rules.clear();await e.ctx.createTabRegistry(api).restore();assert.ok(rules.get(840001).condition.tabIds.includes(owned.id));assert.ok(rules.get(840002).condition.tabIds.includes(owned.id));
 const before=calls.length;assert.equal(registry.lookup({type:'shop-image-settings',owner:1,loadImages:true},{...e.sender,url:'https://r2-bike.com/'}),undefined);assert.equal(calls.length,before);
 await registry.removed(1);assert.equal(rules.size,0);assert.ok(e.tabs.has(manual.id));
});

test('Image rule failures prevent first shop navigation and clean up the new blank tab',async()=>{
 const e=environment();e.native.declarativeNetRequest={async updateSessionRules(){throw Error('Rules unavailable');}};
 const api=e.ctx.createNativePlatform(e.native),registry=e.ctx.createTabRegistry(api);e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);const page=e.ctx.createPagePlatforms(api);let navigated=false;e.native.tabs.update=async()=>{navigated=true;};
 await assert.rejects(page.search.tabs.create({url:'https://www.bike24.de/product'}),/Rules unavailable/);assert.equal(navigated,false);assert.equal(e.removed.length,1);
});

test('Unclaimed blank tabs require a valid shop destination and are closed if their parent closes during setup',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);e.tabs.set(11,{id:11,url:'about:blank',openerTabId:1});
 assert.equal((await registry.register({type:'register-shop-tab',owner:1,tabId:11,url:'https://unrelated.example/'},e.sender)).registered,false);
 assert.equal((await registry.register({type:'register-shop-tab',owner:1,tabId:11,url:'https://r2-bike.com/product'},e.sender)).registered,true);
 await registry.removed(1);assert.deepEqual(e.removed,[11]);
});

test('Blank-tab ownership works without readable URL fields or the broad tabs permission',async()=>{
 const e=environment(),registry=e.ctx.createTabRegistry(e.api);e.tabs.set(11,{id:11,openerTabId:1});e.tabs.set(12,{id:12,openerTabId:2});
 assert.equal((await registry.register({type:'register-shop-tab',owner:1,tabId:12,url:'https://r2-bike.com/product'},e.sender)).registered,false);
 assert.equal((await registry.register({type:'register-shop-tab',owner:1,tabId:11,url:'https://r2-bike.com/product'},e.sender)).registered,true);
 await registry.removed(1);assert.deepEqual(e.removed,[11]);assert.ok(e.tabs.has(12));
});

test('Image rules retain other owners and restore the old rule when saving the preference fails',async()=>{
 const e=environment(),applied=[];e.api.images={async setTabIds(ids){applied.push([...ids].sort((a,b)=>a-b));}};
 const registry=e.ctx.createTabRegistry(e.api);e.tabs.set(11,{id:11,url:'https://r2-bike.com/one'});e.tabs.set(21,{id:21,url:'https://www.bike24.de/two'});
 await registry.register({type:'register-shop-tab',owner:1,tabId:11},e.sender);await registry.register({type:'register-shop-tab',owner:2,tabId:21},{...e.sender,tab:{id:2}});
 assert.deepEqual(applied.at(-1),[11,21]);await registry.removed(1);assert.deepEqual(applied.at(-1),[21]);assert.ok(e.tabs.has(21));
 e.api.storage.local.set=async()=>{throw Error('Storage unavailable');};
 await assert.rejects(registry.lookup({type:'shop-image-settings',owner:2,loadImages:true},{...e.sender,tab:{id:2}}),/Storage unavailable/);
 assert.deepEqual(applied.slice(-2),[[],[21]]);assert.equal(e.local.loadShopImages,undefined);
});

for(const kind of ['firefox','chrome'])test(`${kind} adds only an image CSP to owned shop main frames and removes both rules on opt-out`,async()=>{
 const e=environment(kind);let change;e.native.declarativeNetRequest={async updateSessionRules(data){change=data;}};
 const api=e.ctx.createNativePlatform(e.native);await api.images.setTabIds([17,9,17]);
 const rule=change.addRules.find(rule=>rule.id===840002);assert.ok(rule);assert.equal(rule.action.type,'modifyHeaders');
 assert.deepEqual(Array.from(rule.condition.tabIds),[9,17]);assert.deepEqual(Array.from(rule.condition.resourceTypes),['main_frame']);assert.equal(rule.condition.initiatorDomains,undefined);
 assert.ok(rule.condition.requestDomains.includes('bike24.de'));assert.ok(!rule.condition.requestDomains.includes('images.bike24.com'));
 const headers=rule.action.responseHeaders;assert.equal(headers.length,1);assert.equal(headers[0].header,'content-security-policy');assert.equal(headers[0].operation,'append');
 assert.match(headers[0].value,/^img-src /);assert.doesNotMatch(headers[0].value,/default-src|script-src|style-src|connect-src|data:|blob:|bike24\.com/);assert.ok(headers[0].value.includes('https://challenges.cloudflare.com'));
 await api.images.setTabIds([]);assert.deepEqual(Array.from(change.removeRuleIds),[840001,840002]);assert.equal(change.addRules.length,0);
});

for(const kind of ['firefox','chrome'])test(`${kind} shop jump fragments preserve tab ownership, image settings and cleanup`,async()=>{
 const e=environment(kind),registry=e.ctx.createTabRegistry(e.api);
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);const page=e.ctx.createPagePlatforms(e.api);
 const hosts=['www.bike24.de','www.bike-discount.de','www.bike-components.de','r2-bike.com'],ids=[];
 for(const [index,host] of hosts.entries()){
  e.tabs.get(1).url=e.home+'#wishlist-shop-'+index;e.sender.url=e.tabs.get(1).url;
  const tab=await page.search.tabs.create({url:'https://'+host+'/product'});ids.push(tab.id);
  assert.equal((await page.search.tabs.create({url:'https://'+host+'/updated'})).id,tab.id);
 }
 assert.equal(new Set(ids).size,4);assert.equal(e.tabs.size,6);
 assert.equal((await page.ui.runtime.sendMessage({type:'shop-image-settings'})).loadImages,false);
 assert.equal((await page.ui.runtime.sendMessage({type:'close-shop-tabs'})).closed,4);
 assert.ok(ids.every(id=>!e.tabs.has(id)));
 for(const url of [e.home+'?other=1#section',e.home.replace('home.html','privacy.html')+'#section','https://example.org/ui/home.html#wishlist-shop-1']){
  assert.equal(registry.lookup({type:'find-shop-tab',owner:1,host:hosts[0]},{...e.sender,url}),undefined);
 }
});

for(const kind of ['firefox','chrome'])test(`${kind} full wishlist batch starts and completes from a shop jump fragment`,async()=>{
 const e=environment(kind),registry=e.ctx.createTabRegistry(e.api);let finish;
 e.tabs.get(1).url=e.home+'#wishlist-shop-3';e.sender.url=e.tabs.get(1).url;
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 e.native.tabs.sendMessage=async(_tab,data)=>({ready:true,productName:data.nameQuery,offers:[{name:data.nameQuery,ean:data.query,variant:'black',price:20,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/product'}]});
 vm.runInContext(source('page.js').split('var pagePlatforms=')[0],e.ctx);const page=e.ctx.createPagePlatforms(e.api);
 const results=[],complete=new Promise(resolve=>finish=resolve),fast=(fn,ms)=>ms>=10000?setTimeout(fn,ms):setImmediate(fn);
 const ctx=vm.createContext({searchPlatform:page.search,URL,setTimeout:fast,clearTimeout});
 for(const file of ['identifiers.js','products.js','variant-match.js','catalog.js','search-controller.js','wishlist.js'])vm.runInContext(readFileSync(new URL('./src/core/'+file,import.meta.url),'utf8'),ctx);
 page.ui.runtime.onMessage.addListener(data=>{if(data.type==='result')results.push(data);if(data.type==='batch-complete')finish();});
 const accepted=await page.ui.runtime.sendMessage({type:'wishlist-search',id:'batch',items:[{itemId:'one',query:'First product',ean:'1234567890128',variant:'black'},{itemId:'two',query:'Second product',ean:'9999999999999',variant:'black'}]});
 assert.equal(accepted.accepted,true);await complete;assert.equal(results.length,8);
 assert.ok(results.every(row=>row.offers.length===1&&row.target===1));
 assert.equal(e.session.ownedShopTabs['1'].length,4);assert.equal(e.tabs.size,6);
 await registry.removed(1);
});
