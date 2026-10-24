import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('./firefox-r2/home.js',import.meta.url),'utf8');
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
 const nodes={};const ctx=vm.createContext({state,names:['A','B','C','D'],id:'old-job',browser:{runtime:{sendMessage(){cancelled++;return Promise.resolve();}}},document:{querySelector:s=>nodes[s]||(nodes[s]={})},render(){renders++;},finishSearch(rows){finished=rows;}});
 vm.runInContext(home.slice(home.indexOf('function finishTimedOutSearch(')),ctx);
 ctx.finishTimedOutSearch();assert.equal(ctx.id,'');assert.equal(finished.length,4);assert.equal(state.get('A').stale,undefined);assert.equal(state.get('B').stale,true);assert.equal(state.get('B').offers[0].price,20);assert.ok([...state.values()].every(s=>s.done));assert.equal(ctx.finishSearch,null);assert.equal(cancelled,1);
 ctx.finishTimedOutSearch();assert.equal(cancelled,1);assert.equal(renders,1);
});

test('List copy exports only deliverable products, one name and URL per line, without duplicates',async()=>{
 let copied;const status={};
 const button={classList:{add(){}},append(){},setAttribute(){}};
 const ctx=vm.createContext({cleanShopUrl:value=>value,copyButton:(_url,callback)=>{button.click=callback;return button;},document:{createTextNode:()=>({}),querySelector:()=>status},navigator:{clipboard:{async writeText(text){copied=text;}}}});
 const wishlistCode=readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8');
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
 vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8'),ctx);
 const wishlistCode=readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8');
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
 vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8'),ctx);
 const wishlistCode=readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8');
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
 const before=JSON.stringify(wishlist),state=new Map([['BIKE24',{offers:[{name:'Old direct result'}]}]]);
 const ctx=vm.createContext({document:{querySelector:node},wishlist,state,searchDeadline:null,activeWishlistId:'',names:['BIKE24'],query:'Old query',searchedVariant:'',checkingList:false,crypto:{randomUUID:()=> 'new-job'},clearTimeout(){},setTimeout(){return 1;},finishTimedOutSearch(){},render(){},validEAN:()=>'',inputPriceRange:()=>({}),knownSearchShops:()=>[],browser:{runtime:{async sendMessage(){}}}});
 vm.runInContext(home.slice(home.indexOf('function setWishlistCollapsed('),home.indexOf("document.querySelector('#query').addEventListener")),ctx);
 await ctx.startSearch('Individual item','');
 assert.equal(node('#wishlist-content').hidden,true);assert.equal(node('#wishlist-toggle').attrs['aria-expanded'],'false');assert.equal(ctx.wishlistDetails,false);assert.equal(JSON.stringify(wishlist),before);
 node('#wishlist-toggle').click();assert.equal(node('#wishlist-content').hidden,false);assert.equal(JSON.stringify(wishlist),before);
 ctx.setWishlistCollapsed(true);ctx.checkingList=true;await ctx.startSearch('Saved item','',wishlist[0].shops);
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
