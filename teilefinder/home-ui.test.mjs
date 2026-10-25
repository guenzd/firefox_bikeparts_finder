import {readSource} from './test-sources.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const home=readSource('home.js');
const code=home.slice(home.indexOf('function suggestionRow('),home.indexOf('function eanRow('));
test('Accepting a wishlist suggestion saves the name and immediately rechecks only that article, retaining EAN and filters',async()=>{
 const events=[];
 const el=(tag,text)=>({tag,text,children:[],append(...nodes){this.children.push(...nodes);},addEventListener(name,fn){this[name]=fn;}});
 let release;const saved=new Promise(resolve=>{release=resolve;});
 const ctx=vm.createContext({el,validEAN:()=>'',money:String,copyButton:()=>({}),checkingList:false,document:{querySelector:()=>({})},async saveList(){events.push('save');await saved;},async recheckWishlistItem(id){events.push('search:'+id);}});
 vm.runInContext(code,ctx);
 const item={id:'one',query:'Old name',ean:'1234567890128',useEAN:false,variant:'silver',minPrice:5,maxPrice:30,shops:[]};
 const row=ctx.suggestionRow({name:'New product title',url:'https://example.org/product'},item);
 const choose=row.children.at(-1);const pending=choose.click();await choose.click();assert.deepEqual(events,['save']);assert.equal(choose.disabled,true);
 release();await pending;assert.deepEqual(events,['save','search:one']);assert.equal(item.query,'New product title');assert.equal(item.ean,'1234567890128');assert.equal(item.useEAN,false);assert.equal(item.variant,'silver');assert.equal(item.minPrice,5);assert.equal(item.maxPrice,30);assert.equal(choose.disabled,false);
});

test('Lost background completion unblocks the list once and preserves prior results as stale',()=>{
 const state=new Map([['A',{offers:[{price:10}],done:true}],['B',{offers:[{price:20}],done:false}],['C',{offers:[],done:false}],['D',{offers:[],done:true}]]);
 let finished,cancelled=0,renders=0;
 const nodes={};const ctx=vm.createContext({state,names:['A','B','C','D'],id:'old-job',platform:{runtime:{sendMessage(){cancelled++;return Promise.resolve();}}},document:{querySelector:s=>nodes[s]||(nodes[s]={})},render(){renders++;},finishSearch(rows){finished=rows;}});
 vm.runInContext(home.slice(home.indexOf('function setSearchRunning('),home.indexOf('async function startSearch('))+home.slice(home.indexOf('function finishTimedOutSearch(')),ctx);
 ctx.finishTimedOutSearch();assert.equal(ctx.id,'');assert.equal(finished.length,4);assert.equal(state.get('A').stale,undefined);assert.equal(state.get('B').stale,true);assert.equal(state.get('B').offers[0].price,20);assert.ok([...state.values()].every(s=>s.done));assert.equal(ctx.finishSearch,null);assert.equal(cancelled,1);
 ctx.finishTimedOutSearch();assert.equal(cancelled,1);assert.equal(renders,1);
});

test('List copy exports only deliverable products, one name and URL per line, without duplicates',async()=>{
 let copied;const status={};
 const button={classList:{add(){}},append(){},setAttribute(){}};
 const ctx=vm.createContext({cleanShopUrl:value=>value,copyButton:(_url,callback)=>{button.click=callback;return button;},document:{createTextNode:()=>({}),querySelector:()=>status},navigator:{clipboard:{async writeText(text){copied=text;}}}});
 const wishlistCode=readSource('wishlist.js');
 vm.runInContext(wishlistCode.slice(wishlistCode.indexOf('function deliverable('),wishlistCode.indexOf('function cheapestWishlist(')),ctx);
 vm.runInContext(home.slice(home.indexOf('function copyListButton('),home.indexOf('function copyButton(')),ctx);
 const available={name:'Product\nA',url:'https://shop.example/a',stock:'auf Lager'};
 ctx.copyListButton([available,available,{name:'Product B',url:'https://shop.example/b',stock:'1-3 Arbeitstage'},{name:'Unavailable',url:'https://shop.example/c',stock:'nicht lieferbar'},{name:'Unknown',url:'https://shop.example/d',stock:'nicht auslesbar'},{name:'Later',url:'https://shop.example/e',stock:'verfügbar ab 4.11.'}], 'BIKE24');
 assert.equal(button.disabled,false);await button.click();assert.equal(copied,'BIKE24\nProduct A https://shop.example/a\nProduct B https://shop.example/b');assert.match(status.textContent,/2 lieferbare Artikel/);
 ctx.copyListButton([]);assert.equal(button.disabled,true);
});

test('List copy writes clickable escaped HTML and clean plain-text URLs together',async()=>{
 let formats;const status={};const button={classList:{add(){}},append(){},setAttribute(){}};
 const ctx=vm.createContext({URL,Blob,ClipboardItem:class{constructor(data){formats=data;}},copyButton:(_url,callback)=>{button.click=callback;return button;},document:{createTextNode:()=>({}),querySelector:()=>status},navigator:{clipboard:{async write(items){assert.equal(items.length,1);}}}});
 vm.runInContext(readSource('variant-match.js'),ctx);
 const wishlistCode=readSource('wishlist.js');
 vm.runInContext(wishlistCode.slice(wishlistCode.indexOf('function deliverable('),wishlistCode.indexOf('function cheapestWishlist(')),ctx);
 vm.runInContext(home.slice(home.indexOf('function copyListButton('),home.indexOf('function copyButton(')),ctx);
 ctx.copyListButton([{name:'A & <B>',url:'https://www.bike-components.de/product/?o=123&v=456&origin=SRP&utm_source=test',stock:'Auf Lager'},{name:'Unavailable',url:'https://www.bike24.de/missing',stock:'nicht lieferbar'}], 'bike-components');
 await button.click();
 assert.equal(formats['text/plain'].type,'text/plain');assert.equal(formats['text/html'].type,'text/html');
 assert.equal(await formats['text/plain'].text(),'bike-components\nA & <B> https://www.bike-components.de/product/?o=123&v=456');
 assert.equal(await formats['text/html'].text(),'<div><strong>bike-components</strong><br><a href="https://www.bike-components.de/product/?o=123&amp;v=456">A &amp; &lt;B&gt;</a></div>');
});

test('Wishlist copy groups mixed best offers under each shop heading in HTML and plain text',async()=>{
 let formats;const status={},button={classList:{add(){}},append(){},setAttribute(){}};
 const ctx=vm.createContext({URL,Blob,ClipboardItem:class{constructor(data){formats=data;}},copyButton:(_url,callback)=>{button.click=callback;return button;},document:{createTextNode:()=>({}),querySelector:()=>status},navigator:{clipboard:{async write(){}}}});
 vm.runInContext(readSource('variant-match.js'),ctx);
 const wishlistCode=readSource('wishlist.js');
 vm.runInContext(wishlistCode.slice(wishlistCode.indexOf('function deliverable('),wishlistCode.indexOf('function cheapestWishlist(')),ctx);
 vm.runInContext(home.slice(home.indexOf('function copyListButton('),home.indexOf('function copyButton(')),ctx);
 const offer=(shop,name)=>({shop,name,url:'https://example.org/'+name,stock:'Auf Lager'});
 ctx.copyListButton([offer('BIKE24','A'),offer('r2-bike','B'),offer('BIKE24','C')]);await button.click();
 assert.equal(await formats['text/plain'].text(),'BIKE24\nA https://example.org/A\nC https://example.org/C\n\nr2-bike\nB https://example.org/B');
 assert.equal(await formats['text/html'].text(),'<div><strong>BIKE24</strong><br><a href="https://example.org/A">A</a><br><a href="https://example.org/C">C</a></div><br><div><strong>r2-bike</strong><br><a href="https://example.org/B">B</a></div>');
});

test('Individual search collapses the wishlist while retaining its saved results; list searches reopen it',async()=>{
 const nodes={};const node=selector=>nodes[selector]||(nodes[selector]={hidden:false,value:'',textContent:'',attrs:{},setAttribute(key,value){this.attrs[key]=value;},getAttribute(key){return this.attrs[key];},querySelector(){return node('arrow');},addEventListener(type,callback){this[type]=callback;}});
 const wishlist=[{id:'saved',query:'Saved item',shops:[{name:'BIKE24',offers:[{name:'Saved offer',price:15,url:'https://www.bike24.de/saved',stock:'Auf Lager'}]}]}];
 const sent=[];const before=JSON.stringify(wishlist),state=new Map([['BIKE24',{offers:[{name:'Old direct result'}]}]]);
 const ctx=vm.createContext({document:{querySelector:node},wishlist,state,searchDeadline:null,activeWishlistId:'',names:['BIKE24'],query:'Old query',searchedVariant:'',checkingList:false,crypto:{randomUUID:()=> 'new-job'},clearTimeout(){},setTimeout(){return 1;},finishTimedOutSearch(){},render(){},validEAN:()=>'',inputPriceRange:()=>({}),knownSearchShops:()=>[],platform:{runtime:{async sendMessage(message){sent.push(message);}}}});
 vm.runInContext(home.slice(home.indexOf('function setWishlistCollapsed('),home.indexOf("document.querySelector('#query').addEventListener")),ctx);
 await ctx.startSearch('Individual item','');
 assert.equal(sent[0].useEAN,true);assert.equal(sent[0].nameFallback,true);
 node('#search-use-ean').checked=false;await ctx.startSearch('Individual item','');assert.equal(sent.at(-1).useEAN,false);assert.equal(sent.at(-1).nameFallback,false);
 assert.equal(node('#wishlist-content').hidden,true);assert.equal(node('#wishlist-toggle').attrs['aria-expanded'],'false');assert.equal(ctx.wishlistDetails,false);assert.equal(JSON.stringify(wishlist),before);
 node('#wishlist-toggle').click();assert.equal(node('#wishlist-content').hidden,false);assert.equal(JSON.stringify(wishlist),before);
 ctx.setWishlistCollapsed(true);ctx.checkingList=true;ctx.activeWishlistId='saved';await ctx.startSearch('Saved item','',wishlist[0].shops);
 assert.equal(sent.at(-1).useEAN,true);assert.equal(sent.at(-1).nameFallback,false);
 assert.equal(node('#wishlist-content').hidden,false);assert.equal(node('#wishlist-toggle').attrs['aria-expanded'],'true');assert.equal(ctx.wishlistDetails,true);assert.equal(JSON.stringify(wishlist),before);
});

test('Saved wishlist shop results remain rendered in their own container during individual searches',()=>{
 const saved={children:['old'],replaceChildren(){this.children=[];}},direct={children:['old'],replaceChildren(){this.children=[];}},heading={};
 const doc={'#wishlist-shop-results':saved,'#results':direct,'#search-results-heading':heading};
 const offer={name:'Saved wishlist offer',price:25};
 const ctx=vm.createContext({document:{querySelector:selector=>doc[selector]},names:[],wishlistDetails:false,renderWishlistDetails(root){root.children.push(offer);}});
 vm.runInContext(home.slice(home.indexOf('function render(){'),home.indexOf('function renderWishlistDetails(')),ctx);
 ctx.render();assert.deepEqual(saved.children,[offer]);assert.equal(heading.hidden,false);
 ctx.wishlistDetails=true;ctx.render();assert.deepEqual(saved.children,[offer]);assert.equal(heading.hidden,true);assert.deepEqual(direct.children,[]);
});

test('Result text hides redundant success notices from older saved results but keeps actionable messages',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(home.slice(home.indexOf('function resultMessage('),home.indexOf('function render(){')),ctx);
 assert.equal(ctx.resultMessage('Preise und Lagerstatus direkt auf den gespeicherten Produktseiten aktualisiert.'),'');
 assert.equal(ctx.resultMessage('Produkt anhand der EAN und gewünschten Variante bestätigt.'),'');
 for(const text of ['Zeitlimit überschritten','Sicherheitsprüfung: Shop-Tab öffnen','Variante nicht bestätigt','Weitere Varianten im Shop prüfen.'])assert.equal(ctx.resultMessage(text),text);
 assert.equal(ctx.resultMessage(undefined),'');
});

test('Adding a completed ad hoc search adopts all results and timestamps without another search',async()=>{
 const nodes={};const node=selector=>nodes[selector]||(nodes[selector]={value:'',disabled:false,reportValidity:()=>true,addEventListener(type,callback){this[type]=callback;}});
 node('#query').value='Product';node('#search-variant').value='black';node('#search-ean').value='1234567890123';node('#max').value='50';
 const names=['A','B','C','D'],state=new Map(names.map(name=>[name,{done:true,checkedAt:'2026-10-24T12:00:00Z',offers:[{name:'Product',ean:'1234567890123',price:25,url:'https://example.org/'+name,stock:'Auf Lager'}],suggestions:[{name:'Alternative'}]}]));
 let searches=0,saves=0,collapsed;
 const ctx=vm.createContext({document:{querySelector:node},names,state,wishlist:[],checkingList:false,wishlistDetails:false,query:'Product',searchedVariant:'black',searchedEAN:'',validEAN:value=>/^\d{13}$/.test(value)?value:'',inputPriceRange:()=>({maxPrice:50}),parsePriceRange:()=>({maxPrice:50}),crypto:{randomUUID:()=> 'new-item'},async saveList(){saves++;},async recheckWishlistItem(){searches++;},setWishlistCollapsed(value){collapsed=value;},renderWishlist(){}});
 vm.runInContext(home.slice(home.indexOf("document.querySelector('#add-wish').addEventListener"),home.indexOf('async function recheckWishlistItem(')),ctx);
 await node('#add-wish').click();
 assert.equal(searches,0);assert.equal(saves,1);assert.equal(collapsed,false);assert.equal(ctx.wishlistDetails,true);
 assert.equal(ctx.wishlist[0].shops.length,4);assert.equal(ctx.wishlist[0].ean,'1234567890123');assert.equal(ctx.wishlist[0].checkedAt,'2026-10-24T12:00:00Z');assert.equal(ctx.wishlist[0].shops[0].offers[0].price,25);assert.equal(ctx.wishlist[0].shops[0].suggestions[0].name,'Alternative');
 for(const change of ['name','variant','EAN','unfinished']){
  ctx.wishlistDetails=false;node('#query').value=change==='name'?'Other':'Product';node('#search-variant').value=change==='variant'?'silver':'black';node('#search-ean').value=change==='EAN'?'9999999999999':'1234567890123';state.get('D').done=change!=='unfinished';
  await node('#add-wish').click();
 }
 assert.equal(searches,4);
});

test('Popup header shares one timestamp and preserves the time span for differently aged shop results',()=>{
 const ctx=vm.createContext({});vm.runInContext(home.slice(home.indexOf('function priceResultsTimes('),home.indexOf('async function showPriceHistory(')),ctx);
 const first='2026-10-24T12:00:00.100Z',same='2026-10-24T12:00:00.900Z',last='2026-10-24T13:00:00Z';
 const rows=times=>times.map(checkedAt=>({shop:{checkedAt}}));
 assert.deepEqual(Array.from(ctx.priceResultsTimes(rows([first,same]),null)),[Date.parse('2026-10-24T12:00:00Z')]);
 assert.deepEqual(Array.from(ctx.priceResultsTimes(rows([last,first]),null)),[Date.parse('2026-10-24T12:00:00Z'),Date.parse(last)]);
 assert.deepEqual(Array.from(ctx.priceResultsTimes([],last)),[Date.parse(last)]);assert.deepEqual(Array.from(ctx.priceResultsTimes([],null)),[]);
});

test('Clicking active search progress cancels once, preserves results and releases a waiting list item',async()=>{
 const nodes={};const node=selector=>nodes[selector]||(nodes[selector]={disabled:false,hidden:false,addEventListener(type,callback){this[type]=callback;}});
 const state=new Map([['Shop',{offers:[{name:'Found product',price:20}],done:true}]]);let cancelled=0,finished;
 const ctx=vm.createContext({document:{querySelector:node},state,searchDeadline:1,id:'job',checkingList:true,clearTimeout(){},platform:{runtime:{async sendMessage(message){if(message.type==='cancel')cancelled++;}}},finishSearch(rows){finished=rows;}});
 vm.runInContext(home.slice(home.indexOf('function setSearchRunning('),home.indexOf('async function startSearch('))+home.slice(home.indexOf('function stopCurrentSearch('),home.indexOf('let historyWrites=')),ctx);
 ctx.setSearchRunning(true);node('#status').click();
 assert.equal(cancelled,1);assert.equal(ctx.id,'');assert.equal(ctx.stopRequested,true);assert.equal(node('#status').disabled,true);assert.equal(node('#stop-search').hidden,true);assert.equal(state.get('Shop').offers[0].price,20);assert.equal(finished[0].offers[0].name,'Found product');assert.equal(ctx.finishSearch,null);
 node('#status').click();assert.equal(cancelled,1);
 vm.runInContext(home.slice(home.indexOf("document.querySelector('#check-wishlist').addEventListener"),home.indexOf('function copyListButton(')),ctx);
 ctx.setSearchRunning(true);ctx.stopRequested=false;await node('#check-wishlist').click();assert.equal(cancelled,2);assert.equal(ctx.stopRequested,true);
});

test('Wishlist fields select on initial edit, allow caret positioning, commit with Enter and revert with Escape',()=>{
 const document={activeElement:null};let selected=0,blurred=0,prevented=0;
 const field={value:'30',setCustomValidity(value){this.validity=value;},addEventListener(type,fn){this[type]=fn;},select(){selected++;},blur(){blurred++;document.activeElement=null;}};
 const ctx=vm.createContext({document});vm.runInContext(home.slice(home.indexOf('function enableDirectEditing('),home.indexOf('function renderWishlist(){')),ctx);
 ctx.enableDirectEditing(field,()=> '30');
 field.pointerdown();document.activeElement=field;field.focus();field.click();assert.ok(selected>0);
 const before=selected;field.pointerdown();field.click();assert.equal(selected,before);
 field.value='40';field.keydown({key:'Enter',preventDefault(){prevented++;}});assert.equal(blurred,1);assert.equal(field.value,'40');
 field.value='wrong';field.keydown({key:'Escape',preventDefault(){prevented++;}});assert.equal(blurred,2);assert.equal(field.value,'30');assert.equal(field.validity,'');assert.equal(prevented,2);
});

test('EAN button updates the search and wishlist and copies the same identifier, retaining adoption on clipboard failure',async()=>{
 let copied,focused=false,saves=0,fail=false;const fields={'#search-ean':{focus(){focused=true;}},'#status':{}};
 const el=(tag,text)=>({tag,text,children:[],append(...children){this.children.push(...children);},setAttribute(){}});
 const wishlist=[{id:'item',ean:''}],savedField={dataset:{eanItem:'item'},value:''};
 const ctx=vm.createContext({el,activeWishlistId:'item',wishlist,document:{createTextNode:value=>value,querySelector:selector=>fields[selector],querySelectorAll:()=>[savedField]},navigator:{clipboard:{async writeText(value){if(fail)throw Error('Denied');copied=value;}}},async saveList(){saves++;},copyButton:(_value,callback)=>({click:callback,setAttribute(){}})});
 vm.runInContext(home.slice(home.indexOf('function eanRow('),home.indexOf('function renderTotal(')),ctx);
 const row=ctx.eanRow('4524667879565','item');await row.children.at(-1).click();
 assert.equal(copied,'4524667879565');assert.equal(fields['#search-ean'].value,copied);assert.equal(wishlist[0].ean,copied);assert.equal(savedField.value,copied);assert.equal(focused,true);assert.equal(saves,1);
 fail=true;await ctx.eanRow('4550170323134','item').children.at(-1).click();assert.equal(fields['#search-ean'].value,'4550170323134');assert.equal(wishlist[0].ean,'4550170323134');assert.match(fields['#status'].textContent,/Kopieren fehlgeschlagen/);
});

test('Displayed four-shop matches hide repeated EAN rows in totals and shop lists, and variants have no prefix',()=>{
 const make=(tag,text)=>({tag,text,children:[],append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){},addEventListener(){}});
 const root=make('div'),names=['BIKE24','Bike-Discount','bike-components','r2-bike'],ean='4524667879565';let eanRows=0;
 const item={id:'one',query:'Different wishlist wording',variant:'30 mm',ean,shops:names.map(name=>({name,done:true,offers:[{name:'Example tyre',variant:'30 mm',price:40,priceKind:'exact',ean,stock:'Auf Lager',url:'https://example.org/product'}]}))};
 const ctx=vm.createContext({el:make,names,wishlist:[item],checkingList:false,state:new Map(),document:{querySelector:()=>root,createTextNode:text=>make('text',text)},money:String,eanRow(){eanRows++;return make('small','EAN');},copyButton:()=>make('button'),copyListButton:()=>make('button'),appendTableHead:(table,row)=>table.append(row),resultMessage:s=>s||''});
 for(const file of ['variant-match.js','wishlist.js'])vm.runInContext(readSource(file),ctx);
 vm.runInContext(home.slice(home.indexOf('function resultLinkActions('),home.indexOf('function render(){')),ctx);
 vm.runInContext(home.slice(home.indexOf('function renderTotal('),home.indexOf("document.querySelector('#add-wish').addEventListener")),ctx);
 vm.runInContext(home.slice(home.indexOf('function renderWishlistDetails('),home.indexOf('platform.runtime.onMessage.addListener')),ctx);
 ctx.renderTotal();assert.equal(eanRows,0);
 const details=make('div');ctx.renderWishlistDetails(details);assert.equal(eanRows,0);
 const texts=node=>[node.text,...node.children.flatMap(texts)].filter(Boolean);
 assert.ok(texts(details).includes('30 mm'));assert.ok(!texts(details).some(text=>String(text).startsWith('Gewünscht:')));
 assert.ok(!texts(details).includes(item.query));assert.equal(texts(details).filter(text=>text==='Example tyre').length,4);
 // Restored and reused results need no live job flags or repeated per-shop EAN.
 item.shops.forEach((shop,i)=>{shop.done=false;if(i)shop.offers[0].ean='';});
 ctx.renderTotal();ctx.renderWishlistDetails(make('div'));assert.equal(eanRows,0);
 item.shops[1].offers[0].ean='4550170323134';ctx.renderTotal();assert.equal(eanRows,0);
 eanRows=0;ctx.renderWishlistDetails(make('div'));assert.equal(eanRows,0);
 item.shops[1].offers[0].ean='';eanRows=0;
 item.shops[0].stale=true;ctx.renderTotal();assert.equal(eanRows,0);
 ctx.renderWishlistDetails(make('div'));assert.equal(eanRows,0);
 item.shops[0].offers=[];ctx.renderTotal();assert.ok(eanRows>0);
 eanRows=0;ctx.renderWishlistDetails(make('div'));assert.ok(eanRows>0);
});

test('Wishlist button fill follows completed shops and items, never regresses, and resets after a run',()=>{
 const attrs={},style={},classes=new Set();const button={classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}},style:{setProperty(k,v){style[k]=v;},removeProperty(k){delete style[k];}},setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];}};
 const ctx=vm.createContext({wishlistProgress:{completed:0,total:2,percent:0},document:{querySelector:()=>button}});
 vm.runInContext(home.slice(home.indexOf('function updateWishlistProgress('),home.indexOf("document.querySelector('#check-wishlist').addEventListener")),ctx);
 ctx.updateWishlistProgress();assert.equal(style['--wishlist-progress'],'0%');assert.equal(button.textContent,'Prüfe 1 / 2…');assert.ok(classes.has('is-checking'));
 ctx.updateWishlistProgress(2);assert.equal(style['--wishlist-progress'],'25%');assert.match(attrs['aria-label'],/25 Prozent.*Stoppen/);
 ctx.updateWishlistProgress(1);assert.equal(style['--wishlist-progress'],'25%');
 ctx.wishlistProgress.completed=1;ctx.updateWishlistProgress();assert.equal(style['--wishlist-progress'],'50%');assert.equal(button.textContent,'Prüfe 2 / 2…');
 ctx.updateWishlistProgress(4);assert.equal(style['--wishlist-progress'],'100%');
 ctx.wishlistProgress=null;ctx.updateWishlistProgress();assert.equal(style['--wishlist-progress'],undefined);assert.equal(attrs['aria-label'],undefined);assert.equal(button.textContent,'Wunschliste prüfen');assert.ok(!classes.has('is-checking'));
});

test('Shop prices show a muted best-price comparison only for unequal current exact prices and omit header item counts',()=>{
 const make=(tag,text)=>({tag,text,children:[],append(...nodes){this.children.push(...nodes);},setAttribute(){}}),root=make('div');
 const names=['BIKE24','Bike-Discount','bike-components','r2-bike'];
 const offer=(price,extra={})=>({name:'Tyre',variant:'30 mm',price,priceKind:'exact',stock:'Auf Lager',url:'https://example.org/product',...extra});
 const item={id:'one',query:'Wanted tyre',variant:'30 mm',minPrice:15,maxPrice:30,shops:[
  {name:names[0],offers:[offer(20),offer(16,{variant:'28 mm'}),offer(15,{priceKind:'from'})]},
  {name:names[1],offers:[offer(25),offer(40)]},
  {name:names[2],stale:true,offers:[offer(15)]},
  {name:names[3],offers:[offer(18,{stock:'Nicht lieferbar'})]}]};
 const ctx=vm.createContext({el:make,names,wishlist:[item],checkingList:false,state:new Map(),money:String,copyListButton:()=>make('button'),resultLinkActions:()=>make('div'),eanRow:()=>make('small'),appendTableHead:(table,row)=>table.append(row),resultMessage:s=>s||''});
 for(const file of ['variant-match.js','wishlist.js'])vm.runInContext(readSource(file),ctx);
 vm.runInContext(home.slice(home.indexOf('function renderWishlistDetails('),home.indexOf('platform.runtime.onMessage.addListener')),ctx);
 ctx.renderWishlistDetails(root);
 const all=node=>[node,...node.children.flatMap(all)],nodes=all(root),comparisons=nodes.filter(node=>node.className==='price-comparison');
 assert.equal(comparisons.length,2);assert.ok(comparisons.every(node=>node.children.length===1&&node.title==='Bestpreis 20 bei BIKE24'));
 assert.equal(comparisons[0].children[0].text,'−5');assert.equal(comparisons[1].children[0].text,'+2');
 assert.ok(!nodes.some(node=>typeof node.text==='string'&&/^\d+ Artikel$/.test(node.text)));
});

test('Wishlist searches use saved EAN and price filters without reading or changing manual search fields',async()=>{
 const nodes={};const node=s=>nodes[s]||(nodes[s]={value:'manual draft',checked:false,setAttribute(){},getAttribute(){},addEventListener(){}});
 const item={id:'saved',query:'Saved product',ean:'4524667879565',variant:'116',minPrice:15,maxPrice:40,useEAN:true,shops:[]};
 const sent=[];const ctx=vm.createContext({document:{querySelector:node},wishlist:[item],checkingList:true,activeWishlistId:'saved',state:new Map(),names:[],query:'',searchedVariant:'',searchDeadline:null,crypto:{randomUUID:()=> 'job'},setTimeout(){},clearTimeout(){},finishTimedOutSearch(){},render(){},validEAN:value=>value||'',inputPriceRange(){throw Error('Manual price must not be read');},knownSearchShops:()=>[],platform:{runtime:{async sendMessage(data){sent.push(data);}}}});
 vm.runInContext(home.slice(home.indexOf('function setWishlistCollapsed('),home.indexOf("document.querySelector('#query').addEventListener")),ctx);
 await ctx.startSearch(item.query,item.variant,item.shops);
 assert.equal(sent[0].ean,item.ean);assert.equal(sent[0].variant,'116');assert.equal(sent[0].minPrice,15);assert.equal(sent[0].maxPrice,40);assert.equal(sent[0].useEAN,true);
 for(const selector of ['#query','#search-ean','#search-variant','#max'])assert.equal(node(selector).value,'manual draft');
 // Neither single-item nor full-list orchestration may use the manual form as scratch storage.
 const orchestration=home.slice(home.indexOf('async function recheckWishlistItem('),home.indexOf('function copyListButton('));
 assert.doesNotMatch(orchestration,/querySelector\('#(?:query|search-ean|search-variant|max)'\)\.value\s*=/);
});

test('Wishlist result propagation updates saved EANs without overwriting manual drafts, including late completion',()=>{
 const nodes={};const node=s=>nodes[s]||(nodes[s]={value:'manual draft'});let listener,sharedEAN;
 const item={id:'saved',query:'Saved product',ean:'4524667879565',variant:'116'};
 const ctx=vm.createContext({URL,platform:{runtime:{onMessage:{addListener(fn){listener=fn;}}}},currentTab:1,id:'job',names:['BIKE24'],state:new Map(),wishlist:[item],activeWishlistId:'saved',query:item.query,searchedVariant:'116',checkingList:true,document:{querySelector:node,querySelectorAll:()=>[]},validEAN:value=>/^\d{13}$/.test(value)?value:'',uniqueOffers:offers=>offers,shareVariantEAN(shops,_variant,ean){sharedEAN=ean;return {ean,shops};},filterConflictingEANs:shops=>shops,saveList(){},render(){},updateWishlistProgress(){}});
 vm.runInContext(home.slice(home.indexOf('platform.runtime.onMessage.addListener(d=>'),home.indexOf("document.querySelector('#max').addEventListener")),ctx);
 const message={type:'result',target:1,id:'job',shop:'BIKE24',query:item.ean,url:'https://www.bike24.de/search',offers:[{name:'Saved product',price:30,ean:item.ean,url:'https://www.bike24.de/p1.html'}]};
 listener(message);assert.equal(sharedEAN,item.ean);assert.equal(node('#search-ean').value,'manual draft');assert.equal(ctx.wishlist[0].ean,item.ean);
 ctx.checkingList=false;listener(message);assert.equal(node('#search-ean').value,'manual draft');
});
