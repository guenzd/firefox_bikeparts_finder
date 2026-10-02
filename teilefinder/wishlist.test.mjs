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
