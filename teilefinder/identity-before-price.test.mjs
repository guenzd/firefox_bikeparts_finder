import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
async function run({wanted=true,missing=false,failed='',late=false,overBudget=false}={}){
 const target='1234567890128',other='9876543210982',host='r2-bike.com',details=[],navigation=[],attempts=new Map();let current='';
 const rows=[['sale',20],['standard',30],['different',overBudget?100:40]].map(([kind,price])=>({name:`Generic disc AD-120 160 mm ${kind}`,variant:'160 mm',ean:'',price,priceKind:'exact',stock:'Auf Lager',url:`https://${host}/${kind}`}));
 const api={runtime:{onMessage:{addListener(){}},async sendMessage(){}},tabs:{async create({url}){current=url;navigation.push(url);return {id:1,url};},async get(){return {id:1,url:current};},async update(id,{url}){current=url;navigation.push(url);return {id,url};},async sendMessage(id,data){if(data.type==='ready')return {ready:true};if(data.type==='extract')return {ready:true,offers:structuredClone(rows)};const kind=data.url.split('/').at(-1);details.push(kind);attempts.set(kind,(attempts.get(kind)||0)+1);if(kind===failed)throw Error('Reader failed');if(late&&kind==='standard'&&attempts.get(kind)<3)return {ready:true,identityReady:false,offers:[{...data.fallback,ean:''}]};return {ready:true,pageMatchesRequested:true,productName:data.fallback.name,offers:[{...data.fallback,ean:kind==='standard'&&!missing?target:kind==='different'?other:''}]};}}};
 const c=vm.createContext({searchPlatform:api,URL,setTimeout:(fn,ms)=>ms<10000?setImmediate(fn):setTimeout(fn,ms),clearTimeout});for(const name of ['identifiers','products','variant-match','catalog','suggestions','search-controller'])vm.runInContext(readFileSync(new URL(`./src/core/${name}.js`,import.meta.url),'utf8'),c);
 const job={id:'test',source:99,query:'Generic disc AD-120',nameQuery:'Generic disc AD-120',expectedEAN:wanted?target:'',knownEAN:'',useEAN:false,...(wanted?{matchMode:'name-fallback'}:{}),variant:'160 mm',maxPrice:60,knownShops:[],results:new Map(),counts:new Map()};c.job=job;vm.runInContext('jobs.set(job.source,job)',c);await c.runShop(job,{id:'r2-bike',name:'r2-bike',host,search:q=>'https://'+host+'/search?q='+encodeURIComponent(q)});return {result:job.results.get('r2-bike'),details,attempts,navigation,c};
}
test('Enabled EAN inspects all candidate identities before price pruning and prefers an exact identifier over a cheaper unlabelled offer',async()=>{const r=await run();assert.deepEqual(r.details,['sale','standard','different']);assert.equal(r.result.offers.length,1);assert.equal(r.result.offers[0].ean,'1234567890128');assert.equal(r.result.offers[0].price,30);assert.equal(r.result.offers[0].identityStatus,'confirmed');assert.deepEqual(Array.from(r.result.suggestions,o=>o.identityStatus),['checked-missing','confirmed']);});
test('A completed detail check with genuinely missing GTINs still permits the name fallback',async()=>{const r=await run({missing:true});assert.deepEqual(Array.from(r.result.offers,o=>o.price),[20,30]);assert.ok(r.result.offers.every(o=>o.identityStatus==='checked-missing'&&o.ean===''));assert.equal(r.result.suggestions[0].ean,'9876543210982');});
test('Failed identity reads remain suggestions and never undercut the verified product',async()=>{const r=await run({failed:'sale'});assert.equal(r.result.offers.length,1);assert.equal(r.result.offers[0].price,30);assert.ok(r.result.suggestions.some(o=>o.identityStatus==='unverified'&&o.price===20));});
test('Pending product data is retried instead of being treated as a completed missing EAN',async()=>{const r=await run({late:true});assert.equal(r.attempts.get('standard'),3);assert.equal(r.result.offers.length,1);assert.equal(r.result.offers[0].ean,'1234567890128');});
test('The original maximum still prevents detail reads above budget',async()=>{const r=await run({overBudget:true});assert.deepEqual(r.details,['sale','standard']);assert.equal(r.result.offers.length,1);assert.equal(r.result.offers[0].price,30);});
test('Without an active EAN the existing cheapest-first optimisation is retained',async()=>{const r=await run({wanted:false});assert.deepEqual(r.details,['sale']);});

test('r2 reader distinguishes missing product DOM, completed missing GTIN, and explicitly read GTIN during remaining resource loading',async()=>{
 let description=false,ean='';const url='https://r2-bike.com/generic-model';const document={readyState:'complete',body:{innerText:'Generic model'},querySelectorAll:()=>[],querySelector(selector){if(selector==='h1')return {innerText:'Generic model'};if(selector==='#tab-description'&&description)return {textContent:ean?'EAN: '+ean:'Generic model description',querySelector:()=>null,querySelectorAll:()=>[]};return null;}};
 const c=vm.createContext({document,location:{href:url,hostname:'r2-bike.com'},URL,setTimeout,clearTimeout,platform:{runtime:{onMessage:{addListener(){}}}}});for(const [dir,name] of [['core','identifiers'],['core','products'],['core','variant-match'],['shops','extract'],['shops','reader']])vm.runInContext(readFileSync(new URL(`./src/${dir}/${name}.js`,import.meta.url),'utf8'),c);
 const data={type:'detail',metadataOnly:true,shopId:'r2-bike',host:'r2-bike.com',url,query:'1234567890128',fallback:{name:'Generic model',price:30,priceKind:'exact',stock:'Auf Lager',ean:'',url}};
 assert.equal((await c.readShopPage(data)).identityReady,false);description=true;const missing=await c.readShopPage(data);assert.equal(missing.ready,true);assert.equal(missing.identityReady,true);assert.equal(missing.offers[0].ean,'');document.readyState='interactive';assert.equal((await c.readShopPage(data)).ready,false);ean='1234567890128';const explicit=await c.readShopPage(data);assert.equal(explicit.ready,true);assert.equal(explicit.offers[0].ean,ean);
});

test('Reused hash-search tabs reload the new query, including recovered tab registrations; ordinary navigation does not',async()=>{
 const r=await run({wanted:false}),{c}=r,reloads=[];let current='https://r2-bike.com/search#search?query=old';
 c.searchPlatform.tabs.get=async()=>({id:1,url:current});c.searchPlatform.tabs.update=async(id,{url})=>{current=url;return {id,url};};c.searchPlatform.tabs.reload=async id=>reloads.push(id);
 const shop={id:'r2-bike',host:'r2-bike.com'},navigate=vm.runInContext('navigateShop',c);
 await c.shopTab(99,shop,'https://r2-bike.com/search#search?query=new');assert.deepEqual(reloads,[1]);
 await c.shopTab(99,shop,'https://r2-bike.com/search#search?query=new');assert.deepEqual(reloads,[1]);
 await navigate(c.job,shop,1,'https://r2-bike.com/search#search?query=another');assert.deepEqual(reloads,[1,1]);
 await navigate(c.job,shop,1,'https://r2-bike.com/product');assert.deepEqual(reloads,[1,1]);
 c.searchPlatform.tabs.create=async()=>({id:2,url:'https://r2-bike.com/search#search?query=fresh',previousUrl:'https://r2-bike.com/search#search?query=old'});
 await c.shopTab(100,shop,'https://r2-bike.com/search#search?query=fresh');assert.deepEqual(reloads,[1,1,2]);
});

test('A confirmed EAN survives while a later linked-variant scan is still pending',async()=>{
 const {c}=await run();let release,entered;
 const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const row={name:'Generic disc AD-120 160 mm',variant:'160 mm',ean:'',price:30,priceKind:'exact',stock:'',url:'https://www.bike24.de/standard'};
 c.searchPlatform.tabs.sendMessage=async(id,data)=>{
  if(data.type==='extract')return {ready:true,offers:[{...row}]};
  if(data.url.endsWith('/slow')){entered();await gate;return {ready:true,offers:[]};}
  return {ready:true,pageMatchesRequested:true,offers:[{...row,ean:'1234567890128',stock:'Auf Lager'}],linkedVariants:[{url:'https://www.bike24.de/slow'}]};
 };
 c.job.results.clear();
 const pending=c.runShop(c.job,{id:'bike24',name:'BIKE24',host:'bike24.de',search:q=>'https://www.bike24.de/search?q='+encodeURIComponent(q)});
 await started;
 assert.equal(c.job.results.get('bike24').offers[0].ean,'1234567890128');
 assert.equal(c.job.results.get('bike24').offers[0].identityStatus,'confirmed');
 release();await pending;
});
