import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {profileSearch} from '../scripts/profile-search.mjs';

test('Ready listings avoid the redundant two-second stability wait without extra navigations or reads',async()=>{
 const result=await profileSearch();assert.equal(result.elapsedMs,2500);assert.equal(result.listingReads,8);assert.equal(result.navigations,4);assert.equal(result.createdTabs,4);assert.equal(result.maxInFlightPerTab,1);
 assert.equal(result.phases.length,1);assert.equal(result.phases[0].shops.bike24.wait.ms,2500);
});
test('Delayed listings still wait for real results; saved product pages skip listing searches',async()=>{
 const delayed=await profileSearch({loadMs:2500});assert.equal(delayed.elapsedMs,4500);assert.equal(delayed.listingReads,12);
 const saved=await profileSearch({cached:true});assert.equal(saved.elapsedMs,750);assert.equal(saved.listingReads,0);assert.equal(saved.detailReads,4);
});
test('Repeated checks reuse exactly four shop tabs, serialise each tab and bound local profiling history',async()=>{
 const result=await profileSearch({cached:true,runs:22});assert.equal(result.createdTabs,4);assert.equal(result.navigations,88);assert.equal(result.maxInFlightPerTab,1);assert.equal(result.phases.length,20);
 assert.equal(result.phases[0].productName,'Example Model 123');assert.doesNotMatch(JSON.stringify(result.phases),/https:/);
});
test('Content retries share the in-progress DOM read; different requests queue and failures release the queue',async()=>{
 const ctx=vm.createContext({});const reader=readFileSync(new URL('./src/shops/reader.js',import.meta.url),'utf8');vm.runInContext(reader.split('platform.runtime.onMessage')[0],ctx);
 const started=[],release=[];let active=0,max=0;
 const queue=ctx.createShopReadQueue(async data=>{started.push(data.query);active++;max=Math.max(max,active);try{await new Promise(resolve=>release.push(resolve));if(data.query==='fail')throw Error('Read failed');return data.query;}finally{active--;}});
 const first=queue({type:'detail',query:'first'}),duplicate=queue({type:'detail',query:'first'}),second=queue({type:'extract',query:'second'});
 assert.equal(first,duplicate);await new Promise(setImmediate);assert.deepEqual(started,['first']);release.shift()();assert.equal(await first,'first');await new Promise(setImmediate);assert.deepEqual(started,['first','second']);release.shift()();assert.equal(await second,'second');assert.equal(max,1);
 const failed=queue({type:'detail',query:'fail'});await new Promise(setImmediate);const rejection=assert.rejects(failed,/Read failed/);release.shift()();await rejection;
 const retry=queue({type:'detail',query:'first'});await new Promise(setImmediate);release.shift()();assert.equal(await retry,'first');assert.equal(queue({type:'other'}),undefined);
});
test('Security-check retries keep their slower interval and use the same four tabs',async()=>{
 const result=await profileSearch({blockedReads:2});assert.equal(result.minBlockedRetryMs,2000);assert.equal(result.elapsedMs,6500);assert.equal(result.createdTabs,4);assert.equal(result.maxInFlightPerTab,1);
});
test('Cancelled linked-variant checks stop after the pending wait instead of issuing more detail reads',async()=>{
 let active=true,reads=0;const ctx=vm.createContext({URL,jobActive:()=>active,async navigateShop(){},async shopPause(){active=false;},async shopMessage(){reads++;return {ready:false};}});
 const source=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');vm.runInContext(source.slice(source.indexOf('async function bike24Linked(')),ctx);
 await ctx.bike24Linked({id:1},{id:'bike24',host:'www.bike24.de'},{query:'Example product'},{},{offers:[],linkedVariants:[{url:'https://www.bike24.de/p1.html'}]});assert.equal(reads,0);
});

test('A saved URL already checked in this shop run is not revisited by the empty-EAN fallback',async()=>{
 const controller=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');
 const ctx=vm.createContext({searchPlatform:{runtime:{onMessage:{addListener(){}}}},setTimeout:(fn,ms)=>ms<10000?setImmediate(fn):setTimeout(fn,ms),clearTimeout,URL});
 vm.runInContext(readFileSync(new URL('./src/core/identifiers.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/products.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/variant-match.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/catalog.js',import.meta.url),'utf8')+controller,ctx);
 let navigations=0,details=0;const url='https://r2-bike.com/example-product',ean='1234567890128';
 const shop={id:'r2-bike',name:'r2-bike',host:'r2-bike.com',search:q=>'https://r2-bike.com/suchergebnisse#search?query='+q};
 const hint={url,name:'Example Model 123',ean,variant:'black',price:25,priceKind:'exact',stock:'Auf Lager'};
 const job={id:'check',source:99,query:ean,nameQuery:hint.name,variant:'black',knownShops:[{name:shop.name,offers:[hint]}],results:new Map(),counts:new Map()};
 ctx.job=job;vm.runInContext('jobs.set(job.source,job)',ctx);
 ctx.searchPlatform.tabs={async update(){navigations++;},async sendMessage(_tab,data){if(data.type==='extract')return {ready:true,empty:true,offers:[]};details++;return {ready:true,offers:[{...hint,ean:'9999999999999'}],productName:hint.name};}};
 ctx.shopTab=async()=>({id:1});ctx.searchPlatform.runtime.sendMessage=async()=>{};
 await ctx.runShop(job,shop,ean);
 assert.equal(details,1);assert.equal(navigations,1,'Only the move from the checked product to search is needed');assert.equal(job.results.get(shop.id).offers.length,0);
});

test('bike-components products without a selector read current price and stock instead of waiting for a nonexistent dropdown',async()=>{
 const url='https://www.bike-components.de/de/Example/Fixed-product-p123/';let priceAvailable=true;
 const document={readyState:'complete',body:{innerText:''},querySelectorAll:()=>[],querySelector(selector){
  if(selector==='h1')return {innerText:'Example Model 123'};
  if(selector==='main')return {innerText:'Example Model 123 Auf Lager'};
  if(selector.includes('[data-test="auto-product-price"]'))return priceAvailable?{innerText:'29,99 €',getAttribute:()=>null}:null;
  if(selector.includes('.stock-status'))return {innerText:'Auf Lager'};
  return null;
 }};
 const ctx=vm.createContext({URL,document,location:{hostname:'www.bike-components.de',href:url},platform:{runtime:{onMessage:{addListener(){}}}},dedupe:rows=>rows,productDropdowns:()=>[],currentProductEAN:()=> '1234567890128',productColor:()=>'',fixedProductProperties:()=>''});
 vm.runInContext(readFileSync(new URL('./src/core/identifiers.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/products.js',import.meta.url),'utf8')+readFileSync(new URL('./src/shops/reader.js',import.meta.url),'utf8'),ctx);
 const result=await ctx.readShopPage({type:'detail',query:'Example Model 123',shopId:'bike-components',host:'www.bike-components.de',url,direct:true,fallback:{name:'Old product',price:999,variant:'Old variant',ean:'9999999999999'}});
 assert.equal(result.ready,true);assert.equal(result.offers[0].price,29.99);assert.equal(result.offers[0].ean,'1234567890128');assert.equal(result.offers[0].stock,'Auf Lager');
 priceAvailable=false;const missing=await ctx.readShopPage({type:'detail',query:'Example Model 123',shopId:'bike-components',host:'www.bike-components.de',url,direct:true,fallback:{name:'Old product',price:999}});assert.equal(missing.ready,false);assert.equal(missing.offers[0].price,null);
});

test('Runtime profiling distinguishes pending, blocked and failed reads without retaining product identifiers',async()=>{
 const controller=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');let result;
 const ctx=vm.createContext({searchPlatform:{runtime:{onMessage:{addListener(){}}}},setTimeout,clearTimeout});vm.runInContext(controller,ctx);
 const job={},shop={id:'r2-bike'};ctx.boundedMessage=async()=>{if(result instanceof Error)throw result;return result;};
 for(const response of [{ready:false,pageMatchesRequested:false},{blocked:true},{ready:true},undefined,Error('Failure')]){
  result=response;try{ctx.testJob=job;ctx.testShop=shop;await vm.runInContext("shopMessage(testJob,testShop,1,{type:'detail'})",ctx);}catch{}
 }
 assert.deepEqual(JSON.parse(JSON.stringify(job.profile.shops['r2-bike'].outcomes)),{notReady:1,pageMismatch:1,blocked:1,ready:1,noResponse:1,errors:1});
});
test('Finished profiling snapshots stay unchanged when timed-out background work completes later',()=>{
 const controller=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');
 const ctx=vm.createContext({searchPlatform:{runtime:{onMessage:{addListener(){}}}},setTimeout,clearTimeout});vm.runInContext(controller,ctx);
 const job={profile:{started:Date.now(),shops:{'r2-bike':{detail:{calls:1,ms:10},outcomes:{notReady:1}}}}};
 ctx.finishSearchProfile(job);job.profile.shops['r2-bike'].detail.ms=99999;job.profile.shops['r2-bike'].outcomes.notReady++;
 const saved=ctx.getSearchProfiles()[0];assert.equal(saved.shops['r2-bike'].detail.ms,10);assert.equal(saved.shops['r2-bike'].outcomes.notReady,1);
});

test('Profiles classify transport failures, timeouts and reader exceptions without raw messages or stacks',()=>{
 const controller=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');
 const ctx=vm.createContext({searchPlatform:{runtime:{onMessage:{addListener(){}}}},setTimeout,clearTimeout});vm.runInContext(controller,ctx);
 const entry={};
 for(const message of ['Could not establish connection. Receiving end does not exist.','Message port closed','Antwort dauert zu lange','Secret 1234567890128 https://shop.example/product'])ctx.recordReadError(entry,Error(message));
 ctx.recordReadError(entry,{code:'REMOTE_SCRIPT_ERROR',info:{name:'ReferenceError',site:'shops/reader.js:52:19',signature:'missingReader is not defined'}});
 assert.deepEqual(JSON.parse(JSON.stringify(entry.errorKinds)),{noReceiver:1,disconnected:1,timeout:1,other:1,readerError:1});
 assert.equal(entry.readerErrors['ReferenceError · shops/reader.js:52:19 · missingReader is not defined'],1);
 assert.doesNotMatch(JSON.stringify(entry),/Secret|1234567890128|https:/);
});

test('Early shop receiver accepts requests before DOMContentLoaded and postpones DOM reads without duplicating retries',async()=>{
 let listener,release,reads=0;const doc={readyState:'loading',addEventListener(type,fn,options){assert.equal(type,'DOMContentLoaded');assert.equal(options.once,true);release=fn;}};
 const ctx=vm.createContext({document:doc,platform:{runtime:{onMessage:{addListener(fn){listener=fn;}}}}});
 vm.runInContext(readFileSync(new URL('./src/shops/reader.js',import.meta.url),'utf8'),ctx);
 ctx.readShopPage=async()=>{reads++;return {ready:true,offers:[]};};
 const request={type:'extract',query:'Example product'},first=listener(request),retry=listener({...request});assert.equal(first,retry);
 await new Promise(setImmediate);assert.equal(reads,0);doc.readyState='interactive';release();assert.equal((await first).ready,true);assert.equal(reads,1);
 await listener(request);assert.equal(reads,2,'A new completed request reads fresh data');
});
test('Already interactive and complete documents can be read immediately',async()=>{
 const ctx=vm.createContext({platform:{runtime:{onMessage:{addListener(){}}}}});vm.runInContext(readFileSync(new URL('./src/shops/reader.js',import.meta.url),'utf8'),ctx);
 for(const readyState of ['interactive','complete'])await ctx.waitForShopDocument({readyState,addEventListener(){throw Error('No extra wait required');}});
 for(const name of ['firefox','chrome']){const manifest=JSON.parse(readFileSync(new URL('./manifests/'+name+'.json',import.meta.url),'utf8'));assert.ok(manifest.content_scripts.every(group=>group.run_at==='document_start'));}
});


test('Profiles keep the requested product identity through query refinement and distinguish a disabled EAN',async()=>{
 const controller=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');let listener;
 const ctx=vm.createContext({searchPlatform:{runtime:{getURL:path=>'extension://unit/'+path,onMessage:{addListener(fn){listener=fn;}}}},setTimeout,clearTimeout});
 vm.runInContext(readFileSync(new URL('./src/core/identifiers.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/products.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/variant-match.js',import.meta.url),'utf8')+controller,ctx);
 ctx.searchAll=async job=>{job.query='internally refined query';job.nameQuery='normalized name';};
 for(const useEAN of [true,false]){
  await listener({type:'search',id:'identity-'+useEAN,query:'  Example Model 123  ',ean:'1234567890128',variant:' black ',useEAN},{url:'extension://unit/ui/home.html',tab:{id:99}});
  await new Promise(setImmediate);
 }
 const profiles=ctx.getSearchProfiles();assert.equal(profiles.length,2);
 for(const [index,useEAN] of [true,false].entries()){
  const profile=profiles[index];assert.equal(profile.productName,'Example Model 123');assert.equal(profile.ean,'1234567890128');assert.equal(profile.variant,'black');assert.equal(profile.useEAN,useEAN);
 }
});

test('A completed but unconfirmed saved variant is checked once, retains its diagnostic and never starts wishlist search',async()=>{
 const ctx=vm.createContext({searchPlatform:{runtime:{onMessage:{addListener(){}},async sendMessage(){}}},URL,setTimeout,clearTimeout});
 const controller=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');
 vm.runInContext(readFileSync(new URL('./src/core/identifiers.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/products.js',import.meta.url),'utf8')+readFileSync(new URL('./src/core/variant-match.js',import.meta.url),'utf8')+controller,ctx);
 const url='https://www.bike-discount.de/de/generic-liquid',ean='1234567890128',shop={id:'bike-discount',name:'Bike-Discount',host:'www.bike-discount.de',search(){throw Error('Known URL must not start search');}};
 const job={id:'one',source:99,refreshKnown:true,query:ean,variant:'1000 ml',knownShops:[{name:shop.name,offers:[{url,name:'Generic liquid',ean}]}],results:new Map(),counts:new Map()};
 ctx.job=job;vm.runInContext('jobs.set(job.source,job)',ctx);ctx.shopTab=async()=>({id:1});ctx.shopPause=async()=>{};
 let details=0;ctx.searchPlatform.tabs={async sendMessage(_id,data){assert.equal(data.type,'detail');details++;return {ready:true,offers:[],readIssue:'selectionUnconfirmed'};}};
 // Result metadata can expose a search link without navigating to it.
 shop.search=()=> 'https://www.bike-discount.de/de/search';
 await ctx.runShop(job,shop,ean);assert.equal(details,1);assert.equal(job.results.get(shop.id).offers.length,0);assert.equal(job.profile.shops[shop.id].readIssues.selectionUnconfirmed,1);
});

test('Known variants sharing one URL are restored separately without revisiting the product page or trusting cached prices',async()=>{
 const ctx=vm.createContext({searchPlatform:{runtime:{onMessage:{addListener(){}}}},URL,setTimeout:(fn,ms)=>ms<10000?setImmediate(fn):setTimeout(fn,ms),clearTimeout});
 for(const file of ['core/products.js','core/variant-match.js','core/search-controller.js'])vm.runInContext(readFileSync(new URL('./src/'+file,import.meta.url),'utf8'),ctx);
 const url='https://www.bike-discount.de/de/generic-product',shop={id:'bike-discount',name:'Bike-Discount',host:'www.bike-discount.de'};
 const hints=['A','B'].map(value=>({url,name:'Generic product',variant:value,price:999,selection:[{kind:'radio',id:value,value,text:value}]}));
 const job={source:99,query:'Generic product',nameQuery:'Generic product',variant:'',knownShops:[{name:shop.name,offers:hints}]};ctx.job=job;vm.runInContext('jobs.set(job.source,job)',ctx);ctx.matches=(name,query)=>name===query;
 let navigations=0;const selected=[];
 ctx.searchPlatform.tabs={async update(){navigations++;},async sendMessage(_id,data){assert.equal(data.fallback.price,null);assert.equal(data.fallback.selection.length,0);const value=data.savedSelection[0].value;selected.push(value);return {ready:true,productName:'Generic product',offers:[{url,name:'Generic product',variant:value,price:value==='A'?10:20,priceKind:'exact',selection:data.savedSelection}]};}};
 const offers=await ctx.readKnownProducts(job,shop,{id:1},job.query);assert.deepEqual(selected,['A','B']);assert.equal(navigations,0);assert.deepEqual(Array.from(offers,row=>row.price),[10,20]);
});
