import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';
const ctx=vm.createContext({crypto:webcrypto,URL});vm.runInContext(readFileSync(new URL('./firefox-r2/wishlist-file.js',import.meta.url),'utf8'),ctx);
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
