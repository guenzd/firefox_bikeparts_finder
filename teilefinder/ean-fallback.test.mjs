import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const target='1234567890128',other='9876543210982',name='Generic gel 24er';
async function run({batch=false,eanPrice=5,namePrice=15,nameEAN='',stock='Auf Lager',saved=false,blocked=false,useEAN=true}={}){
 const messages=[],reads=[],navigations=[],tabs=new Map(),cache={};let listener,resolveDone,next=0;
 const done=new Promise(resolve=>resolveDone=resolve),home='chrome-extension://unit/ui/home.html';
 const product='https://www.bike24.de/generic-pack',fresh=(ean,price)=>({name:'Generic gel 24x40ml',variant:'Citrus',ean,price,priceKind:'exact',stock,url:product});
 const platform={storage:{local:{async get(key){return {[key]:cache[key]};},async set(values){Object.assign(cache,values);}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);if(data.type==='batch-complete'||!batch&&messages.filter(row=>row.type==='result').length===4)resolveDone();}},tabs:{async create(options){const tab={id:++next,...options};tabs.set(tab.id,tab);navigations.push(options.url);return {...tab};},async update(id,options){Object.assign(tabs.get(id),options);navigations.push(options.url);return {...tabs.get(id)};},async get(id){return {...tabs.get(id)};},async sendMessage(id,data){
  reads.push(data);const isEAN=data.query===target,first=data.shopId==='bike24';
  if(blocked&&first)return {blocked:true,ready:false,offers:[]};
  const row=first?fresh(isEAN?target:nameEAN,isEAN?eanPrice:namePrice):{...fresh(target,16),url:'https://'+data.host+'/generic-pack'};
  if(data.type==='ready')return {ready:true};
  return {ready:true,productName:row.name,offers:[row]};
 }}};
 const ctx=vm.createContext({platform,URL,setTimeout:(fn,ms)=>ms<10000?setImmediate(fn):setTimeout(fn,ms),clearTimeout});
 for(const file of ['identifiers','products','variant-match','catalog'])vm.runInContext(readFileSync(new URL('./src/core/'+file+'.js',import.meta.url),'utf8'),ctx);
 vm.runInContext('var searchPlatform=platform;\n'+readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8'),ctx);
 const item={itemId:'one',query:name,ean:target,useEAN,variant:'Citrus',minPrice:10,maxPrice:20,knownShops:saved?[{name:'BIKE24',offers:[fresh('',999)]}]:[]};
 await listener(batch?{type:'wishlist-search',id:'batch',items:[item]}:{...item,type:'search',id:'single',nameFallback:true,refreshKnown:saved},{url:home,tab:{id:99}});
 await done;await vm.runInContext('productCacheWrites',ctx);
 return {cache,messages,reads,navigations,created:next,result:messages.findLast(row=>row.type==='result'&&row.shop==='BIKE24')};
}

for(const batch of [false,true])for(const nameEAN of [''])test(`${batch?'Wishlist':'Ad hoc'} EAN offers below the minimum trigger a bounded name search without inventing or replacing EANs (${nameEAN?'different':'missing'} GTIN)`,async()=>{
 const r=await run({batch,nameEAN});assert.equal(r.created,4);
 assert.equal(r.result.matchMode,'name-fallback');assert.equal(r.result.offers.length,1);assert.equal(r.result.offers[0].price,15);assert.equal(r.result.offers[0].ean,nameEAN);assert.equal(r.result.query,name);
 assert.ok(r.reads.some(read=>read.shopId==='bike24'&&read.query===target));assert.ok(r.reads.some(read=>read.shopId==='bike24'&&read.query===name));
 assert.ok(r.reads.filter(read=>read.shopId!=='bike24').every(read=>read.query===target));
 assert.ok(r.messages.filter(row=>row.type==='result'&&row.shop!=='BIKE24').every(row=>row.offers[0].ean===target));
 if(batch)assert.equal(r.result.itemId,'one');
});

test('A matching EAN offer within both bounds is retained even when unavailable',async()=>{
 const r=await run({eanPrice:15,stock:'Nicht lieferbar'});assert.equal(r.result.matchMode,undefined);assert.equal(r.result.offers[0].ean,target);assert.equal(r.result.offers[0].price,15);assert.ok(r.reads.every(read=>read.query===target));
});

test('A name retry outside the same price range does not replace a fresh EAN result',async()=>{
 const r=await run({namePrice:25,nameEAN:other});assert.ok(r.reads.some(read=>read.query===name));assert.equal(r.result.matchMode,undefined);assert.equal(r.result.offers[0].ean,target);assert.equal(r.result.offers[0].price,5);
});

test('Saved matching product URLs are re-read for name fallback without opening a listing search',async()=>{
 const r=await run({saved:true});assert.equal(r.result.matchMode,'name-fallback');assert.equal(r.result.offers[0].price,15);const reads=r.reads.filter(read=>read.shopId==='bike24');assert.ok(reads.some(read=>read.query===target));assert.ok(reads.some(read=>read.query===name));assert.ok(reads.every(read=>read.type==='detail'&&read.direct));assert.equal(r.created,4);assert.ok(!JSON.stringify(r.cache).includes(other));
});

test('A shop security challenge does not start an additional name search',async()=>{
 const r=await run({blocked:true});assert.ok(r.reads.filter(read=>read.shopId==='bike24').every(read=>read.query===target));assert.equal(r.result.matchMode,undefined);assert.equal(r.result.offers.length,0);
});

for(const batch of [false,true])test(`${batch?'Wishlist':'Ad hoc'} EAN offers above the maximum also retry by name with the same bounds`,async()=>{
 const r=await run({batch,eanPrice:25});assert.equal(r.result.matchMode,'name-fallback');assert.equal(r.result.offers[0].price,15);assert.ok(r.reads.some(read=>read.query===name));assert.equal(r.created,4);assert.ok(!JSON.stringify(r.cache).includes(other));
});

for(const batch of [false,true])test(`${batch?'Wishlist':'Ad hoc'} explicitly different fallback EANs are suggestions, never matching offers or cached winners`,async()=>{
 const r=await run({batch,nameEAN:other});assert.equal(r.result.matchMode,undefined);assert.equal(r.result.offers[0].ean,target);assert.equal(r.result.offers[0].price,5);assert.equal(r.result.suggestions[0].ean,other);
 assert.ok(r.messages.filter(m=>m.shop==='BIKE24'&&m.matchMode==='name-fallback').every(m=>!(m.offers||[]).some(o=>o.ean===other)));assert.equal(r.created,4);assert.ok(!JSON.stringify(r.cache).includes(other));
});

test('Explicitly disabling the EAN filter keeps name-matched products with another EAN eligible',async()=>{const r=await run({useEAN:false,nameEAN:other});assert.equal(r.result.offers[0].ean,other);assert.equal(r.result.offers[0].price,15);});
