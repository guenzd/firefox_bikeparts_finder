import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8')+readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8'),ctx);
const offer=(price,stock,variant='116 Glieder',priceKind='exact')=>({price,stock,variant,priceKind,url:'https://shop.example/product'});
const sum=items=>{ctx.items=items;return vm.runInContext('cheapestWishlist(items)',ctx);};
test('Cheapest deliverable exact variant respects each item price cap and sums across shops',()=>{
 const s=sum([{query:'chain',maxPrice:30,variant:'',shops:[{name:'A',offers:[offer(10,'Nicht lieferbar'),offer(27.99,'Lagernd, Lieferzeit 1-3 Tage')]},{name:'B',offers:[offer(29,'Auf Lager')]}]},{query:'bottle',maxPrice:15,variant:'750',shops:[{name:'A',offers:[offer(5,'Auf Lager','500 ml'),offer(12.99,'Versand in 1-3 Werktagen','750 ml')]}]}]);
 assert.equal(s.complete,true);assert.equal(s.total,40.98);assert.equal(s.rows[0].best.shop,'A');assert.equal(s.rows[1].best.variant,'750 ml');
});
test('Unknown stock, future availability, from-prices and over-budget offers cannot make a complete total',()=>{
 const s=sum([{query:'chain',maxPrice:20,shops:[{name:'A',offers:[offer(19,'Auf Lager','116','from'),offer(10,'Lagerstatus nicht auslesbar'),offer(21,'Auf Lager'),offer(15,'Verfügbar in 2-4 Wochen')]}]},{query:'bottle',maxPrice:null,shops:[{name:'A',offers:[offer(12,'1-2 Arbeitstage')]}]}]);
 assert.equal(s.complete,false);assert.equal(s.missing,1);assert.equal(s.total,12);
});
test('Persisted wishlist data produces the same total after reload',()=>{
 const items=[{id:'item',query:'chain',maxPrice:30,variant:'126',shops:[{name:'A',offers:[offer(27.99,'Auf Lager','126 Glieder')]}],checkedAt:'2026-10-02T12:00:00Z'}];assert.equal(sum(JSON.parse(JSON.stringify(items))).total,27.99);assert.equal(sum([]).complete,false);
});

test('Correcting a wishlist name clears stale results and keeps EAN, variant, cap',()=>{
 const c=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8')+readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8'),c);
 c.items=[{id:'a',query:'Conti Aro',ean:'4019238283907',variant:'29 mm',maxPrice:80,shops:[{name:'old'}],checkedAt:'yesterday'},{id:'b',query:'Chain'}];
 const result=vm.runInContext("renameWishlistItem(items,'a',' Continental Aero 111 ')",c);
 assert.equal(result[0].query,'Continental Aero 111');assert.equal(result[0].ean,'4019238283907');assert.equal(result[0].variant,'29 mm');assert.equal(result[0].maxPrice,80);assert.equal(result[0].shops.length,0);assert.equal(result[0].checkedAt,null);assert.equal(result[1].query,'Chain');assert.equal(c.items[0].query,'Conti Aro');
 assert.throws(()=>vm.runInContext("renameWishlistItem(items,'a','  ')",c));
});

test('Single item recheck updates only its results while retaining settings',()=>{
 const c=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8')+readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8'),c);
 c.items=[{id:'a',query:'Tyre',variant:'29 mm',maxPrice:80,shops:[]},{id:'b',query:'Chain',shops:[{name:'retained'}],checkedAt:'old'}];
 c.shops=[{name:'bike-components',offers:[{price:71.99}]}];
 const result=vm.runInContext("applyWishlistSearch(items,'a',shops,'now')",c);
 assert.equal(JSON.stringify(result[0].shops),JSON.stringify(c.shops));assert.equal(result[0].checkedAt,'now');assert.equal(result[0].query,'Tyre');assert.equal(result[0].variant,'29 mm');assert.equal(result[0].maxPrice,80);assert.equal(result[1],c.items[1]);assert.equal(c.items[0].shops.length,0);
});

test('Empty refresh preserves previous offers as stale and excludes them from current totals',()=>{
 const c=vm.createContext({variantMatches:()=>true});vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8')+readFileSync(new URL('./firefox-r2/wishlist.js',import.meta.url),'utf8'),c);
 c.items=[{id:'a',maxPrice:null,shops:[{name:'BIKE24',checkedAt:'old',offers:[{price:20,priceKind:'exact',stock:'Auf Lager'}]}]}];
 const rows=vm.runInContext("applyWishlistSearch(items,'a',[{name:'BIKE24',offers:[],message:'Timeout'}],'now')",c);
 assert.equal(rows[0].shops[0].offers[0].price,20);assert.equal(rows[0].shops[0].checkedAt,'old');assert.equal(rows[0].shops[0].stale,true);
 c.items=rows;assert.equal(vm.runInContext('cheapestWishlist(items).total',c),0);
});

test('Rechecking a wishlist item fills its empty EAN even without a variant filter and persists it',()=>{
 const items=[{id:'tyre',query:'Continental Aero 111',variant:'',ean:'',maxPrice:null,shops:[]},{id:'chain',query:'Chain',ean:'1234567890123'}];
 const shops=[{name:'bike-components',offers:[{name:'Continental Aero 111',variant:'29 mm schwarz',price:71.99,priceKind:'exact',stock:'Auf Lager',ean:'4019238283907'}]}];
 const updated=ctx.applyWishlistSearch(items,'tyre',shops,'now');
 assert.equal(updated[0].ean,'4019238283907');assert.equal(updated[1],items[1]);assert.equal(items[0].ean,'');
 assert.equal(JSON.parse(JSON.stringify(updated))[0].ean,'4019238283907');
});
test('Wishlist recheck keeps EAN empty if several different variant EANs are found',()=>{
 const items=[{id:'tyre',query:'Continental Aero 111',variant:'',ean:'',shops:[]}];
 const shops=[{name:'bike-components',offers:['4019238283907','4019238283921'].map(ean=>({ean,priceKind:'exact',variant:'Reifen'}))}];
 assert.equal(ctx.applyWishlistSearch(items,'tyre',shops,'now')[0].ean,'');
});

test('Shop details include every wishlist item and update only the actively searched item',()=>{
 const items=[{id:'a',query:'Tyre',variant:'30 mm',maxPrice:80,shops:[{name:'BIKE24',offers:[{price:70}]}]},{id:'b',query:'Gel',variant:'Cola',maxPrice:60,shops:[]},{id:'c',query:'Chain',shops:[{name:'BIKE24',offers:[],message:'Kein Treffer'}]}];
 ctx.items=items;ctx.live=new Map([['BIKE24',{name:'BIKE24',offers:[{price:53}]}]]);
 const rows=vm.runInContext("wishlistShopEntries(items,'BIKE24','b',live)",ctx);
 assert.equal(rows.length,3);assert.equal(rows[0].shop.offers[0].price,70);assert.equal(rows[1].shop.offers[0].price,53);assert.equal(rows[2].shop.message,'Kein Treffer');
 const empty=vm.runInContext("wishlistShopEntries(items,'r2-bike')",ctx);
 assert.equal(empty.length,3);assert.ok(empty.every(r=>r.shop.message==='Noch nicht geprüft.'));
});
