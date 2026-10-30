import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function context(extra={}){const ctx=vm.createContext({URL,...extra});for(const f of ['identifiers','products','variant-match','catalog','suggestions'])vm.runInContext(readFileSync(new URL(`./src/core/${f}.js`,import.meta.url),'utf8'),ctx);return ctx;}
test('Model retry requires one strong code, excluding dimensions, quantities, ambiguity and an already minimal query',()=>{
 const c=context();assert.equal(c.modelRetryQuery('Acme Premium chain AX-1234'),'AX-1234');assert.equal(c.modelRetryQuery('Acme BB22 tool'),'BB22');
 for(const q of ['Tyre 30 mm 700x30C','Bottle 750ml','Chain 116 links','Gel 24x50g','Acme AX-1234 or BB-2345','AX-1234','1234567890128','Jersey M'])assert.equal(c.modelRetryQuery(q),null,q);
});
async function search({batch=false,initial=false,blocked=false,notReady=false,ean=false,nameFallback=false,title='Acme AX-1234 12-speed chain',price=35,variant='116',requested='116',stock='Auf Lager'}={}){
 let listener,next=0,resolveDone;const messages=[],navigation=[],reads=[],tabs=new Map(),done=new Promise(r=>resolveDone=r),home='extension://test/ui/home.html',query='Acme Premium 12-speed chain AX-1234';
 const api={runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(d){messages.push(d);if(d.type==='batch-complete'||!batch&&messages.filter(m=>m.type==='result').length===4)resolveDone();}},tabs:{async create(options){const t={id:++next,...options};tabs.set(t.id,t);navigation.push(t.url);return {...t};},async update(id,options){Object.assign(tabs.get(id),options);navigation.push(options.url);return {...tabs.get(id)};},async get(id){return {...tabs.get(id)};},async sendMessage(id,d){
  reads.push(d);if(d.type==='ready')return {ready:true};if(blocked)return {ready:false,blocked:true};if(notReady)return {ready:false,offers:[]};
  const q=new URL(tabs.get(id).url).searchParams.get('search')||'';const retried=q==='AX-1234';
  const offer={name:title,variant,ean:ean?'1234567890128':'',price,priceKind:'exact',stock,url:'https://'+d.host+'/chain'};
  return {ready:true,empty:true,productName:title,offers:initial||retried?[offer]:[],suggestions:initial||retried?[]:[{...offer,name:'Acme unrelated cassette',price:99}]};
 }}};
 const c=context({platform:api,setTimeout:(fn,ms)=>ms<10000?setImmediate(fn):setTimeout(fn,ms),clearTimeout});
 // One adapter is sufficient to exercise the shared logic; four lanes must remain independent.
 vm.runInContext("shops.forEach(s=>s.search=q=>'https://'+s.host+'/search?search='+encodeURIComponent(q));var searchPlatform=platform;",c);
 vm.runInContext(readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8'),c);
 const item={itemId:'item',nameFallback,query,variant:requested,minPrice:28,maxPrice:50,useEAN:ean,ean:ean?'1234567890128':''};
 await listener(batch?{type:'wishlist-search',id:'b',items:[item]}:{...item,type:'search',id:'s'},{url:home,tab:{id:99}});await done;
 return {messages,reads,navigation,created:next,searches:navigation.filter(url=>new URL(url).pathname==='/search'),result:messages.findLast(m=>m.type==='result'&&m.shop==='Bike-Discount')};
}
for(const batch of [false,true])test(`${batch?'Wishlist':'Direct'} retries once in the same four tabs while keeping original matching inputs`,async()=>{
 const r=await search({batch});assert.equal(r.created,4);assert.equal(r.searches.length,8);assert.equal(r.result.offers.length,1);assert.ok(r.result.url.endsWith('search=AX-1234'));assert.ok(r.reads.filter(d=>d.type==='extract'||d.type==='detail').every(d=>d.query==='Acme Premium 12-speed chain AX-1234'&&d.variant==='116'));if(batch)assert.equal(r.result.itemId,'item');
});
for(const stock of ['Auf Lager','Nicht lieferbar'])test('A valid initial offer does not retry: '+stock,async()=>{const r=await search({initial:true,stock});assert.equal(r.searches.length,4);assert.equal(r.result.offers.length,1);});
for(const title of ['Acme AX-1235 chain','Acme chain link for AX-1234','Other AX-1234 chain','Acme AX-1234 tool'])test('Model retry refuses incompatible identity: '+title,async()=>{const r=await search({title});assert.equal(r.result.offers.length,0);assert.equal(r.searches.length,8);});
for(const options of [{price:20},{price:60},{variant:'126'}])test('The original price and variant filters still gate retry results: '+JSON.stringify(options),async()=>{const r=await search(options);assert.equal(r.result.offers.length,0);assert.equal(r.searches.length,8);});
test('Security challenges do not trigger model retries',async()=>{const r=await search({blocked:true});assert.equal(r.searches.length,4);assert.equal(r.result.offers.length,0);});
test('An EAN-only request does not trigger a model search',async()=>{const r=await search({ean:true});assert.equal(r.searches.length,4);assert.equal(r.result.offers.length,0);});

for(const batch of [false,true])test(`${batch?'Wishlist':'Direct'} model retry also works after EAN-to-name fallback without losing its marker`,async()=>{const r=await search({batch,ean:true,nameFallback:true});assert.equal(r.created,4);assert.equal(r.result.matchMode,'name-fallback');assert.equal(r.result.offers.length,1);assert.equal(r.result.query,'Acme Premium 12-speed chain AX-1234');});

test('A listing that never became readable does not trigger a model retry',async()=>{const r=await search({notReady:true});assert.ok(r.searches.every(url=>new URL(url).searchParams.get('search')!=='AX-1234'));assert.equal(r.result.offers.length,0);});
