import {readSource} from './test-sources.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const fastTimeout=(fn,ms)=>ms>=10000?setTimeout(fn,ms):setImmediate(fn);
const source=readSource('variant-match.js')+readSource('background.js');
test('Standalone search waits for manual verification and returns four shop results',async()=>{
 let listener;const messages=[],created=[],reads=new Map();const home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{async sendMessage(data){messages.push({tab:data.target,data});},getURL:()=>home,onMessage:{addListener(f){listener=f;}}},tabs:{async create(o){created.push(o);return {id:created.length};},async update(){},async get(){return {};},async sendMessage(tab,data){if(data.type==='detail')return {ready:true,offers:[{...data.fallback,variant:'116 Glieder',price:27.99,stock:'Lagernd, Lieferzeit 1-3 Tage'},{...data.fallback,variant:'126 Glieder',price:29.99,stock:'Nicht lieferbar'}]};if(data.type==='extract'){const n=(reads.get(tab)||0)+1;reads.set(tab,n);return n===1?{blocked:true,offers:[]}:{blocked:false,offers:[{name:'Shimano CN-M8100',price:27.99,url:'https://'+data.host+'/chain',stock:'Auf Lager'}]};}messages.push({tab,data});}}};
 vm.runInNewContext(source,{platform,URL,console,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'job-1',query:'Shimano CN-M8100'},{url:home,tab:{id:99}});
 for(let i=0;i<20;i++)await new Promise(setImmediate);
 assert.equal(created.length,4);assert.equal(messages.filter(m=>m.data.type==='result').length,4);
 assert.equal(messages.find(m=>m.data.shop==='Bike-Discount'&&m.data.type==='result').data.offers.length,2);
 assert.equal(messages[0].data.type,'status');assert.ok(messages.every(m=>m.tab===99&&m.data.id==='job-1'));
});
test('Websites cannot start extension search jobs',()=>{
 let listener,count=0;const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=> 'moz-extension://unit/home.html',onMessage:{addListener(f){listener=f;}}},tabs:{create(){count++;}}};
 vm.runInNewContext(source,{platform,URL,setTimeout,clearTimeout});listener({type:'search',id:'bad',query:'chain'},{url:'https://r2-bike.com/',tab:{id:2}});assert.equal(count,0);
});

test('Bike-Discount dropdown reads separate prices and stock after selecting each chain length',async()=>{
 const source=readSource('variants.js');
 let now=0,expanded=false,selected='',price='',stock='';
 const picker={getAttribute:()=>String(expanded),click(){expanded=!expanded;},get innerText(){return selected;}};
 const items=[{id:'chain116',text:'116 Glieder',price:'27,99 €',stock:'Lagernd, Lieferzeit 1-3 Tage'},{id:'chain126',text:'126 Glieder',price:'29,99 €',stock:'Nicht lieferbar'}];
 const inputs=items.map(v=>{const input={id:v.id,checked:false,disabled:false};const label={innerText:v.text,click(){inputs.forEach(i=>i.checked=false);input.checked=true;selected=v.text;price=v.price;stock=v.stock;expanded=false;}};input.parentElement={querySelector:()=>label};return input;});
 const document={querySelector(selector){return {'#productDetailConfiguratorOptions':picker,'.nele-product-detail-configurator-option input[type="radio"]':inputs[0],'.product-detail-price':{innerText:price},'.nele-product-availability-info':{innerText:stock},h1:{innerText:'Shimano XT CN-M8100'}}[selector];},querySelectorAll:()=>inputs,getElementById:id=>inputs.find(i=>i.id===id)};
 const context=vm.createContext({document,location:{href:'https://www.bike-discount.de/de/chain'},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.trim().replace(',','.')),stockText:s=>s});
 vm.runInContext(source,context);const rows=await vm.runInContext("bikeDiscountVariants({name:'Shimano XT CN-M8100',variant:'Ausführung im Shop prüfen',price:27.99,priceKind:'from'})",context);
 assert.equal(rows.length,2);assert.equal(rows[0].variant,'116 Glieder');assert.equal(rows[0].price,27.99);assert.equal(rows[1].variant,'126 Glieder');assert.equal(rows[1].price,29.99);assert.equal(rows[1].stock,'Nicht lieferbar');assert.equal(rows[1].priceKind,'exact');
 const restored=await context.bikeDiscountVariants({name:'Shimano XT CN-M8100'},'',rows[0].selection);assert.equal(restored.length,1);assert.equal(restored[0].variant,'116 Glieder');assert.equal(restored[0].selection[0].kind,'radio');
});
test('Generic dropdowns enumerate size and capacity combinations without sorting or quantity controls',async()=>{
 const code=readSource('variants.js');let now=0;
 const make=(name,choices)=>({name,id:name,labels:[{textContent:name}],value:choices[0],options:choices.map(value=>({value,textContent:value,disabled:false})),getClientRects:()=>[{}],closest:()=>null,dispatchEvent(){}});
 const size=make('size',['Small','Large']),capacity=make('capacity',['500 ml','750 ml']),quantity=make('quantity',['1','2']);
 const document={querySelectorAll:()=>[size,capacity,quantity],querySelector(selector){if(selector.includes('product-detail-price'))return {innerText:size.value==='Small'?'12,99 €':'14,99 €',getAttribute:()=>null};if(selector.includes('availability'))return {innerText:capacity.value==='500 ml'?'Auf Lager':'Nicht lieferbar'};return null;}};
 const context=vm.createContext({document,location:{href:'https://r2-bike.com/bottle'},Event:class{},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.replace(',','.')),stockText:s=>s,dedupe:rows=>rows});vm.runInContext(code,context);
 const result=await vm.runInContext("dropdownVariants({name:'Bottle',variant:'Ausführung im Shop prüfen'})",context);
 assert.equal(result.offers.length,4);assert.equal(result.limited,false);assert.equal(result.offers[3].variant,'size: Large · capacity: 750 ml');assert.equal(result.offers[3].price,14.99);assert.equal(result.offers[3].stock,'Nicht lieferbar');assert.ok(result.offers.every(row=>!row.variant.includes('quantity')));
});
test('bike-components custom dropdown reads variant-specific price and delivery text',async()=>{
 const code=readSource('variants.js');let now=0,expanded=false,active='',price='',stock='';
 const picker={click(){expanded=!expanded;},getAttribute:key=>key==='aria-expanded'?String(expanded):active};
 const choices=[['options116','silber | 116','27,99€','Versand in 1-3 Werktagen'],['options126','silber | 126','29,99€','Nicht lieferbar']].map(([id,label,p,s])=>({id,getAttribute:key=>key==='data-label'?label:key==='aria-selected'?String(active===id):null,click(){active=id;price=p;stock=s;expanded=false;}}));
 const document={querySelector(selector){if(selector.includes('combobox'))return picker;if(selector==='#options-list [role="option"]')return choices[0];if(selector.includes('auto-product-price'))return {innerText:price};if(selector==='.stock-status')return {innerText:stock};if(selector==='h1')return {innerText:'Shimano CN-M8100'};return null;},querySelectorAll:()=>choices,getElementById:id=>choices.find(o=>o.id===id)};
 const context=vm.createContext({document,location:{href:'https://www.bike-components.de/de/chain/'},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.replace(',','.')),stockText:s=>s,dedupe:rows=>rows});vm.runInContext(code,context);
 const result=await vm.runInContext("bikeComponentsVariants({name:'Shimano CN-M8100',variant:'Ausführung im Shop prüfen'})",context);
 assert.equal(result.offers.length,2);assert.equal(result.offers[0].variant,'silber | 116');assert.equal(result.offers[0].price,27.99);assert.equal(result.offers[0].stock,'Versand in 1-3 Werktagen');assert.equal(result.offers[1].stock,'Nicht lieferbar');assert.equal(result.offers[1].price,29.99);
 const restored=await context.bikeComponentsVariants({name:'Shimano CN-M8100'},'',result.offers[0].selection);assert.equal(restored.offers.length,1);assert.equal(restored.offers[0].variant,'silber | 116');assert.equal(restored.offers[0].selection[0].kind,'option');
});
test('Extension reuses its own shop tab and replaces a closed tab',async()=>{
 const tabs=new Map();let created=0,updated=0;
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}},tabs:{async create({url}){const tab={id:++created,url};tabs.set(tab.id,tab);return tab;},async get(id){if(!tabs.has(id))throw Error('Closed');return tabs.get(id);},async update(id,{url}){updated++;const tab={id,url};tabs.set(id,tab);return tab;}}};
 const ctx=vm.createContext({platform,URL,setTimeout,clearTimeout});vm.runInContext(source,ctx);
 const first=await vm.runInContext("shopTab(99,shops[1],'https://www.bike-discount.de/de/search?search=chain')",ctx);
 const second=await vm.runInContext("shopTab(99,shops[1],'https://www.bike-discount.de/de/search?search=tyre')",ctx);
 assert.equal(first.id,second.id);assert.equal(created,1);assert.equal(updated,1);tabs.delete(first.id);
 await vm.runInContext("shopTab(99,shops[1],'https://www.bike-discount.de/de/search?search=bottle')",ctx);assert.equal(created,2);
});
test('Dependent BIKE24 color and length dropdowns enumerate only valid combinations',async()=>{
 const code=readSource('variants.js');
 const option=value=>({value,textContent:value,disabled:false});let now=0;const events=[],listeners=new Map();
 const color={id:'100',name:'100',value:'orange',labels:[],options:['orange','schwarz'].map(option),getAttribute:()=> 'Farbe',getClientRects:()=>[{}],closest:()=>null,matches:()=>true,dispatchEvent(event){events.push(event.type);length.options=(this.value==='orange'?['60mm','80mm']:['40mm','60mm']).map(option);length.value='';}};
 const length={id:'200',name:'200',value:'',labels:[],options:[],getAttribute:()=> 'Länge',getClientRects:()=>[{}],closest:()=>null,matches:()=>true,dispatchEvent(event){events.push(event.type);}};
 const document={addEventListener(type,listener){listeners.set(type,listener);},removeEventListener(type){listeners.delete(type);},querySelectorAll:()=>[color,length],querySelector(selector){if(selector.includes('price__value'))return {innerText:length.value==='80mm'?'20,59 €':'18,19 €',getAttribute:()=>null};if(selector.includes('product-availability'))return {innerText:color.value==='schwarz'&&length.value==='40mm'?'Nicht lieferbar':'Aktuell 3 auf Lager'};return null;}};
 const ctx=vm.createContext({document,location:{hostname:'www.bike24.de',href:'https://www.bike24.de/p1.html'},Event:class{constructor(type){this.type=type;}},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.replace(',','.')),stockText:s=>s,dedupe:rows=>rows});vm.runInContext(code,ctx);
 const result=await vm.runInContext("dropdownVariants({name:'Tubolito',variant:'Ausführung im Shop prüfen'})",ctx);
 assert.ok(events.length>0);assert.ok(events.every(type=>type==='change'));assert.equal(listeners.size,0);assert.equal(result.offers.length,4);assert.equal(result.offers[0].variant,'Farbe: orange · Länge: 60mm');assert.equal(result.offers[1].price,20.59);assert.equal(result.offers[2].variant,'Farbe: schwarz · Länge: 40mm');assert.equal(result.offers[2].stock,'Nicht lieferbar');assert.ok(!result.offers.some(o=>o.variant.includes('schwarz')&&o.variant.includes('80mm')));
 events.length=0;const saved=result.offers[2].selection;const restored=await ctx.dropdownVariants({name:'Tubolito'},'',saved);assert.equal(restored.offers.length,1);assert.equal(restored.offers[0].variant,'Farbe: schwarz · Länge: 40mm');assert.equal(events.length,2);assert.equal(listeners.size,0);
 events.length=0;const outdated=saved.map(value=>({...value,value:'removed',text:'Removed option'}));const fallback=await ctx.dropdownVariants({name:'Tubolito'},'',outdated);assert.equal(fallback.offers.length,4);assert.ok(events.length>2);assert.equal(listeners.size,0);
});

test('bike-components Aero 111 is read from live cards without embedded props',()=>{
 const helpers=readSource('extract.js');
 const shop=readSource('shop.js').split('platform.runtime.onMessage')[0];
 const make=(name,path,price)=>({innerText:name+' UVP 128,95€ '+price,getAttribute:key=>key==='href'?path:name,querySelector:selector=>({textContent:selector.includes('name')?name:price})});
 const path='/de/Continental/Aero-111-Tubeless-Ready-28-Faltreifen-p172556/?v=46026-schwarz';
 const cards=[make('Continental Aero 111 Tubeless Ready 28" Faltreifen',path,'ab 71,99€'),make('DT Swiss ARC 1100','/de/DT-Swiss/Wheel-p123/','1.280,00€')];
 const document={querySelectorAll:selector=>selector==='[data-props]'?[]:cards};
 const ctx=vm.createContext({document,URL});vm.runInContext(helpers+shop,ctx);
 const rows=vm.runInContext('bcCards("continental aero 111")',ctx);
 assert.equal(rows.length,1);assert.equal(rows[0].url,'https://www.bike-components.de'+path);
 assert.equal(rows[0].price,71.99);assert.equal(rows[0].priceKind,'from');
});

test('Aero 111 search reaches bike-components 29 mm detail result',async()=>{
 let listener;const messages=[];const home='moz-extension://unit/home.html';
 const path='https://www.bike-components.de/de/Continental/Aero-111-Tubeless-Ready-28-Faltreifen-p172556/';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:o.url};},async update(){},async get(){return {};},async sendMessage(tab,data){return data.type==='extract'?{offers:[{name:'Continental Aero 111 Tubeless Ready 28" Faltreifen',variant:'Ausführung im Shop prüfen',price:71.99,priceKind:'from',url:path+'?v=46026-schwarz'}]}:{ready:true,offers:[{...data.fallback,variant:'schwarz | 26 mm | 26-622 | 28 "',price:72.99,priceKind:'exact',stock:'Versand in 1-3 Werktagen'},{...data.fallback,variant:'schwarz | 29 mm | 29-622 | 28 "',price:71.99,priceKind:'exact',stock:'Versand in 1-3 Werktagen',url:path+'?o=1000472573-schwarz-29-mm-29-622-28-'}]};}}};
 vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'aero',query:'continental aero 111',variant:'29 mm'},{url:home,tab:{id:99}});
 for(let i=0;i<30;i++)await new Promise(setImmediate);
 const result=messages.find(m=>m.type==='result'&&m.shop==='bike-components');
 assert.ok(result);assert.equal(result.offers.length,1);assert.equal(result.offers[0].priceKind,'exact');assert.equal(result.offers[0].price,71.99);assert.match(result.offers[0].variant,/29 mm/);
});

test('Unrelated results without a no-results banner finish and permit the next wishlist search',async()=>{
 let listener,created=0;const messages=[],reads=new Map(),home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(data){messages.push(data);}},tabs:{async create({url}){return {id:++created,url};},async update(id,{url}){return {id,url};},async get(){return {url:'https://example.invalid/'};},async sendMessage(tab){reads.set(tab,(reads.get(tab)||0)+1);return {offers:[],suggestions:[],empty:false,ready:true};}}};
 // Only accelerate polling; response deadline timers must remain real timers.
 vm.runInNewContext(source+readSource('suggestions.js'),{platform,URL,clearTimeout,setTimeout:(f,ms)=>ms<10000?setImmediate(f):setTimeout(f,ms)});
 for(const id of ['missing-1','next-article']){
  await listener({type:'search',id,query:'imaginary model 123'},{url:home,tab:{id:99}});
  for(let n=0;n<40;n++)await new Promise(setImmediate);
  const results=messages.filter(m=>m.type==='result'&&m.id===id);
  assert.equal(results.length,4);assert.ok(results.every(m=>m.offers.length===0));
 }
 assert.ok([...reads.values()].every(n=>n<=8));
});

test('An unresponsive shop message has a bounded wait',async()=>{
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}},tabs:{sendMessage:()=>new Promise(()=>{})}};
 const ctx=vm.createContext({platform,URL,setTimeout,clearTimeout});vm.runInContext(source,ctx);
 await assert.rejects(vm.runInContext("boundedMessage(1,{type:'extract'},5)",ctx),/Antwort dauert zu lange/);
});

test('Removed cart commands cannot trigger platform actions',()=>{
 let listener,actions=0;const home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}}},tabs:{create(){actions++;},update(){actions++;},sendMessage(){actions++;}}};
 vm.runInNewContext(source,{platform,URL,setTimeout,clearTimeout});
 assert.equal(listener({type:'cart',shop:'bike-components',offer:{url:'https://www.bike-components.de/product',price:20,priceKind:'exact'}},{url:home,tab:{id:99}}),undefined);
 assert.equal(actions,0);
});

test('BIKE24 purchase guard blocks cart clicks and submission while leaving variant events alone',()=>{
 const code=readSource('variants.js');
 const listeners=new Map();const document={addEventListener(type,listener){listeners.set(type,listener);},removeEventListener(type){listeners.delete(type);}};
 const c=vm.createContext({document});vm.runInContext(code,c);const release=vm.runInContext('guardBike24Purchase()',c);
 let blocked=0;const event=(type,text)=>({type,target:{closest:()=>({textContent:text})},preventDefault(){blocked++;},stopImmediatePropagation(){}});
 listeners.get('click')(event('click','In den Warenkorb'));assert.equal(blocked,1);
 listeners.get('submit')(event('submit',''));assert.equal(blocked,2);
 listeners.get('click')(event('click','Variante auswählen'));assert.equal(blocked,2);
 release();assert.equal(listeners.size,0);
});

test('Delayed Aero 111 product details are retried beyond the old two attempts',async()=>{
 let listener;const messages=[],details=new Map(),home='moz-extension://unit/home.html';
 const path='https://www.bike-components.de/de/Continental/Aero-111-Tubeless-Ready-28-Faltreifen-p172556/?v=46026-schwarz';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:o.url};},async update(){},async get(){return {};},async sendMessage(tab,data){if(data.type==='extract')return {offers:[{name:'Continental Aero 111',url:data.shopId==='bike-components'?path:'https://'+data.host+'/aero',variant:'Ausführung im Shop prüfen',price:71.99,priceKind:'from'}]};const n=(details.get(tab)||0)+1;details.set(tab,n);if(n<4)return {ready:false,offers:[]};return {ready:true,offers:[{...data.fallback,variant:'schwarz | 29 mm | 29-622',priceKind:'exact',stock:'Auf Lager',ean:'4019238283907'}]};}}};
 vm.runInNewContext(source,{platform,URL,console,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'aero-delayed',query:'Continental Aero 111',variant:'29 mm'},{url:home,tab:{id:99}});
 for(let i=0;i<60;i++)await new Promise(setImmediate);
 const result=messages.find(m=>m.type==='result'&&m.shop==='bike-components');assert.ok(result);assert.equal(result.offers.length,1);assert.equal(result.offers[0].ean,'4019238283907');assert.equal(details.get('https://www.bike-components.de/de/s/?keywords=Continental%20Aero%20111'),4);
});

test('BIKE24 inspects listing variants before opening details and retries ambiguous results with a discovered EAN',async()=>{
 let listener;const home='moz-extension://unit/home.html',messages=[],opened=[],reads=[];
 const ean='4019238283907';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){opened.push(o.url);return {id:new URL(o.url).hostname};},async update(tab,o){opened.push(o.url);return {id:tab};},async get(){return {};},async sendMessage(tab,data){reads.push(data);if(data.type==='detail')return {ready:true,offers:[{...data.fallback,variant:'29 mm schwarz',priceKind:'exact',stock:'Auf Lager',ean}]};const base={name:'Continental Aero 111',variant:'29 mm schwarz',price:71.99,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/p1.html'};if(data.query===ean)return {offers:[{...base,ean}]};if(data.shopId==='bike24')return {offers:[base,{...base,url:'https://'+data.host+'/p2.html',variant:'26 mm schwarz'}]};return {offers:[{...base,variant:'Ausführung im Shop prüfen'}]};}}};
 vm.runInNewContext(source,{platform,URL,console,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'ean-narrow',query:'Continental Aero 111',variant:'29 mm'},{url:home,tab:{id:99}});
 for(let i=0;i<100;i++)await new Promise(setImmediate);
 assert.ok(reads.filter(d=>d.shopId==='bike24'&&d.type==='detail').every(d=>d.metadataOnly));
 assert.ok(opened.includes('https://www.bike24.de/suchergebnis?searchTerm='+ean));
 assert.equal(opened.filter(url=>url.includes('searchTerm='+ean)).length,1);
 const result=messages.find(m=>m.type==='result'&&m.shop==='BIKE24');assert.ok(result);assert.equal(result.offers.length,1);assert.equal(result.offers[0].ean,ean);
 assert.ok(messages.some(m=>m.type==='partial-result'));
});

test('All four shops use complete listing offers without opening product detail pages',async()=>{
 let listener;const messages=[],detailCalls=[],updates=[],home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async update(tab,data){updates.push(data.url);},async get(){return {};},async sendMessage(tab,data){if(data.type==='detail'){detailCalls.push(data);throw Error('No detail needed');}return {offers:[{name:'Tyre 29 mm schwarz',variant:'29 mm schwarz',ean:'4019238283907',price:70,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/tyre'}]};}}};
 vm.runInNewContext(source,{platform,URL,console,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'listing-all',query:'Tyre',variant:'29 mm schwarz'},{url:home,tab:{id:99}});
 for(let i=0;i<40;i++)await new Promise(setImmediate);
 assert.equal(detailCalls.length,0);assert.equal(updates.length,0);assert.equal(messages.filter(m=>m.type==='result').length,4);
 assert.ok(messages.filter(m=>m.type==='result').every(m=>m.offers.length===1));
});
test('Listing filter skips clearly wrong widths but inspects missing color or unselected dropdowns',()=>{
 const c=vm.createContext({platform:{browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}}},URL,setTimeout,clearTimeout});vm.runInContext(source,c);
 assert.equal(c.listingVariantConflict({name:'CONTINENTAL 700 x 28C',variant:'700 x 28C'},'30 mm schwarz'),true);
 assert.equal(c.listingVariantConflict({name:'CONTINENTAL 700 x 30C BlackChili',variant:'700 x 30C'},'30 mm schwarz'),false);
 assert.equal(c.listingOfferComplete({name:'CONTINENTAL 700 x 30C BlackChili',variant:'700 x 30C',price:54,priceKind:'exact',stock:'Auf Lager'},'30 mm schwarz'),false);
 assert.equal(c.listingVariantConflict({name:'Aero 111',variant:'Ausführung im Shop prüfen'},'29 mm'),false);
});

test('Bike-Discount Cola caffeine dropdown confirms variant-specific bottom-page EAN',async()=>{
 const code=readSource('variant-match.js')+readSource('variants.js');
 let now=0,expanded=false,selected='',ean='';
 const picker={getAttribute:()=>String(expanded),click(){expanded=!expanded;},get innerText(){return selected;}};
 const values=['mojito (mit koffein)','cola (mit koffein)','Orange'];
 const inputs=values.map((text,i)=>{const input={id:'flavor'+i,checked:false,disabled:false};input.parentElement={querySelector:()=>({innerText:text,click(){inputs.forEach(n=>n.checked=false);input.checked=true;selected=text;ean=i===1?'4029679672666':'4029679000000';expanded=false;}})};return input;});
 const document={querySelector(selector){return {'#productDetailConfiguratorOptions':picker,'.nele-product-detail-configurator-option input[type="radio"]':inputs[0],'.product-detail-price':{innerText:'52,99 €'},'.nele-product-availability-info':{innerText:selected?'Lagernd, Lieferzeit 1-3 Tage':''},h1:{innerText:'Powerbar Powergel Hydro 24er Box'}}[selector]||null;},querySelectorAll:()=>inputs,getElementById:id=>inputs.find(n=>n.id===id)};
 const c=vm.createContext({document,location:{href:'https://www.bike-discount.de/de/powerbar-powergel-hydro-24er-box'},Date:{now:()=>now},setTimeout(fn,ms){now+=ms;setImmediate(fn);},currentProductEAN:()=>ean,euro:s=>Number(s.trim().replace(',','.')),stockText:s=>s});vm.runInContext(code,c);
 const rows=await vm.runInContext("bikeDiscountVariants({name:'Powerbar Powergel Hydro 24er Box',variant:'Ausführung im Shop prüfen'},'Cola mti koffein)')",c);
 assert.equal(rows.length,1);assert.equal(rows[0].variant,'cola (mit koffein)');assert.equal(rows[0].ean,'4029679672666');assert.equal(rows[0].price,52.99);assert.equal(rows[0].stock,'Lagernd, Lieferzeit 1-3 Tage');
});

test('Bike-Discount selection replaces the picker and inputs: read fresh DOM nodes and the new EAN',async()=>{
 const code=readSource('variant-match.js')+readSource('variants.js');
 let now=0,selected='',ean='',expanded=false;
 let picker={getAttribute:()=>String(expanded),click(){expanded=true;},innerText:'Bitte wählen Sie eine Variante'};
 let input={id:'cola',checked:false,disabled:false};
 const label={innerText:'cola (mit koffein)',click(){selected=this.innerText;ean='4029679672666';expanded=false;picker={getAttribute:()=>String(expanded),click(){expanded=true;},innerText:selected};input={id:'cola',checked:true,disabled:false,parentElement:{querySelector:()=>label}};}};
 input.parentElement={querySelector:()=>label};
 const document={querySelector(selector){return {'#productDetailConfiguratorOptions':picker,'.nele-product-detail-configurator-option input[type="radio"]':input,'.product-detail-price':{innerText:'52,99 €'},'.nele-product-availability-info':{innerText:selected?'Lagernd, Lieferzeit 1-3 Tage':''},h1:{innerText:'Powerbar Powergel Hydro 24er Box'}}[selector]||null;},querySelectorAll:()=>[input],getElementById:()=>input};
 const c=vm.createContext({document,location:{href:'https://www.bike-discount.de/de/powerbar-powergel-hydro-24er-box'},Date:{now:()=>now},setTimeout(fn,ms){now+=ms;setImmediate(fn);},currentProductEAN:()=>ean,euro:s=>Number(s.trim().replace(',','.')),stockText:s=>s});vm.runInContext(code,c);
 const rows=await vm.runInContext("bikeDiscountVariants({name:'Powerbar Powergel Hydro 24er Box'},'cola (mit koffein)')",c);
 assert.equal(rows.length,1);assert.equal(rows[0].ean,'4029679672666');assert.equal(rows[0].price,52.99);assert.equal(rows[0].variant,'cola (mit koffein)');
});

test('Similar products keep their classification while exposing variant-specific EAN',async()=>{
 const row={name:'Powerbar Powergel Hydro 24er Box',price:52.99,stock:'Lagerstatus nicht auslesbar',url:'https://www.bike-discount.de/de/powerbar-powergel-hydro-24er-box'};
 const calls=[];
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}},tabs:{async update(){},async sendMessage(id,data){calls.push(data);return {ready:true,offers:[{...row,variant:'cola (mit koffein)',ean:'4029679672666',stock:'Lagernd'}]};}}};
 const context=vm.createContext({platform,URL,setTimeout:fastTimeout,clearTimeout});
 vm.runInContext(source+';globalThis.inspectSuggestions=suggestionDetails;globalThis.setJob=j=>jobs.set(j.source,j);',context);
 const job={source:99,variant:'Cola'};context.setJob(job);
 const result=await context.inspectSuggestions({id:1},{id:'bike-discount',host:'www.bike-discount.de'},job,[row],async()=>{});
 assert.equal(result[0].ean,'4029679672666');assert.equal(result[0].variant,'cola (mit koffein)');
 assert.equal(calls[0].query,row.name);assert.equal(calls[0].variant,'Cola');
});

test('EAN searches reject wrong and unconfirmed single results and never fall back to names',async()=>{
 let listener;const messages=[],requests=[],home='moz-extension://unit/home.html',ean='4029679672666';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){requests.push(o.url);return {id:new URL(o.url).hostname};},async update(id,o){requests.push(o.url);return {id};},async get(){return {};},async sendMessage(id,data){const row={name:'Wrong product',variant:'Cola',price:10,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/product'};if(data.type==='extract')return {offers:[row]};return {ready:true,offers:[{...row,ean:data.shopId==='bike-components'?ean:data.shopId==='bike24'?'4019238283907':''}]};}}};
 vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'ean-only',query:'Powerbar Hydrogel',ean,variant:'Cola'},{url:home,tab:{id:99}});
 for(let i=0;i<80;i++)await new Promise(setImmediate);
 const results=messages.filter(m=>m.type==='result');assert.equal(results.length,4);
 assert.equal(results.find(m=>m.shop==='bike-components').offers.length,1);
 for(const result of results){assert.ok(result.offers.every(o=>o.ean===ean));assert.equal(result.suggestions?.length||0,0);}
 assert.ok(requests.filter(url=>/search|keywords|qs=/.test(url)).every(url=>url.includes(ean)));
});

test('Bike-Discount products without a configurator use the normal detail stock reader',async()=>{
 const code=readSource('extract.js')+readSource('shop.js');
 for(const status of ['Lagernd, Lieferzeit 1-3 Tage','Nicht lieferbar']){
  let listener,variantCalls=0;
  const document={body:{innerText:'Generic product'},querySelector(s){if(s==='h1')return {innerText:'Generic product'};if(s.includes('.nele-product-availability-info'))return {innerText:status};if(s==='main')return {innerText:status};return null;},querySelectorAll:()=>[]};
  const ctx=vm.createContext({document,location:{hostname:'www.bike-discount.de',href:'https://www.bike-discount.de/de/generic-product'},URL,platform:{runtime:{onMessage:{addListener(f){listener=f;}}}},bikeDiscountVariants(){variantCalls++;return [];},productDropdowns:()=>[],currentProductEAN:()=> '1234567890128',productColor:()=>''});
  vm.runInContext(code,ctx);
  vm.runInContext("currentProductEAN=()=> '1234567890128'; productColor=()=>'';",ctx);
  const result=await listener({type:'detail',shopId:'bike-discount',host:'www.bike-discount.de',url:ctx.location.href,query:'Generic product',fallback:{name:'Generic product',price:22.99,variant:'Standard'}});
  assert.equal(result.ready,true);assert.equal(result.offers[0].stock,status);assert.equal(result.offers[0].ean,'1234567890128');assert.equal(variantCalls,0);
 }
});
test('Bike-Discount configurators still require confirmed selected variant stock',async()=>{
 let listener,calls=0;
 const document={body:{innerText:'Generic product'},querySelector:s=>s==='h1'||s==='#productDetailConfiguratorOptions'?{}:null,querySelectorAll:()=>[]};
 const ctx=vm.createContext({document,location:{hostname:'www.bike-discount.de',href:'https://www.bike-discount.de/de/generic-product'},URL,platform:{runtime:{onMessage:{addListener(f){listener=f;}}}},bikeDiscountVariants:async()=>{calls++;return [];}});
 vm.runInContext(readSource('shop.js'),ctx);
 const result=await listener({type:'detail',shopId:'bike-discount',host:'www.bike-discount.de',url:ctx.location.href,query:'Generic product',fallback:{name:'Generic product'}});
 assert.equal(calls,1);assert.equal(result.ready,false);assert.equal(result.offers.length,0);
});

test('Bike-Discount EAN search redirects read the main product rather than recommendations',async()=>{
 const code=readSource('extract.js')+readSource('shop.js');
 for(const ean of ['8020775045428','1234567890128']){
  let listener;
  const document={readyState:'complete',body:{innerText:'Generic product'},querySelector(s){return {h1:{innerText:'Generic product'},'.product-detail-price':{innerText:'22,99 €'},'.nele-product-availability-info':{innerText:'Lagernd, Lieferzeit 1-3 Tage'},'#description-tab-pane':{textContent:'EAN:\n'+ean}}[s]||null;},querySelectorAll(s){if(s==='button')return [];throw Error('Recommendation cards must not be read on product pages');}};
  const ctx=vm.createContext({document,location:{hostname:'www.bike-discount.de',href:'https://www.bike-discount.de/de/generic-product'},URL,platform:{runtime:{onMessage:{addListener(f){listener=f;}}}},validEAN:s=>/^\d{13}$/.test(s)?s:''});
  vm.runInContext(code,ctx);vm.runInContext("productColor=()=>''",ctx);
  const result=await listener({type:'extract',shopId:'bike-discount',host:'www.bike-discount.de',query:'8020775045428'});
  assert.equal(result.ready,true);
  assert.equal(result.offers.length,ean==='8020775045428'?1:0);
  if(ean!=='8020775045428')assert.match(result.message,/EAN 1234567890128 statt der gesuchten EAN 8020775045428/);
  if(result.offers.length){assert.equal(result.offers[0].ean,ean);assert.equal(result.offers[0].stock,'Lagernd, Lieferzeit 1-3 Tage');assert.equal(result.offers[0].price,22.99);}
 }
});

test('BIKE24 chip presentation retains hidden native option selectors without admitting quantity',()=>{
 const make=(id,testid)=>({id,name:id,disabled:false,multiple:false,labels:[],getClientRects:()=>[],matches:()=>!!testid,getAttribute:()=>'',closest:()=>null});
 const flavour=make('216619',true),quantity=make('quantity',false);
 const ctx=vm.createContext({location:{hostname:'www.bike24.de'},document:{querySelectorAll:()=>[flavour,quantity]}});
 vm.runInContext(readSource('variants.js'),ctx);
 const picks=vm.runInContext('productDropdowns()',ctx);assert.equal(picks.length,1);assert.equal(picks[0],flavour);
 ctx.location.hostname='r2-bike.com';assert.equal(vm.runInContext('productDropdowns().length',ctx),0);
});

test('An EAN absent from shop search rechecks a known URL and requires fresh EAN confirmation',async()=>{
 for(const confirmed of [true,false]){
  let listener;const messages=[],urls=[],home='moz-extension://unit/home.html',ean='1234567890128';
  const offer={name:'Example',ean,variant:'Vanille',price:10,priceKind:'exact',stock:'Auf Lager',url:'https://www.bike24.de/p1.html'};
  const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(d){messages.push(d);}},tabs:{async create(o){urls.push(o.url);return {id:new URL(o.url).hostname};},async update(id,o){urls.push(o.url);return {id};},async get(){return {};},async sendMessage(id,d){if(d.type==='extract')return {offers:[],empty:true,ready:true};return {ready:true,offers:[{...offer,ean:confirmed?ean:'9876543210123',price:12}]};}}};
  vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
  await listener({type:'search',id:'known',query:'Example',ean,variant:'Vanille',knownShops:[{name:'BIKE24',offers:[offer]}]},{url:home,tab:{id:99}});
  for(let i=0;i<90;i++)await new Promise(setImmediate);
  const result=messages.find(m=>m.type==='result'&&m.shop==='BIKE24');assert.ok(result);assert.equal(result.offers.length,confirmed?1:0);if(confirmed)assert.equal(result.offers[0].price,12);
  assert.ok(urls.includes(offer.url));assert.ok(urls.filter(u=>/search|keywords|qs=/.test(u)).every(u=>u.includes(ean)));
 }
});

test('Disabling EAN searches names and suppresses automatic discovered-EAN refinement',async()=>{
 let listener;const searches=[],home='moz-extension://unit/home.html',ean='1234567890128';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(){}},tabs:{async create(o){searches.push(o.url);return {id:new URL(o.url).hostname};},async update(id,o){searches.push(o.url);return {id};},async get(){return {};},async sendMessage(id,d){return {offers:[1,2].map(n=>({name:'Example product',ean,variant:'Vanille',price:n+10,priceKind:'exact',stock:'Auf Lager',url:'https://'+d.host+'/p'+n})),ready:true};}}};
 vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'no-ean',query:'Example product',ean,useEAN:false,variant:'Vanille'},{url:home,tab:{id:99}});
 for(let i=0;i<50;i++)await new Promise(setImmediate);
 assert.equal(searches.length,4);assert.ok(searches.every(u=>!u.includes(ean)&&u.includes('Example%20product')));
});


test('Hidden BIKE24 selectors use visible semantic flavour chips rather than unrelated controls',()=>{
 const events=[];
 const select={value:'',labels:[],getClientRects:()=>[],getAttribute:()=> 'Flavour',dispatchEvent:e=>events.push(e.type)};
 const chip={disabled:false,getClientRects:()=>[{}],getAttribute:()=> 'Vanilla',click(){select.value='v';events.push('chip');}};
 const group={getAttribute:()=> 'Flavour',getClientRects:()=>[{}],querySelectorAll:()=>[chip]};
 const ctx=vm.createContext({document:{querySelectorAll:()=>[group]},Event:class{constructor(type){this.type=type;}}});
 vm.runInContext(readSource('variants.js'),ctx);
 ctx.selectProductOption(select,{value:'v',text:'Vanilla'},true);assert.equal(select.value,'v');assert.deepEqual(events,['chip']);
 events.length=0;ctx.selectProductOption(select,{value:'c',text:'Chocolate'},true);assert.equal(select.value,'c');assert.deepEqual(events,['change']);
});


test('BIKE24 detail reader confirms flavour through hidden select chips with pack size, price and stock',async()=>{
 const option={value:'flavour-v',textContent:'Vanilla',disabled:false};
 const select={id:'option1',name:'option1',value:'',labels:[],disabled:false,multiple:false,options:[option],matches:()=>true,getClientRects:()=>[],closest:()=>null,getAttribute:()=> 'Flavour',dispatchEvent(){throw Error('Hidden select events do not update this chip interface');}};
 const chip={disabled:false,getClientRects:()=>[{}],getAttribute:()=> 'Vanilla',click(){select.value=option.value;}};
 const group={getAttribute:()=> 'Flavour',getClientRects:()=>[{}],querySelectorAll:()=>[chip]};
 const cart={getAttribute:()=>JSON.stringify({productVariantList:{currentVariantId:1,variantList:[{id:1,url:'https://www.bike24.de/p1.html',variant:'12x60ml'}]}})};
 let hydrated=false;
 const document={addEventListener(){},removeEventListener(){},querySelectorAll:s=>s==='select'&&hydrated?[select]:s==='[role="radiogroup"]'&&hydrated?[group]:[],querySelector(s){
  if(s==='#add-to-cart')return cart;
  if(s==='h1')return {innerText:'Example pack 12x60ml'};
  if(s.includes('price__value'))return {innerText:'',textContent:'19,99 €',getAttribute:()=>null};
  if(s.includes('product-availability'))return {innerText:'',textContent:select.value?'Auf Lager':'Bitte Option wählen'};
  return null;
 }};
 const ctx=vm.createContext({document,location:{hostname:'www.bike24.de',href:'https://www.bike24.de/p1.html'},URL,platform:{runtime:{onMessage:{addListener(){}}}},setTimeout:fastTimeout});
 for(const file of ['variant-match.js','extract.js','variants.js','shop.js'])vm.runInContext(readSource(file),ctx);
 const early=await ctx.bike24Details({name:'Example pack',url:ctx.location.href},false,'Vanille');assert.equal(early.ready,false);assert.equal(early.offers.length,0);
 hydrated=true;
 const result=await ctx.bike24Details({name:'Example pack',url:ctx.location.href},false,'Vanille');
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].variant,'12x60ml · Flavour: Vanilla');assert.equal(result.offers[0].price,19.99);assert.equal(result.offers[0].stock,'Auf Lager');assert.equal(ctx.variantMatches(result.offers[0],'Vanille'),true);
});


test('Name search confirms inspected similar products using saved EAN while keeping variant and identity strict',async()=>{
 for(const [detailEAN,variant,expected] of [['1234567890128','vanilla',1],['9999999999999','vanilla',0],['1234567890128','Chocolate',0],['','vanilla',0]]){
  let listener;const messages=[],searches=[],home='moz-extension://unit/home.html';
  const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(d){messages.push(d);}},tabs:{async create(o){searches.push(o.url);return {id:new URL(o.url).hostname};},async update(id,o){return {id};},async get(){return {};},async sendMessage(id,d){
   const offer={name:'Example different wording',url:'https://'+d.host+'/product',price:37.99,priceKind:'exact',stock:'Auf Lager'};
   return d.type==='detail'?{ready:true,offers:[{...offer,ean:detailEAN,variant}]}:{ready:true,offers:[],suggestions:[offer]};
  }}};
  vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
  await listener({type:'search',id:'identity',query:'Example original title',ean:'1234567890128',useEAN:false,variant:'Vanille'},{url:home,tab:{id:99}});
  for(let i=0;i<60;i++)await new Promise(setImmediate);
  const results=messages.filter(d=>d.type==='result');assert.ok(results.length>=4);
  assert.ok(results.every(d=>d.offers.length===expected));assert.ok(searches.every(u=>!u.includes('1234567890128')));
 }
});


test('Prices above the cap skip all detail and suggestion inspection across shops',async()=>{
 let listener;const details=[],messages=[],home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(d){messages.push(d);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async update(id){return {id};},async get(){return {};},async sendMessage(id,d){
  if(d.type==='detail'){details.push(d);return {ready:true,offers:[]};}
  const offer={name:'Example product',url:'https://'+d.host+'/product',price:101,priceKind:'from',stock:'Lagerstatus nicht auslesbar'};
  return {ready:true,offers:d.host.includes('bike24')?[offer]:[],suggestions:d.host.includes('bike24')?[]:[offer]};
 }}};
 vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'budget',query:'Example product',maxPrice:50},{url:home,tab:{id:99}});
 for(let i=0;i<60;i++)await new Promise(setImmediate);
 assert.equal(details.length,0);assert.ok(messages.filter(d=>d.type==='result').length>=4);
});


test('Bike-Discount confirms UPC-labelled 12-digit identifiers and rejects different products',async()=>{
 for(const identifier of ['763477000385','763477000386']){
  let listener;
  const document={readyState:'complete',body:{innerText:'Example tool'},querySelector(s){return {h1:{innerText:'Example tool'},'.product-detail-price':{innerText:'19,99 €'},'.nele-product-availability-info':{innerText:'Lagernd, Lieferzeit 1-3 Tage'},'#description-tab-pane':{textContent:'Hersteller Artikelnr.: MODEL-1\nUPC: '+identifier}}[s]||null;},querySelectorAll(s){if(s==='button')return [];return [];}};
  const ctx=vm.createContext({document,location:{hostname:'www.bike-discount.de',href:'https://www.bike-discount.de/de/example-tool'},URL,platform:{runtime:{onMessage:{addListener(f){listener=f;}}}}});
  for(const file of ['variant-match.js','extract.js','shop.js'])vm.runInContext(readSource(file),ctx);
  vm.runInContext("productColor=()=>''",ctx);
  const result=await listener({type:'extract',shopId:'bike-discount',host:'www.bike-discount.de',query:'763477000385'});
  assert.equal(result.offers.length,identifier==='763477000385'?1:0);if(result.offers.length)assert.equal(result.offers[0].ean,identifier);
 }
});

test('Persistent product URL cache bypasses searches after restart and falls back on a mismatching EAN',async()=>{
 const data={},home='moz-extension://unit/home.html',ean='1234567890128';
 const initial={name:'Example item',ean,selection:[{kind:'select',id:'color',value:'silver',text:'silver'}],variant:'silver',price:20,priceKind:'exact',stock:'Auf Lager',url:'https://www.bike-discount.de/de/example'};
 const createSession=(wrong=false,refreshKnown=false)=>{
  let listener;const urls=[],reads=[],messages=[];
  const platform={storage:{local:{async get(){return structuredClone(data);},async set(update){Object.assign(data,structuredClone(update));}}},browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(d){messages.push(d);}},tabs:{async create(o){urls.push(o.url);return {id:new URL(o.url).hostname,url:o.url};},async update(id,o){urls.push(o.url);return {id,url:o.url};},async get(){return {};},async sendMessage(id,d){reads.push(d);const url='https://'+d.host+'/de/example';return d.type==='detail'?{ready:true,productName:'Example item',offers:[{...initial,url,price:25,stock:'Nicht lieferbar',ean:wrong?'9999999999999':ean}]}:{ready:true,offers:[{...initial,url,price:30}]};}}};
  const ctx=vm.createContext({platform,URL,clearTimeout,setTimeout:fastTimeout});vm.runInContext(readSource('extract.js')+source,ctx);
  return {urls,reads,messages,async search(){await listener({type:'search',id:'cache-job',query:'Example item',ean,variant:'silver',refreshKnown},{url:home,tab:{id:99}});for(let i=0;i<150;i++)await new Promise(setImmediate);}};
 };
 const first=createSession();await first.search();assert.ok(first.reads.some(d=>d.type==='extract'));assert.ok(data.productUrlCache['ean:'+ean]['Bike-Discount'].length);
 const second=createSession();await second.search();assert.ok(second.urls.length);assert.ok(second.urls.every(url=>!url.includes('search')&&!url.includes('keywords')&&!url.includes('?qs=')));assert.ok(second.reads.every(d=>d.type==='detail'&&d.direct&&d.fallback.price===null&&d.fallback.ean===''&&d.fallback.selection.length===0&&d.savedSelection.length===1&&d.savedSelection[0].value==='silver'));
 assert.ok(second.messages.filter(d=>d.type==='result').every(d=>d.offers[0].price===25&&d.offers[0].stock==='Nicht lieferbar'));
 const third=createSession(true);await third.search();assert.ok(third.reads.some(d=>d.type==='extract'));assert.ok(third.urls.some(url=>url.includes('search')));assert.ok(third.messages.filter(d=>d.type==='result').every(d=>d.offers.every(o=>o.ean===ean)));
 const fourth=createSession(true,true);await fourth.search();assert.ok(fourth.reads.length);assert.ok(fourth.reads.every(d=>d.type==='detail'));assert.ok(fourth.urls.every(url=>!url.includes('search')&&!url.includes('keywords')));
 const failed=fourth.messages.filter(d=>d.type==='result');assert.equal(failed.length,4);assert.ok(failed.every(d=>!d.offers.length&&/Gespeicherte Produktseite/.test(d.message)));
 // Existing URLs without EAN metadata must still be opened and verified fresh.
 for(const rows of Object.values(data.productUrlCache['ean:'+ean]))for(const offer of rows)delete offer.ean;
 const fifth=createSession(false,true);await fifth.search();assert.ok(fifth.reads.length);assert.ok(fifth.reads.every(d=>d.type==='detail'));assert.ok(fifth.messages.filter(d=>d.type==='result').every(d=>d.offers.length&&d.offers.every(o=>o.ean===ean&&o.price===25)));
});

test('Direct product reads cannot reuse old prices and variants from the cached fallback',async()=>{
 let listener;const nodes={h1:{innerText:'Example fresh product'},'.product-detail-buy':{innerText:'Lagernd, Lieferzeit 1-3 Tage'},'.product-detail-price':{innerText:'12,99 €'},'#description-tab-pane':{textContent:'UPC: 763477000385'}};
 const document={readyState:'complete',body:{innerText:'Example fresh product'},querySelector(selector){return nodes[selector]||(selector.includes('#buy_form .price')?nodes['.product-detail-price']:null);},querySelectorAll:()=>[]};
 const ctx=vm.createContext({document,location:{href:'https://www.bike-discount.de/de/example',hostname:'www.bike-discount.de'},URL,platform:{runtime:{onMessage:{addListener(f){listener=f;}}}},productDropdowns:()=>[]});
 for(const file of ['variant-match.js','extract.js','shop.js'])vm.runInContext(readSource(file),ctx);
 const request={type:'detail',direct:true,query:'763477000385',shopId:'bike-discount',host:'www.bike-discount.de',url:ctx.location.href,fallback:{name:'OLD product',variant:'OLD variant',price:99,ean:'9999999999999'}};
 const fresh=await listener(request);assert.equal(fresh.ready,true);assert.equal(fresh.offers[0].price,12.99);assert.equal(fresh.offers[0].ean,'763477000385');assert.equal(fresh.productName,'Example fresh product');assert.ok(!fresh.offers[0].variant.includes('OLD'));
 delete nodes['.product-detail-price'];const missing=await listener(request);assert.equal(missing.ready,false);assert.equal(missing.offers[0].price,null);
});


test('r2-bike uses the rendered fragment-search route for identifiers and product names without rewriting the query',()=>{
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}}};
 const ctx=vm.createContext({platform,URL});vm.runInContext(source,ctx);
 for(const query of ['8055136020431',"Brand's brake pad DB-410",'Part + size / black']){
  ctx.query=query;const url=vm.runInContext("shops.find(s=>s.id==='r2-bike').search(query)",ctx);
  assert.equal(new URL(url).pathname,'/suchergebnisse');assert.equal(new URL(url).search,'');
  assert.equal(new URLSearchParams(new URL(url).hash.slice('#search?'.length)).get('query'),query);
 }
});

test('A hung sixth article in an eleven-item batch times out, preserves completed shops and allows item seven onward',async()=>{
 let listener,lateTab;const messages=[],timers=new Map(),tabs=new Map();let sequence=0;
 const home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(d){messages.push(d);}},tabs:{async create(o){const id=++sequence;tabs.set(id,{id,url:o.url});return tabs.get(id);},async get(id){return tabs.get(id);},async update(id,o){if(o.url.startsWith('https://r2-bike.com/')&&o.url.includes('Article%206'))return new Promise(resolve=>{lateTab=()=>resolve({id,url:o.url});});tabs.set(id,{id,url:o.url});return tabs.get(id);},async sendMessage(id,d){return {ready:true,offers:[{name:d.query,url:'https://'+d.host+'/product',price:20,priceKind:'exact',stock:'Auf Lager',variant:''}]};}}};
 const ctx=vm.createContext({platform,URL,setTimeout(fn,ms){if(ms>=10000){const token=++sequence;timers.set(token,{fn,ms});return token;}return setImmediate(fn);},clearTimeout(token){if(typeof token==='number')timers.delete(token);else clearImmediate(token);}});
 vm.runInContext(source,ctx);
 for(let n=1;n<=11;n++){
  await listener({type:'search',id:'article-'+n,query:'Article '+n},{url:home,tab:{id:99}});
  for(let tick=0;tick<70;tick++)await new Promise(setImmediate);
  if(n===6){assert.equal(messages.filter(m=>m.id==='article-6'&&m.type==='result').length,0);const deadline=[...timers.values()].find(t=>t.ms===60000);assert.ok(deadline);deadline.fn();for(let tick=0;tick<30;tick++)await new Promise(setImmediate);}
  const final=messages.filter(m=>m.id==='article-'+n&&m.type==='result');assert.equal(final.length,4,'article '+n);
  if(n===6){assert.equal(final.filter(m=>m.offers.length).length,3);assert.match(final.find(m=>m.shop==='r2-bike').message,/Zeitlimit/);}
 }
 const count=messages.length;lateTab();for(let tick=0;tick<20;tick++)await new Promise(setImmediate);assert.equal(messages.length,count);assert.equal(timers.size,0);
});

test('One-click tab cleanup closes only the requesting extension tab’s children; owner closure cleans up automatically',async()=>{
 let messageListener,removedListener,nextId=0;const tabs=new Map([[777,{id:777,url:'https://www.bike24.de/manually-opened'}]]),removed=[];
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=> 'moz-extension://test/home.html',onMessage:{addListener(fn){messageListener=fn;}}},tabs:{onRemoved:{addListener(fn){removedListener=fn;}},async create({url}){const tab={id:++nextId,url};tabs.set(tab.id,tab);return tab;},async get(id){if(!tabs.has(id))throw Error('Closed');return tabs.get(id);},async update(id,data){Object.assign(tabs.get(id),data);return tabs.get(id);},async remove(id){removed.push(id);tabs.delete(id);}}};
 const ctx=vm.createContext({platform,URL,setTimeout,clearTimeout});vm.runInContext(source,ctx);
 for(let index=0;index<4;index++)await vm.runInContext(`shopTab(99,shops[${index}],shops[${index}].search('part'))`,ctx);
 await vm.runInContext("shopTab(100,shops[0],shops[0].search('other'))",ctx);
 assert.equal(messageListener({type:'close-shop-tabs'},{url:'https://www.bike24.de/',tab:{id:99}}),undefined);assert.equal(removed.length,0);
 const result=await messageListener({type:'close-shop-tabs'},{url:'moz-extension://test/home.html',tab:{id:99}});
 assert.equal(result.closed,4);assert.deepEqual(removed,[1,2,3,4]);assert.ok(tabs.has(5));assert.ok(tabs.has(777));
 assert.equal((await messageListener({type:'close-shop-tabs'},{url:'moz-extension://test/home.html',tab:{id:99}})).closed,0);
 await removedListener(100);assert.deepEqual(removed,[1,2,3,4,5]);assert.ok(tabs.has(777));
 const fresh=await vm.runInContext("shopTab(99,shops[0],shops[0].search('new'))",ctx);assert.equal(fresh.id,6);
});

test('Closing the owner while a child tab is being created cannot leave a late orphan tab',async()=>{
 let complete;const removed=[];
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}},tabs:{create:()=>new Promise(resolve=>{complete=resolve;}),async remove(id){removed.push(id);}}};
 const ctx=vm.createContext({platform,URL,setTimeout,clearTimeout});vm.runInContext(source,ctx);
 const pending=vm.runInContext("shopTab(99,shops[0],shops[0].search('part'))",ctx);
 const rejected=assert.rejects(pending,/Shop-Tabs geschlossen/);
 await ctx.closeShopTabs(99);complete({id:42,url:'https://www.bike24.de/'});await rejected;
 assert.deepEqual(removed,[42]);assert.equal(vm.runInContext('shopTabs.size',ctx),0);
});

test('Ad hoc EAN fallback retries only empty shops by name and preserves successful EAN results',async()=>{
 const messages=[],calls=[];
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}},async sendMessage(data){messages.push(data);}}};
 const ctx=vm.createContext({platform,URL,setTimeout,clearTimeout});vm.runInContext(source,ctx);
 ctx.run=async(job,shop,query=job.query)=>{
  calls.push({shop:shop.name,query,knownEAN:job.knownEAN});
  const found=query==='Generic product'||shop.id==='bike24';
  job.results.set(shop.id,{shop:shop.name,query,type:'result',url:shop.search(query),offers:found?[{name:'Generic product',ean:'1234567890128',variant:'black',priceKind:'exact',price:20,stock:'Auf Lager',url:'https://'+shop.host+'/product'}]:[],message:found?'':'Kein Treffer mit bestätigter EAN.'});
 };
 const job={id:'test',source:99,query:'1234567890128',nameQuery:'Generic product',nameFallback:true,useEAN:true,knownEAN:'1234567890128',knownShops:[],variant:'black',results:new Map(),counts:new Map()};ctx.job=job;vm.runInContext('jobs.set(job.source,job)',ctx);
 await ctx.searchAll(job);
 assert.equal(calls.length,7);assert.equal(calls.filter(row=>row.query==='1234567890128').length,4);assert.equal(calls.filter(row=>row.query==='Generic product').length,3);assert.ok(calls.filter(row=>row.query==='Generic product').every(row=>row.shop!=='BIKE24'&&row.knownEAN===''));
 assert.equal(messages.filter(row=>row.type==='result').length,4);assert.ok(messages.filter(row=>row.type==='result').every(row=>row.offers.length===1));
 calls.length=0;messages.length=0;job.nameFallback=false;job.results.clear();await ctx.searchAll(job);assert.equal(calls.length,4);assert.ok(calls.every(row=>row.query==='1234567890128'));
 calls.length=0;job.useEAN=false;job.query='Generic product';job.nameFallback=true;job.results.clear();await ctx.searchAll(job);assert.equal(calls.length,4);assert.ok(calls.every(row=>row.query==='Generic product'));
});

test('Generic model search finds differently named shop products and selects only the requested link count',async()=>{
 let listener;const messages=[],updates=[],tabs=new Map(),home='moz-extension://unit/home.html';
 const titles={'www.bike24.de':'Shimano XTR CN-M9100 Kette 12-fach - mit Quick Link - silver','www.bike-discount.de':'Shimano XTR CN-M9100 12-fach Kette mit Quick-Link','www.bike-components.de':'Shimano XTR / Dura-Ace Quick-Link Kette CN-M9100 12-fach','r2-bike.com':'SHIMANO XTR | Dura Ace Kette CN-M9100 12-fach | 116 Glieder'};
 let ctx;
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create({url}){const id=new URL(url).hostname;tabs.set(id,url);return {id,url};},async update(id,{url}){updates.push(url);tabs.set(id,url);return {id,url};},async get(id){return {id,url:tabs.get(id)};},async sendMessage(id,data){
  const name=titles[data.host],offer={name,url:'https://'+data.host+'/product',price:40,priceKind:'from',stock:'Lagerstatus nicht auslesbar',variant:'Ausführung im Shop prüfen'};
  if(data.type==='detail')return {ready:true,offers:[{...offer,ean:'4524667879565',variant:'silber | 116 Glieder',priceKind:'exact',stock:'Auf Lager'},{...offer,ean:'4550170323134',variant:'silber | 126 Glieder',priceKind:'exact',stock:'Auf Lager'}]};
  const shortQuery=tabs.get(id).includes(encodeURIComponent('Shimano CN-M9100'));
  const missingFullName=['www.bike24.de','www.bike-discount.de'].includes(data.host)&&!shortQuery;
  return {ready:true,empty:missingFullName,offers:!missingFullName&&ctx.matches(name,data.query)?[offer]:[],suggestions:[]};
 }}};
 ctx=vm.createContext({platform,URL,setTimeout:fastTimeout,clearTimeout});
 vm.runInContext(readSource('extract.js')+readSource('suggestions.js')+source,ctx);
 await listener({type:'search',id:'model-variant',query:'Shimano Kette Dura Ace 12 fach CN-M9100',variant:'116',useEAN:false},{url:home,tab:{id:99}});
 for(let i=0;i<80;i++)await new Promise(setImmediate);
 const results=messages.filter(row=>row.type==='result');assert.equal(results.length,4);
 for(const result of results){assert.equal(result.offers.length,1,result.shop);assert.equal(result.offers[0].variant,'silber | 116 Glieder');assert.equal(result.offers[0].ean,'4524667879565');}
 assert.equal(updates.filter(url=>url.includes(encodeURIComponent('Shimano CN-M9100'))).length,2);
});

test('EAN result messages distinguish variant rejection, different identifiers and unconfirmed identifiers',async()=>{
 for(const [detailEAN,variant,expected] of [['1234567890128','123 Glieder',/EAN 1234567890128 gefunden.*Variante „113“ nicht bestätigt/],['1234567890129','113 Glieder',/abweichende EAN: 1234567890129/],['','113 Glieder',/in den gefundenen Produkten nicht bestätigt/]]){
  let listener;const messages=[],home='moz-extension://unit/home.html';
  const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async update(id){return {id};},async get(){return {};},async sendMessage(id,data){
   const row={name:'Example chain',variant:'Ausführung im Shop prüfen',price:59.99,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/product'};
   return data.type==='extract'?{ready:true,offers:[row]}:{ready:true,offers:[{...row,ean:detailEAN,variant}]};
  }}};
  vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
  await listener({type:'search',id:'reason',query:'Example chain',ean:'1234567890128',variant:'113',maxPrice:60},{url:home,tab:{id:99}});
  for(let i=0;i<80;i++)await new Promise(setImmediate);
  const results=messages.filter(m=>m.type==='result');assert.equal(results.length,4);
  for(const result of results){assert.equal(result.offers.length,0);assert.match(result.message,expected);assert.equal(result.suggestions?.length||0,0);}
 }
});

test('An EAN search redirect preserves its specific mismatch explanation in the final result',async()=>{
 let listener;const messages=[],home='moz-extension://unit/home.html';
 const reason='Gefundenes Produkt hat EAN 1234567890129 statt der gesuchten EAN 1234567890128.';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async get(){return {};},async sendMessage(){return {ready:true,empty:true,offers:[],message:reason};}}};
 vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'redirect-reason',query:'Example chain',ean:'1234567890128'},{url:home,tab:{id:99}});
 for(let i=0;i<80;i++)await new Promise(setImmediate);
 const results=messages.filter(m=>m.type==='result');assert.equal(results.length,4);assert.ok(results.every(m=>m.message===reason&&m.offers.length===0));
});

test('Discovered EAN removes a different r2 execution even when EAN refinement fails; disabled EAN retains name results',async()=>{
 for(const useEAN of [true,false]){
  let listener;const home='moz-extension://unit/home.html',messages=[],queries=[],good='8057628581253',other='8057628583325';
  const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){queries.push(o.url);return {id:new URL(o.url).hostname};},async update(id,o){queries.push(o.url);return {id};},async get(){return {};},async sendMessage(id,data){
   if(data.query===good)return {ready:true,empty:true,offers:[]};
   const row={name:'Example chain',ean:good,variant:'',price:59.99,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/chain'};
   return {ready:true,offers:data.shopId==='r2-bike'?[row,{...row,ean:other,url:'https://'+data.host+'/other-chain'}]:[row]};
  }}};
  vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
  await listener({type:'search',id:'ean-conflict',query:'Example chain',useEAN},{url:home,tab:{id:99}});
  for(let i=0;i<120;i++)await new Promise(setImmediate);
  const results=messages.filter(m=>m.type==='result');assert.equal(results.length,4);
  const r2=results.find(m=>m.shop==='r2-bike');assert.equal(r2.offers.length,useEAN?1:2);
  if(useEAN){assert.ok(results.every(m=>m.offers.every(o=>o.ean===good)));assert.ok(queries.some(q=>q.includes('query='+good)));}
  else assert.ok(!queries.some(q=>q.includes(good)));
 }
});

test('BIKE24 length selection captures each current SKU EAN and metadata-only reads fall back to option inspection',async()=>{
 const ids=['short','long'],eans=['4524667879565','4524667879572'];let listener,exposeSelectedSKU=true;
 const select={id:'length',name:'length',value:'',labels:[{textContent:'Length'}],disabled:false,multiple:false,options:ids.map((id,i)=>({value:id,textContent:(i?126:116)+' Glieder'})),matches:()=>true,getClientRects:()=>[{}],closest:()=>null,getAttribute:()=>'',dispatchEvent(){}};
 const cart={getAttribute:()=>JSON.stringify({skus:ids.map((sku,i)=>({sku,ean:eans[i]}))})};
 const gtin={textContent:'GTIN:',nextElementSibling:{textContent:eans.join(', ')}};
 const document={readyState:'complete',body:{innerText:''},addEventListener(){},removeEventListener(){},querySelectorAll(s){if(s==='select')return [select];if(s.startsWith('#add-to-cart input'))return exposeSelectedSKU&&select.value?[{value:select.value}]:[];if(s.includes('data-sheet'))return [gtin];return [];},querySelector(s){if(s==='#add-to-cart')return cart;if(s==='h1')return {innerText:'Example chain'};if(s.includes('price__value'))return {textContent:'39,99 €'};if(s.includes('product-availability'))return {textContent:'Auf Lager'};return null;}};
 const c=vm.createContext({document,URL,Event:class{},location:{hostname:'www.bike24.de',href:'https://www.bike24.de/p1.html?sku=unrelated'},setTimeout:fastTimeout,platform:{runtime:{onMessage:{addListener(fn){listener=fn;}}}}});
 for(const file of ['variant-match.js','extract.js','variants.js','shop.js'])vm.runInContext(readSource(file),c);
 const fallback={name:'Example chain',ean:'9999999999999',price:39.99,priceKind:'exact',stock:'Auf Lager',url:c.location.href};
 const result=await c.bike24Details(fallback,false,'');assert.equal(result.offers.length,2);assert.deepEqual(Array.from(result.offers,o=>o.ean),eans);
 assert.ok(result.offers[0].variant.includes('116'));assert.ok(result.offers[1].variant.includes('126'));
 exposeSelectedSKU=false;select.value='';c.location.href='https://www.bike24.de/p1.html?sku=short';
 const staleURL=await c.bike24Details(fallback,false,'');assert.equal(staleURL.offers.length,2);assert.ok(staleURL.offers.every(offer=>offer.ean===''));
 exposeSelectedSKU=true;c.location.href=fallback.url;
 select.value='';const filtered=await listener({type:'detail',shopId:'bike24',host:'www.bike24.de',url:c.location.href,query:'Example chain',variant:'116',metadataOnly:true,fallback});
 assert.equal(filtered.ready,true);assert.equal(filtered.offers.length,1);assert.equal(filtered.offers[0].ean,eans[0]);assert.ok(filtered.offers[0].variant.includes('116'));
});

test('Multiple EAN results are narrowed by original model/name while EAN confirmation remains mandatory',async()=>{
 for(const query of ['Example AX-120 chain','Completely different shop wording']){
  let listener;const messages=[],home='moz-extension://unit/home.html',ean='4524667879565';
  const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async update(id){return {id};},async get(){return {};},async sendMessage(id,data){return {ready:true,offers:[
   {name:'Example AX-120 chain',ean,variant:'116 links',price:40,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/chain'},
   {name:'Example AX-120 chain bundle set',ean,variant:'116 links',price:50,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/bundle'},
   {name:'Example BX-130 chain',ean,variant:'116 links',price:30,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/other'},
   {name:'Example AX-120 chain',ean:'4550170323134',variant:'116 links',price:20,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/wrong-ean'}]};}}};
  vm.runInNewContext(readSource('extract.js')+source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
  await listener({type:'search',id:'ean-name',query,ean,variant:'116'},{url:home,tab:{id:99}});
  for(let i=0;i<100;i++)await new Promise(setImmediate);
  const results=messages.filter(m=>m.type==='result');assert.equal(results.length,4);
  for(const result of results){assert.equal(result.offers.length,query.startsWith('Example')?1:3);assert.ok(result.offers.every(o=>o.ean===ean));if(result.offers.length===1)assert.equal(new URL(result.offers[0].url).pathname,'/chain');}
 }
});

test('BIKE24 metadata opens Datenblatt and waits for its lazily rendered GTIN',async()=>{
 let listener,clicked=0,ticks=0;const ean='4524667879565';
 const button={textContent:'Datenblatt',tagName:'BUTTON',disabled:false,getClientRects:()=>[{}],getAttribute:()=>null,closest:()=>null,click(){clicked++;}};
 const label={textContent:'GTIN:',get nextElementSibling(){return {textContent:clicked&&ticks>=2?ean:''};}};
 const document={readyState:'complete',body:{innerText:''},querySelector:()=>null,querySelectorAll(s){if(s.includes('data-sheet'))return [label];if(s.startsWith('[role="tab"]'))return [button];return [];}};
 const c=vm.createContext({document,URL,location:{hostname:'www.bike24.de',href:'https://www.bike24.de/p1.html'},setTimeout(fn){ticks++;setImmediate(fn);},platform:{runtime:{onMessage:{addListener(fn){listener=fn;}}}},productDropdowns:()=>[]});
 for(const file of ['variant-match.js','extract.js','shop.js'])vm.runInContext(readSource(file),c);
 const result=await listener({type:'detail',shopId:'bike24',host:'www.bike24.de',url:c.location.href,query:ean,metadataOnly:true,fallback:{name:'Example chain'}});
 assert.equal(clicked,1);assert.ok(ticks>=2);assert.equal(result.ready,true);assert.equal(result.offers[0].ean,ean);
 await c.openBike24DataSheet();assert.equal(clicked,1);
});

test('BIKE24 Datenblatt reader never clicks purchase-form or submit controls and does not select an arbitrary GTIN',async()=>{
 let clicked=0;
 const forbidden={textContent:'Datenblatt',getClientRects:()=>[{}],getAttribute:()=>null,closest:()=>({}),click(){clicked++;}};
 const document={querySelector:()=>null,querySelectorAll:s=>s.startsWith('[role="tab"]')?[forbidden]:[]};
 const c=vm.createContext({document,setTimeout:fastTimeout});vm.runInContext(readSource('extract.js'),c);
 assert.equal(await c.openBike24DataSheet(),false);assert.equal(clicked,0);
 forbidden.closest=()=>null;forbidden.getAttribute=name=>name==='type'?'submit':null;
 assert.equal(await c.openBike24DataSheet(),false);assert.equal(clicked,0);
 const label={textContent:'GTIN:',nextElementSibling:{textContent:'4524667879565, 4524667879572, 4550170323134'}};
 document.querySelectorAll=s=>s.includes('data-sheet')?[label]:[];
 assert.equal(await c.openBike24DataSheet(),true);assert.equal(c.currentProductEAN(),'');
});

test('An EAN present in a BIKE24 multi-GTIN datasheet is reported as ambiguous rather than missing',async()=>{
 let listener;const home='moz-extension://unit/home.html',messages=[],ean='4524667879565';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async update(id){return {id};},async get(){return {};},async sendMessage(id,data){const row={name:'Example chain',variant:'116 Glieder',price:40,priceKind:'exact',stock:'Auf Lager',url:'https://'+data.host+'/chain'};return data.type==='detail'?{ready:true,eanCandidates:[ean,'4524667879572'],offers:[row]}:{ready:true,offers:[row]};}}};
 vm.runInNewContext(source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'ambiguous-sheet',query:'Example chain',ean,variant:'116'},{url:home,tab:{id:99}});
 for(let i=0;i<100;i++)await new Promise(setImmediate);
 const result=messages.find(m=>m.type==='result'&&m.shop==='BIKE24');assert.ok(result);assert.equal(result.offers.length,0);assert.match(result.message,/EAN 4524667879565 im Datenblatt gefunden.*Variante „116“ nicht eindeutig/);
});

test('BIKE24 combines original model, datasheet EAN and selected 116 option without claiming a SKU mapping',async()=>{
 const ean='4524667879565';let contentListener;
 const select={id:'length',name:'length',value:'949136',labels:[{textContent:'Länge'}],disabled:false,multiple:false,options:[{value:'949136',textContent:'116 Glieder'},{value:'long',textContent:'126 Glieder'}],matches:()=>true,getClientRects:()=>[{}],closest:()=>null,getAttribute:()=>'',dispatchEvent(){}};
 const gtin={textContent:'GTIN:',nextElementSibling:{textContent:ean+', 4524667879572, 4550170323134'}};
 const document={readyState:'complete',body:{innerText:''},addEventListener(){},removeEventListener(){},querySelectorAll(s){if(s==='select')return [select];if(s.includes('data-sheet'))return [gtin];return [];},querySelector(s){if(s==='#add-to-cart')return {getAttribute:()=>JSON.stringify({})};if(s==='h1')return {innerText:'Shimano XTR CN-M9100 Kette 12-fach - mit Quick Link - silver'};if(s.includes('price__value'))return {textContent:'39,99 €'};if(s.includes('product-availability'))return {textContent:'Auf Lager'};return null;}};
 const c=vm.createContext({document,URL,Event:class{},location:{hostname:'www.bike24.de',href:'https://www.bike24.de/p1271583.html?sku=949136'},setTimeout:fastTimeout,platform:{runtime:{onMessage:{addListener(fn){contentListener=fn;}}}}});
 for(const file of ['variant-match.js','extract.js','variants.js','shop.js'])vm.runInContext(readSource(file),c);
 let listener;const messages=[],home='moz-extension://unit/home.html';
 const platform={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:new URL(o.url).hostname};},async update(id){return {id};},async get(){return {};},async sendMessage(id,data){if(data.host!=='www.bike24.de')return {ready:true,empty:true,offers:[]};if(data.type==='detail')return contentListener(data);return {ready:true,offers:[{name:'Shimano XTR CN-M9100 Kette 12-fach',variant:'Ausführung im Shop prüfen',price:39.99,priceKind:'exact',stock:'Auf Lager',url:c.location.href}]};}}};
 vm.runInNewContext(readSource('extract.js')+source,{platform,URL,clearTimeout,setTimeout:fastTimeout});
 await listener({type:'search',id:'chain-116',query:'Shimano Kette Dura Ace 12 fach CN-M9100',ean,variant:'116'},{url:home,tab:{id:99}});
 for(let i=0;i<120;i++)await new Promise(setImmediate);
 const result=messages.find(m=>m.type==='result'&&m.shop==='BIKE24');assert.ok(result);assert.equal(result.offers.length,1);assert.equal(result.offers[0].ean,ean);assert.equal(result.offers[0].eanEvidence,'datasheet');assert.ok(result.offers[0].variant.includes('116'));assert.equal(select.value,'949136');
 const data={shopId:'bike24',query:ean,nameQuery:'Shimano CN-M9100 Kette',variant:'116'},offer=result.offers[0],base={eanCandidates:[ean],offers:[{...offer,ean:''}]};
 for(const changed of [{eanCandidates:[]},{offers:[{...offer,ean:'4524667879572'}]},{offers:[{...offer,ean:'',selection:[]}]},{offers:[{...offer,ean:'',variant:'126 Glieder'}]}]){
  const rejected=c.confirmBike24ProductMatch({...base,...changed},data,'Shimano XTR CN-M9100 Kette');assert.ok(rejected.offers.every(o=>!o.ean||o.ean!==ean));
 }
 assert.equal(c.confirmBike24ProductMatch(base,data,'Shimano CN-M8100 Kette').offers[0].ean,'');
});

test('Bike-Discount confirms equivalent volume labels and parses price footnotes without accepting other selections or ambiguous prices',async()=>{
 for(const [selected,price,expected] of [['1000 ml','24,95 €*',1],['1L','24,95 € inkl. MwSt.',1],['500 ml','24,95 €',0],['1 L','29,95 € 24,95 €',0]]){
  let now=0;const input={id:'volume',checked:true,disabled:false,parentElement:{querySelector:()=>({innerText:'1 L'})}};
  const picker={getAttribute:()=> 'true',innerText:selected};
  const document={querySelector:s=>({'#productDetailConfiguratorOptions':picker,'.nele-product-detail-configurator-option input[type="radio"]':input,'.product-detail-price':{innerText:price},'.nele-product-availability-info':{innerText:'Auf Lager'},h1:{innerText:'Generic liquid'}}[s]),querySelectorAll:()=>[input],getElementById:()=>input};
  const ctx=vm.createContext({document,location:{href:'https://www.bike-discount.de/de/generic-liquid'},Date:{now:()=>now},setTimeout(fn,ms){now+=ms;setImmediate(fn);}});
  vm.runInContext(readSource('extract.js')+readSource('variant-match.js')+readSource('variants.js'),ctx);
  const rows=await ctx.bikeDiscountVariants({name:'Generic liquid'},'1000 ml');assert.equal(rows.length,expected);assert.equal(rows.inspectionComplete,true);
  if(expected){assert.equal(rows[0].price,24.95);assert.ok(now<2000);}else assert.ok(now<7000);
 }
});

test('Bike-Discount returns a completed empty inspection after checking real options, but keeps pending missing controls retryable',async()=>{
 for(const complete of [true,false]){
  let listener;const rows=[];rows.inspectionComplete=complete;rows.readIssue=complete?'selectionUnconfirmed':'optionsMissing';
  const document={body:{innerText:''},querySelector:s=>s==='h1'||s==='#productDetailConfiguratorOptions'?{}:null,querySelectorAll:()=>[]};
  const ctx=vm.createContext({document,URL,location:{hostname:'www.bike-discount.de',href:'https://www.bike-discount.de/de/example'},platform:{runtime:{onMessage:{addListener(fn){listener=fn;}}}},bikeDiscountVariants:async()=>rows});vm.runInContext(readSource('shop.js'),ctx);
  const result=await listener({type:'detail',query:'Generic product',shopId:'bike-discount',host:'www.bike-discount.de',url:ctx.location.href,fallback:{}});
  assert.equal(result.ready,complete);assert.equal(result.offers.length,0);assert.equal(result.readIssue,rows.readIssue);
 }
});
