import {readSource} from './test-sources.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';
const ctx=vm.createContext({crypto:webcrypto,URL});vm.runInContext(readSource('variant-match.js'),ctx);vm.runInContext(readSource('price-history.js'),ctx);vm.runInContext(readSource('wishlist-file.js'),ctx);
test('Wishlist file round trip retains query, variant and cap, discarding legacy cart markers including result state',()=>{
 ctx.items=[{query:'Continental Aero 111',variant:'29 mm',maxPrice:80,shops:[{name:'BIKE24',offers:[{name:'Continental Aero 111',variant:'29 mm',url:'https://www.bike24.de/p1838076.html',price:69.99,priceKind:'exact',stock:'Auf Lager'}]}],cart:{key:'bike-components|url|29mm',clicked:true}}];
 const rows=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);
 assert.equal(rows[0].query,'Continental Aero 111');assert.equal(rows[0].variant,'29 mm');assert.equal(rows[0].maxPrice,80);assert.equal(rows[0].cart,undefined);assert.equal(rows[0].shops.length,1);assert.equal(rows[0].shops[0].offers[0].price,69.99);assert.equal(rows[0].checkedAt,null);
});
test('Import merges without losing existing items or duplicating repeats',()=>{
 ctx.existing=[{id:'kept',query:'Chain',variant:'116',maxPrice:null}];ctx.incoming=[{query:'chain',variant:'116',maxPrice:null},{query:'Tyre',variant:'29mm',maxPrice:90}];
 const rows=vm.runInContext('mergeWishlistFile(existing,incoming)',ctx);assert.equal(rows.length,2);assert.equal(rows[0].id,'kept');
});
test('Invalid format, excessive size and invalid prices fail before modifying the list',()=>{
 for(const data of [{format:'other',version:1,items:[]},{format:'teilefinder-wishlist',version:1,items:[{query:'Tyre',variant:'29mm',maxPrice:-1}]},{format:'teilefinder-wishlist',version:1,items:[{query:'',variant:'',maxPrice:null}]}]){ctx.text=JSON.stringify(data);assert.throws(()=>vm.runInContext('parseWishlistFile(text)',ctx));}
 ctx.text=' '.repeat(2_000_001);assert.throws(()=>vm.runInContext('parseWishlistFile(text)',ctx));
});
test('EAN survives export and import and enriches existing wishlist entries',()=>{
 ctx.items=[{query:'Continental Grand Prix 5000 S TR',variant:'30 mm schwarz',maxPrice:null,ean:'4019238054415'}];
 const rows=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);assert.equal(rows[0].ean,'4019238054415');
 ctx.existing=[{id:'kept',query:rows[0].query,variant:rows[0].variant,maxPrice:null}];ctx.incoming=rows;
 const merged=vm.runInContext('mergeWishlistFile(existing,incoming)',ctx);assert.equal(merged.length,1);assert.equal(merged[0].id,'kept');assert.equal(merged[0].ean,'4019238054415');
});
test('Full screen snapshot restores the search fields, results, EAN, timestamps and stale state',()=>{
 ctx.items=[];ctx.screen={query:'Continental Aero 111',variant:'29 mm',ean:'4019238283907',maxPrice:80,searchedQuery:'Continental Aero 111',searchedVariant:'29 mm',shops:[{name:'bike-components',url:'https://www.bike-components.de/de/s/?keywords=Aero',checkedAt:'2026-10-02T18:00:00Z',stale:true,offers:[{name:'Aero 111',variant:'29 mm schwarz',ean:'4019238283907',price:71.99,priceKind:'exact',stock:'Auf Lager',url:'https://www.bike-components.de/de/Continental/Aero-p172556/'}],message:'Vorheriges Angebot'}]};
 const rows=vm.runInContext('parseWishlistFile(wishlistFile(items,screen))',ctx);
 assert.equal(rows.length,0);assert.equal(rows.screen.query,ctx.screen.query);assert.equal(rows.screen.ean,'4019238283907');assert.equal(rows.screen.maxPrice,80);assert.equal(rows.screen.shops[0].offers[0].price,71.99);assert.equal(rows.screen.shops[0].checkedAt,ctx.screen.shops[0].checkedAt);assert.equal(rows.screen.shops[0].stale,true);
});
test('Old wishlist files remain readable and newer imported results enrich existing items',()=>{
 ctx.text=JSON.stringify({format:'teilefinder-wishlist',version:1,items:[{query:'Tyre',variant:'29 mm',maxPrice:null}]});const old=vm.runInContext('parseWishlistFile(text)',ctx);assert.equal(old[0].shops.length,0);
 ctx.existing=[{id:'keep-id',query:'Tyre',variant:'29 mm',maxPrice:null,shops:[],checkedAt:null}];ctx.incoming=[{query:'Tyre',variant:'29 mm',maxPrice:null,shops:[{name:'BIKE24',offers:[]}],checkedAt:'2026-10-02T18:00:00Z'}];
 const rows=vm.runInContext('mergeWishlistFile(existing,incoming)',ctx);assert.equal(rows[0].id,'keep-id');assert.equal(rows[0].shops.length,1);
});
test('Price history export/import preserves observations and rejects untrusted URLs',()=>{
 ctx.history=[{key:'search|8020775045428',ean:'8020775045428',at:'2026-10-12T10:00:00Z',offers:[{shop:'Bike-Discount',price:22.99,url:'https://www.bike-discount.de/de/example',stock:'Auf Lager'}]}];
 const rows=vm.runInContext('parseWishlistFile(wishlistFile([],null,history))',ctx);assert.equal(rows.history[0].offers[0].price,22.99);
 ctx.history[0].offers[0].url='https://example.com/';assert.throws(()=>vm.runInContext('parseWishlistFile(wishlistFile([],null,history))',ctx));
});
test('History records only confirmed EANs and deliverable exact prices, ignoring stale shops',()=>{
 vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),ctx);
 ctx.shops=[{name:'BIKE24',done:true,offers:[{ean:'8020775045428',price:22.99,priceKind:'exact',stock:'Auf Lager',url:'https://www.bike24.de/p1.html'},{ean:'8020775045428',price:10,priceKind:'exact',stock:'Nicht lieferbar'},{ean:'',price:5,priceKind:'exact',stock:'Auf Lager'},{ean:'8020775045428',price:2,priceKind:'from',stock:'Auf Lager'}]},{name:'r2-bike',done:true,stale:true,offers:[{ean:'8020775045428',price:1,priceKind:'exact',stock:'Auf Lager'}]}];
 const result=vm.runInContext("priceObservations(shops,'job','2026-10-12T10:00:00Z')",ctx);assert.equal(result.length,1);assert.equal(result[0].offers.length,1);assert.equal(result[0].offers[0].price,22.99);assert.equal(result[0].key,'job|8020775045428');
});
test('Per-product EAN switch survives export and import while retaining its identifier',()=>{
 ctx.items=[{query:'Example',variant:'Vanille',maxPrice:null,ean:'1234567890128',useEAN:false}];
 const result=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);assert.equal(result[0].useEAN,false);assert.equal(result[0].ean,'1234567890128');
 ctx.items[0].useEAN=undefined;assert.equal(vm.runInContext('parseWishlistFile(wishlistFile(items))[0].useEAN',ctx),true);
});
test('Price ranges survive file round trips and invalid lower bounds are rejected',()=>{
 ctx.items=[{query:'Example',variant:'',minPrice:5,maxPrice:10}];
 let result=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);assert.equal(result[0].minPrice,5);assert.equal(result[0].maxPrice,10);
 ctx.items[0].minPrice=11;assert.throws(()=>vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx));
});

test('File snapshots retain verified EAN search provenance without marking unfinished searches complete',()=>{
 const shops=ctx.snapshotShops([{name:'BIKE24',queriedEAN:'4524667879565',done:true,offers:[]},{name:'Bike-Discount',queriedEAN:'4524667879565',done:false,offers:[]}]);
 assert.equal(shops[0].queriedEAN,'4524667879565');assert.equal(shops[0].done,true);assert.equal(shops[1].done,false);
});

test('Product-level EAN evidence survives saved results without becoming a SKU confirmation',()=>{
 const shops=ctx.snapshotShops([{name:'BIKE24',offers:[{name:'Chain',price:40,ean:'4524667879565',eanEvidence:'datasheet',url:'https://www.bike24.de/p1271583.html'}]}]);
 assert.equal(shops[0].offers[0].eanEvidence,'datasheet');
});

test('Export and import retain bounded concrete selections for native, radio and custom options',()=>{
 const selection=[{kind:'select',id:'color',name:'color',label:'Farbe',value:'black',text:'schwarz'},{kind:'radio',id:'size-1',value:'size-1',text:'1 L'},{kind:'option',id:'width-30',value:'width-30',text:'30 mm'}];
 const item={query:'Generic product',variant:'',maxPrice:null,shops:[{name:'BIKE24',offers:[{name:'Generic product',price:20,url:'https://www.bike24.de/p1.html',selection}]}]};
 const imported=ctx.parseWishlistFile(ctx.wishlistFile([item]));const saved=imported[0].shops[0].offers[0].selection;
 assert.equal(saved.length,3);assert.equal(saved[0].name,'color');assert.equal(saved[0].label,'Farbe');assert.equal(saved[1].kind,'radio');assert.equal(saved[2].text,'30 mm');
 assert.ok(ctx.cleanVariantSelection([null,{kind:'submit',id:'cart',value:'anything'}]).every(value=>value.kind==='select'));
 assert.equal(ctx.cleanVariantSelection(Array(30).fill(selection[0])).length,20);
});

test('Snapshot roundtrip preserves cheapest-product comparison mode and its candidate offers',()=>{
 const shop={name:'Bike-Discount',comparisonMode:'cheapest',offers:[{name:'A Spray',url:'https://www.bike-discount.de/de/a',price:6,priceKind:'exact',stock:'Auf Lager'},{name:'B Spray',url:'https://www.bike-discount.de/de/b',price:8,priceKind:'exact',stock:'Auf Lager'}]};
 const snapshot=ctx.snapshotShops([shop]);assert.equal(snapshot[0].comparisonMode,'cheapest');assert.equal(snapshot[0].offers.length,2);
 ctx.items=[{query:'Spray',variant:'',maxPrice:null,shops:[shop]}];const loaded=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);assert.equal(loaded[0].shops[0].comparisonMode,'cheapest');assert.equal(loaded[0].shops[0].offers.length,2);
 assert.equal(ctx.snapshotShops([{...shop,comparisonMode:'unknown'}])[0].comparisonMode,undefined);
});

test('Name fallback results survive export/import without changing the requested EAN or inventing a missing offer EAN',()=>{
 ctx.items=[{query:'Generic gel 24er',variant:'Citrus',ean:'1234567890128',useEAN:true,minPrice:10,maxPrice:20,shops:[{name:'BIKE24',matchMode:'name-fallback',offers:[{name:'Generic gel 24x40ml',variant:'Citrus',price:15,priceKind:'exact',stock:'Auf Lager',ean:'',url:'https://www.bike24.de/generic-pack'}]}]}];
 const rows=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);assert.equal(rows[0].ean,'1234567890128');assert.equal(rows[0].useEAN,true);assert.equal(rows[0].shops[0].matchMode,'name-fallback');assert.equal(rows[0].shops[0].offers[0].ean,'');assert.equal(rows[0].minPrice,10);assert.equal(rows[0].maxPrice,20);
});

test('File export retains the selected display sort without rewriting insertion order',()=>{
 const items=[{query:'Zug',variant:'',maxPrice:null},{query:'Ärmel',variant:'',maxPrice:null}],screen={query:'',variant:'',ean:'',maxPrice:null,shops:[],wishlistSort:'price'};
 const parsed=ctx.parseWishlistFile(ctx.wishlistFile(items,screen));assert.equal(parsed.screen.wishlistSort,'price');assert.deepEqual(Array.from(parsed,i=>i.query),['Zug','Ärmel']);
 screen.wishlistSort='invalid';assert.equal(ctx.parseWishlistFile(ctx.wishlistFile(items,screen)).screen.wishlistSort,'added');
});
