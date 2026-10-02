import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8')+readFileSync(new URL('./firefox-r2/background.js',import.meta.url),'utf8');
test('Standalone search waits for manual verification and returns four shop results',async()=>{
 let listener;const messages=[],created=[],reads=new Map();const home='moz-extension://unit/home.html';
 const browser={browserAction:{onClicked:{addListener(){}}},runtime:{async sendMessage(data){messages.push({tab:data.target,data});},getURL:()=>home,onMessage:{addListener(f){listener=f;}}},tabs:{async create(o){created.push(o);return {id:created.length};},async update(){},async get(){return {};},async sendMessage(tab,data){if(data.type==='detail')return {ready:true,offers:[{...data.fallback,variant:'116 Glieder',price:27.99,stock:'Lagernd, Lieferzeit 1-3 Tage'},{...data.fallback,variant:'126 Glieder',price:29.99,stock:'Nicht lieferbar'}]};if(data.type==='extract'){const n=(reads.get(tab)||0)+1;reads.set(tab,n);return n===1?{blocked:true,offers:[]}:{blocked:false,offers:[{name:'Shimano CN-M8100',price:27.99,url:'https://'+data.host+'/chain',stock:'Auf Lager'}]};}messages.push({tab,data});}}};
 vm.runInNewContext(source,{browser,URL,console,setTimeout:f=>setImmediate(f)});
 await listener({type:'search',id:'job-1',query:'Shimano CN-M8100'},{url:home,tab:{id:99}});
 for(let i=0;i<20;i++)await new Promise(setImmediate);
 assert.equal(created.length,4);assert.equal(messages.filter(m=>m.data.type==='result').length,4);
 assert.equal(messages.find(m=>m.data.shop==='Bike-Discount'&&m.data.type==='result').data.offers.length,2);
 assert.equal(messages[0].data.type,'status');assert.ok(messages.every(m=>m.tab===99&&m.data.id==='job-1'));
});
test('Websites cannot start extension search jobs',()=>{
 let listener,count=0;const browser={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=> 'moz-extension://unit/home.html',onMessage:{addListener(f){listener=f;}}},tabs:{create(){count++;}}};
 vm.runInNewContext(source,{browser,URL,setTimeout});listener({type:'search',id:'bad',query:'chain'},{url:'https://r2-bike.com/',tab:{id:2}});assert.equal(count,0);
});

test('Bike-Discount dropdown reads separate prices and stock after selecting each chain length',async()=>{
 const source=readFileSync(new URL('./firefox-r2/variants.js',import.meta.url),'utf8');
 let now=0,expanded=false,selected='',price='',stock='';
 const picker={getAttribute:()=>String(expanded),click(){expanded=!expanded;},get innerText(){return selected;}};
 const items=[{id:'chain116',text:'116 Glieder',price:'27,99 €',stock:'Lagernd, Lieferzeit 1-3 Tage'},{id:'chain126',text:'126 Glieder',price:'29,99 €',stock:'Nicht lieferbar'}];
 const inputs=items.map(v=>{const input={id:v.id,checked:false,disabled:false};const label={innerText:v.text,click(){inputs.forEach(i=>i.checked=false);input.checked=true;selected=v.text;price=v.price;stock=v.stock;expanded=false;}};input.parentElement={querySelector:()=>label};return input;});
 const document={querySelector(selector){return {'#productDetailConfiguratorOptions':picker,'.nele-product-detail-configurator-option input[type="radio"]':inputs[0],'.product-detail-price':{innerText:price},'.nele-product-availability-info':{innerText:stock},h1:{innerText:'Shimano XT CN-M8100'}}[selector];},querySelectorAll:()=>inputs,getElementById:id=>inputs.find(i=>i.id===id)};
 const context=vm.createContext({document,location:{href:'https://www.bike-discount.de/de/chain'},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.trim().replace(',','.')),stockText:s=>s});
 vm.runInContext(source,context);const rows=await vm.runInContext("bikeDiscountVariants({name:'Shimano XT CN-M8100',variant:'Ausführung im Shop prüfen',price:27.99,priceKind:'from'})",context);
 assert.equal(rows.length,2);assert.equal(rows[0].variant,'116 Glieder');assert.equal(rows[0].price,27.99);assert.equal(rows[1].variant,'126 Glieder');assert.equal(rows[1].price,29.99);assert.equal(rows[1].stock,'Nicht lieferbar');assert.equal(rows[1].priceKind,'exact');
});
test('Generic dropdowns enumerate size and capacity combinations without sorting or quantity controls',async()=>{
 const code=readFileSync(new URL('./firefox-r2/variants.js',import.meta.url),'utf8');let now=0;
 const make=(name,choices)=>({name,id:name,labels:[{textContent:name}],value:choices[0],options:choices.map(value=>({value,textContent:value,disabled:false})),getClientRects:()=>[{}],closest:()=>null,dispatchEvent(){}});
 const size=make('size',['Small','Large']),capacity=make('capacity',['500 ml','750 ml']),quantity=make('quantity',['1','2']);
 const document={querySelectorAll:()=>[size,capacity,quantity],querySelector(selector){if(selector.includes('product-detail-price'))return {innerText:size.value==='Small'?'12,99 €':'14,99 €',getAttribute:()=>null};if(selector.includes('availability'))return {innerText:capacity.value==='500 ml'?'Auf Lager':'Nicht lieferbar'};return null;}};
 const context=vm.createContext({document,location:{href:'https://r2-bike.com/bottle'},Event:class{},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.replace(',','.')),stockText:s=>s,dedupe:rows=>rows});vm.runInContext(code,context);
 const result=await vm.runInContext("dropdownVariants({name:'Bottle',variant:'Ausführung im Shop prüfen'})",context);
 assert.equal(result.offers.length,4);assert.equal(result.limited,false);assert.equal(result.offers[3].variant,'size: Large · capacity: 750 ml');assert.equal(result.offers[3].price,14.99);assert.equal(result.offers[3].stock,'Nicht lieferbar');assert.ok(result.offers.every(row=>!row.variant.includes('quantity')));
});
test('bike-components custom dropdown reads variant-specific price and delivery text',async()=>{
 const code=readFileSync(new URL('./firefox-r2/variants.js',import.meta.url),'utf8');let now=0,expanded=false,active='',price='',stock='';
 const picker={click(){expanded=!expanded;},getAttribute:key=>key==='aria-expanded'?String(expanded):active};
 const choices=[['options116','silber | 116','27,99€','Versand in 1-3 Werktagen'],['options126','silber | 126','29,99€','Nicht lieferbar']].map(([id,label,p,s])=>({id,getAttribute:key=>key==='data-label'?label:key==='aria-selected'?String(active===id):null,click(){active=id;price=p;stock=s;expanded=false;}}));
 const document={querySelector(selector){if(selector.includes('combobox'))return picker;if(selector==='#options-list [role="option"]')return choices[0];if(selector.includes('auto-product-price'))return {innerText:price};if(selector==='.stock-status')return {innerText:stock};if(selector==='h1')return {innerText:'Shimano CN-M8100'};return null;},querySelectorAll:()=>choices,getElementById:id=>choices.find(o=>o.id===id)};
 const context=vm.createContext({document,location:{href:'https://www.bike-components.de/de/chain/'},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.replace(',','.')),stockText:s=>s,dedupe:rows=>rows});vm.runInContext(code,context);
 const result=await vm.runInContext("bikeComponentsVariants({name:'Shimano CN-M8100',variant:'Ausführung im Shop prüfen'})",context);
 assert.equal(result.offers.length,2);assert.equal(result.offers[0].variant,'silber | 116');assert.equal(result.offers[0].price,27.99);assert.equal(result.offers[0].stock,'Versand in 1-3 Werktagen');assert.equal(result.offers[1].stock,'Nicht lieferbar');assert.equal(result.offers[1].price,29.99);
});
test('Extension reuses its own shop tab and replaces a closed tab',async()=>{
 const tabs=new Map();let created=0,updated=0;
 const browser={browserAction:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(){}}},tabs:{async create({url}){const tab={id:++created,url};tabs.set(tab.id,tab);return tab;},async get(id){if(!tabs.has(id))throw Error('Closed');return tabs.get(id);},async update(id,{url}){updated++;const tab={id,url};tabs.set(id,tab);return tab;}}};
 const ctx=vm.createContext({browser,URL,setTimeout});vm.runInContext(source,ctx);
 const first=await vm.runInContext("shopTab(99,shops[1],'https://www.bike-discount.de/de/search?search=chain')",ctx);
 const second=await vm.runInContext("shopTab(99,shops[1],'https://www.bike-discount.de/de/search?search=tyre')",ctx);
 assert.equal(first.id,second.id);assert.equal(created,1);assert.equal(updated,1);tabs.delete(first.id);
 await vm.runInContext("shopTab(99,shops[1],'https://www.bike-discount.de/de/search?search=bottle')",ctx);assert.equal(created,2);
});
test('Dependent BIKE24 color and length dropdowns enumerate only valid combinations',async()=>{
 const code=readFileSync(new URL('./firefox-r2/variants.js',import.meta.url),'utf8');
 const option=value=>({value,textContent:value,disabled:false});let now=0;
 const color={id:'100',name:'100',value:'orange',labels:[],options:['orange','schwarz'].map(option),getAttribute:()=> 'Farbe',getClientRects:()=>[{}],closest:()=>null,matches:()=>true,dispatchEvent(){length.options=(this.value==='orange'?['60mm','80mm']:['40mm','60mm']).map(option);length.value='';}};
 const length={id:'200',name:'200',value:'',labels:[],options:[],getAttribute:()=> 'Länge',getClientRects:()=>[{}],closest:()=>null,matches:()=>true,dispatchEvent(){}};
 const document={querySelectorAll:()=>[color,length],querySelector(selector){if(selector.includes('price__value'))return {innerText:length.value==='80mm'?'20,59 €':'18,19 €',getAttribute:()=>null};if(selector.includes('product-availability'))return {innerText:color.value==='schwarz'&&length.value==='40mm'?'Nicht lieferbar':'Aktuell 3 auf Lager'};return null;}};
 const ctx=vm.createContext({document,location:{href:'https://www.bike24.de/p1.html'},Event:class{},Date:{now:()=>now},setTimeout(f,ms){now+=ms;setImmediate(f);},euro:s=>Number(s.replace(',','.')),stockText:s=>s,dedupe:rows=>rows});vm.runInContext(code,ctx);
 const result=await vm.runInContext("dropdownVariants({name:'Tubolito',variant:'Ausführung im Shop prüfen'})",ctx);
 assert.equal(result.offers.length,4);assert.equal(result.offers[0].variant,'Farbe: orange · Länge: 60mm');assert.equal(result.offers[1].price,20.59);assert.equal(result.offers[2].variant,'Farbe: schwarz · Länge: 40mm');assert.equal(result.offers[2].stock,'Nicht lieferbar');assert.ok(!result.offers.some(o=>o.variant.includes('schwarz')&&o.variant.includes('80mm')));
});

test('bike-components Aero 111 is read from live cards without embedded props',()=>{
 const helpers=readFileSync(new URL('./firefox-r2/extract.js',import.meta.url),'utf8');
 const shop=readFileSync(new URL('./firefox-r2/shop.js',import.meta.url),'utf8').split('browser.runtime.onMessage')[0];
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
 const browser={browserAction:{onClicked:{addListener(){}}},runtime:{getURL:()=>home,onMessage:{addListener(f){listener=f;}},async sendMessage(data){messages.push(data);}},tabs:{async create(o){return {id:o.url};},async update(){},async get(){return {};},async sendMessage(tab,data){return data.type==='extract'?{offers:[{name:'Continental Aero 111 Tubeless Ready 28" Faltreifen',variant:'Ausführung im Shop prüfen',price:71.99,priceKind:'from',url:path+'?v=46026-schwarz'}]}:{ready:true,offers:[{...data.fallback,variant:'schwarz | 26 mm | 26-622 | 28 "',price:72.99,priceKind:'exact',stock:'Versand in 1-3 Werktagen'},{...data.fallback,variant:'schwarz | 29 mm | 29-622 | 28 "',price:71.99,priceKind:'exact',stock:'Versand in 1-3 Werktagen',url:path+'?o=1000472573-schwarz-29-mm-29-622-28-'}]};}}};
 vm.runInNewContext(source,{browser,URL,setTimeout:f=>setImmediate(f)});
 await listener({type:'search',id:'aero',query:'continental aero 111',variant:'29 mm'},{url:home,tab:{id:99}});
 for(let i=0;i<30;i++)await new Promise(setImmediate);
 const result=messages.find(m=>m.type==='result'&&m.shop==='bike-components');
 assert.ok(result);assert.equal(result.offers.length,1);assert.equal(result.offers[0].priceKind,'exact');assert.equal(result.offers[0].price,71.99);assert.match(result.offers[0].variant,/29 mm/);
});
