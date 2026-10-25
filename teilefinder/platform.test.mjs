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
 for(const file of ['products.js','variant-match.js','catalog.js','search-controller.js'])vm.runInContext(readFileSync(new URL('./src/core/'+file,import.meta.url),'utf8'),ctx);
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

test('Firefox blank initial tabs wait for navigation before registration and remain open for searches',async()=>{
 const e=environment('firefox'),registry=e.ctx.createTabRegistry(e.api);
 e.native.tabs.onUpdated=event();const api=e.ctx.createNativePlatform(e.native);
 e.native.runtime.sendMessage=data=>registry.lookup(data,e.sender)??registry.register(data,e.sender);
 const create=e.native.tabs.create;e.native.tabs.create=async options=>{const tab=await create({...options,url:'about:blank'});return tab;};
 const ctx=vm.createContext({URL,setTimeout,clearTimeout});vm.runInContext(source('page.js').split('var pagePlatforms=')[0],ctx);
 const page=ctx.createPagePlatforms(api);let finished=false;
 const pending=page.search.tabs.create({url:'https://www.bike24.de/search',active:false}).then(tab=>{finished=true;return tab;});
 await new Promise(setImmediate);assert.equal(finished,false);assert.deepEqual(e.removed,[]);
 const tab=[...e.tabs.values()].find(tab=>tab.id>100);tab.url='https://www.bike24.de/search';e.native.tabs.onUpdated.emit(tab.id,{url:tab.url},{...tab});
 await pending;assert.equal(finished,true);assert.deepEqual(e.session.ownedShopTabs['1'],[tab.id]);assert.deepEqual(e.removed,[]);
 const reused=await page.search.tabs.create({url:'https://www.bike24.de/next',active:false});assert.equal(reused.id,tab.id);
 assert.equal(e.native.tabs.onUpdated.listeners.size,0);
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
