import {readSource} from './test-sources.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),ctx);
const offer=(price,stock,variant='116 Glieder',priceKind='exact')=>({price,stock,variant,priceKind,url:'https://shop.example/product'});
const sum=items=>{ctx.items=items;return vm.runInContext('cheapestWishlist(items)',ctx);};
test('Cheapest deliverable exact variant respects each item price cap and sums across shops',()=>{
 const s=sum([{query:'chain',maxPrice:30,variant:'',shops:[{name:'A',offers:[offer(10,'Nicht lieferbar'),offer(27.99,'Lagernd, Lieferzeit 1-3 Tage'),offer(28,'Auf Lager')]},{name:'B',offers:[offer(29,'Auf Lager')]}]},{query:'bottle',maxPrice:15,variant:'750',shops:[{name:'A',offers:[offer(5,'Auf Lager','500 ml'),offer(12.99,'Versand in 1-3 Werktagen','750 ml')]}]}]);
 assert.equal(s.complete,true);assert.equal(s.total,40.98);assert.equal(s.rows[0].best.shop,'A');assert.equal(s.rows[1].best.variant,'750 ml');assert.equal(s.rows[0].availableShops,2);assert.equal(s.rows[1].availableShops,1);
});
test('Unknown stock, future availability, from-prices and over-budget offers cannot make a complete total',()=>{
 const s=sum([{query:'chain',maxPrice:20,shops:[{name:'A',offers:[offer(19,'Auf Lager','116','from'),offer(10,'Lagerstatus nicht auslesbar'),offer(21,'Auf Lager'),offer(15,'Verfügbar in 2-4 Wochen')]}]},{query:'bottle',maxPrice:null,shops:[{name:'A',offers:[offer(12,'1-2 Arbeitstage')]}]}]);
 assert.equal(s.complete,false);assert.equal(s.missing,1);assert.equal(s.total,12);assert.equal(s.rows[0].availableShops,0);assert.equal(s.rows[1].availableShops,1);
});
test('Persisted wishlist data produces the same total after reload',()=>{
 const items=[{id:'item',query:'chain',maxPrice:30,variant:'126',shops:[{name:'A',offers:[offer(27.99,'Auf Lager','126 Glieder')]}],checkedAt:'2026-10-02T12:00:00Z'}];assert.equal(sum(JSON.parse(JSON.stringify(items))).total,27.99);assert.equal(sum([]).complete,false);
});

test('Correcting a wishlist name clears stale results and keeps EAN, variant, cap',()=>{
 const c=vm.createContext({});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),c);
 c.items=[{id:'a',query:'Conti Aro',ean:'4019238283907',variant:'29 mm',maxPrice:80,shops:[{name:'old'}],checkedAt:'yesterday'},{id:'b',query:'Chain'}];
 const result=vm.runInContext("renameWishlistItem(items,'a',' Continental Aero 111 ')",c);
 assert.equal(result[0].query,'Continental Aero 111');assert.equal(result[0].ean,'4019238283907');assert.equal(result[0].variant,'29 mm');assert.equal(result[0].maxPrice,80);assert.equal(result[0].shops.length,0);assert.equal(result[0].checkedAt,null);assert.equal(result[1].query,'Chain');assert.equal(c.items[0].query,'Conti Aro');
 assert.throws(()=>vm.runInContext("renameWishlistItem(items,'a','  ')",c));
});

test('Single item recheck updates only its results while retaining settings',()=>{
 const c=vm.createContext({});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),c);
 c.items=[{id:'a',query:'Tyre',variant:'29 mm',maxPrice:80,shops:[]},{id:'b',query:'Chain',shops:[{name:'retained'}],checkedAt:'old'}];
 c.shops=[{name:'bike-components',offers:[{price:71.99}]}];
 const result=vm.runInContext("applyWishlistSearch(items,'a',shops,'now')",c);
 assert.equal(JSON.stringify(result[0].shops),JSON.stringify(c.shops));assert.equal(result[0].checkedAt,'now');assert.equal(result[0].query,'Tyre');assert.equal(result[0].variant,'29 mm');assert.equal(result[0].maxPrice,80);assert.equal(result[1],c.items[1]);assert.equal(c.items[0].shops.length,0);
});

test('Empty refresh preserves previous offers as stale and excludes them from current totals',()=>{
 const c=vm.createContext({variantMatches:()=>true});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),c);
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

test('Price input parses maxima, inclusive ranges and decimal commas and rejects malformed ranges',()=>{
 for(const [input,min,max] of [['10',null,10],['5-10',5,10],['5,50 – 10,25',5.5,10.25],['',null,null],['0-0',0,0]]){
  ctx.priceInput=input;const range=vm.runInContext('parsePriceRange(priceInput)',ctx);assert.equal(range.minPrice,min);assert.equal(range.maxPrice,max);
 }
 for(const input of ['10-5','-5','5-','5-10-15','abc','1.234']){ctx.priceInput=input;assert.throws(()=>vm.runInContext('parsePriceRange(priceInput)',ctx));}
 const result=sum([{query:'Example',variant:'',minPrice:5,maxPrice:10,shops:[{name:'A',offers:[offer(4.99,'Auf Lager'),offer(5,'Auf Lager'),offer(10,'Auf Lager'),offer(10.01,'Auf Lager')]}]}]);assert.equal(result.total,5);
 ctx.range={minPrice:5,maxPrice:10};assert.equal(vm.runInContext('withinPriceRange(10,range)',ctx),true);assert.equal(vm.runInContext('withinPriceRange(4.99,range)',ctx),false);
});


test('Price bounds narrow similar suggestions without mutating saved candidates',()=>{
 const suggestions=[{price:4.99},{price:5},{price:7},{price:10},{price:10.01},{price:null},{name:'unknown'}];
 const original=JSON.stringify(suggestions);
 assert.deepEqual(Array.from(ctx.priceFilteredSuggestions(suggestions,{minPrice:5,maxPrice:10}),o=>o.price),[5,7,10]);
 assert.deepEqual(Array.from(ctx.priceFilteredSuggestions(suggestions,{maxPrice:5}),o=>o.price),[4.99,5]);
 assert.equal(ctx.priceFilteredSuggestions(suggestions,{}).length,7);
 assert.equal(ctx.priceFilteredSuggestions(suggestions,{minPrice:20,maxPrice:30}).length,0);
 assert.equal(JSON.stringify(suggestions),original);
});


test('Direct EAN searches reuse wishlist product URLs without including different identifiers or mutating data',()=>{
 const url='https://www.bike-discount.de/de/example',ean='8020775045428';
 const item={ean,shops:[{name:'Bike-Discount',offers:[{url,ean,name:'Example',price:20},{url:url+'-other',ean:'9999999999999',price:10}]}]};
 const before=JSON.stringify(item);
 const result=ctx.knownSearchShops([], [item],ean);
 assert.equal(result.length,1);assert.equal(result[0].offers.length,1);assert.equal(result[0].offers[0].url,url);
 assert.equal(ctx.knownSearchShops([], [item],'').length,0);assert.equal(JSON.stringify(item),before);
 const merged=ctx.knownSearchShops([{name:'Bike-Discount',offers:[item.shops[0].offers[0]]}],[item],ean);
 assert.equal(merged[0].offers.length,1);
});


test('Week-based r2-bike delivery estimates never count as immediately deliverable',()=>{
 for(const stock of ['in ca. 1 - 2 Wochen','Lieferzeit: 1-2 Wochen','in 1 Woche · Versand ab Lager'])assert.equal(ctx.deliverable(stock),false);
 assert.equal(ctx.deliverable('ab Lager verfügbar'),true);
});


test('Article popup filters variants and price bounds then sorts all shops together without empty rows',()=>{
 const item={variant:'30 mm',minPrice:20,maxPrice:50};
 const entries=[{shop:{name:'A',offers:[offer(45,'Auf Lager','30 mm'),offer(19,'Auf Lager','30 mm'),offer(35,'Auf Lager','28 mm')]}},{shop:{name:'B',offers:[offer(20,'Nicht lieferbar','30 mm'),offer(51,'Auf Lager','30 mm')]}},{shop:{name:'C',offers:[]}}];
 const rows=ctx.wishlistPriceRows(entries,item);assert.deepEqual(Array.from(rows,r=>r.offer.price),[20,45]);assert.equal(rows[0].shop.name,'B');assert.equal(rows[0].offer.stock,'Nicht lieferbar');
 assert.equal(ctx.wishlistPriceRows(entries,{...item,maxPrice:20}).length,1);assert.equal(ctx.wishlistPriceRows(entries,{...item,minPrice:46}).length,0);
});


test('Future availability dates never contribute to the deliverable total',()=>{
 for(const stock of ['verfügbar ab 4.11.','Verfügbar ab 04.11.2026','lieferbar ab 4.11.','erhältlich ab dem 4.11.','verfügbar\u00a0ab\u00a04.11.'])assert.equal(ctx.deliverable(stock),false);
 assert.equal(sum([{query:'Example',shops:[{name:'bike-components',offers:[offer(12,'verfügbar ab 4.11.')]}]}]).missing,1);
});


test('Wishlist total distinguishes unavailable matches, unknown stock, price bounds and no matches',()=>{
 const item={query:'Example',checkedAt:'2026-10-23T10:00:00Z',maxPrice:30,shops:[{name:'Shop',offers:[offer(20,'Nicht lieferbar'),offer(25,'Nachbestellung')]}]};
 assert.equal(sum([item]).rows[0].missingMessage,'Nicht lieferbar');assert.equal(sum([item]).total,0);
 assert.equal(sum([{...item,shops:[{name:'Shop',offers:[offer(20,'Lagerstatus nicht auslesbar')]}]}]).rows[0].missingMessage,'Lagerstatus unbekannt');
 assert.equal(sum([{...item,maxPrice:10}]).rows[0].missingMessage,'Kein passendes Angebot im Preisbereich');
 assert.equal(sum([{...item,shops:[]}]).rows[0].missingMessage,'Kein passendes Angebot');
 assert.equal(sum([{...item,shops:[{...item.shops[0],stale:true}]}]).rows[0].missingMessage,'Kein passendes Angebot');
 assert.equal(sum([{query:'New'}]).rows[0].missingMessage,'Noch nicht geprüft');
});

test('EAN visibility uses displayed four-shop matches without requiring metadata or a new search',()=>{
 const names=['BIKE24','Bike-Discount','bike-components','r2-bike'];
 const shops=names.map((name,i)=>({name,done:false,stale:true,offers:[{name:'Sealant',ean:i?'':'5060451584983',variant:'1000 ml',price:23.99,priceKind:'exact'}]}));
 const item={variant:'1000 ml',maxPrice:50};
 assert.equal(ctx.allShopsHaveDisplayedOffers(shops,item),true);
 assert.equal(ctx.allShopsHaveDisplayedOffers(shops.map(shop=>({...shop,offers:shop.offers.map(offer=>({...offer,ean:'1234567890128'}))})),item),true);
 assert.equal(ctx.allShopsHaveDisplayedOffers(shops.slice(1),item),false);
 for(const offer of [null,{price:60,variant:'1000 ml'},{price:23.99,variant:'500 ml'}]){
  assert.equal(ctx.allShopsHaveDisplayedOffers([{...shops[0],offers:offer?[offer]:[]},...shops.slice(1)],item),false);
 }
});

test('Applying a wishlist search never persists conflicting EAN offers when EAN is enabled',()=>{
 const ean='8057628581253',other='8057628583325';
 const shops=[{name:'r2-bike',offers:[{name:'Chain',ean,price:59.99,priceKind:'exact'},{name:'Other chain',ean:other,price:59.99,priceKind:'exact'}]}];
 for(const useEAN of [true,false]){
  const item={id:'chain',query:'Example chain',ean,useEAN,shops:[]};
  const updated=ctx.applyWishlistSearch([item],'chain',shops,'2026-10-24T12:00:00Z')[0];
  assert.equal(updated.ean,ean);assert.equal(updated.shops[0].offers.length,useEAN?1:2);assert.equal(shops[0].offers.length,2);
 }
});

test('Shop totals count the cheapest deliverable exact offer once per wishlist item and exclude stale, out-of-range and unmatched variants',()=>{
 const offer=(price,extra={})=>({price,priceKind:'exact',variant:'black',stock:'Auf Lager',...extra});
 const item={variant:'black',minPrice:5,maxPrice:20};
 const entries=[
  {item,shop:{offers:[offer(12),offer(8),offer(5,{priceKind:'from'}),offer(6,{stock:'Nicht lieferbar'}),offer(4),offer(7,{variant:'white'})]}},
  {item,shop:{offers:[offer(10.15)]}},
  {item,shop:{stale:true,offers:[offer(5)]}},
  {item,shop:{offers:[offer(21)]}},
  {item,shop:{offers:[]}}
 ];
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.shopWishlistSummary(entries))),{total:18.15,available:2,count:5});
});

test('Product comparisons show the lowest deliverable exact offer per shop under the current filters and retain alternatives',()=>{
 const shop={name:'A',comparisonMode:'cheapest',offers:[
  {...offer(5,'Nicht lieferbar','400 ml'),name:'A',url:'https://shop.example/a'},
  {...offer(6,'Auf Lager','400 ml'),name:'B',url:'https://shop.example/b'},
  {...offer(8,'Auf Lager','400 ml'),name:'C',url:'https://shop.example/c'},
  {...offer(3,'Auf Lager','400 ml','from'),name:'D',url:'https://shop.example/d'},
  {...offer(2,'Auf Lager','100 ml'),name:'E',url:'https://shop.example/e'}]};
 assert.equal(ctx.displayedShopOffers(shop,{variant:'400 ml',maxPrice:10})[0].price,6);
 assert.equal(ctx.displayedShopOffers(shop,{variant:'400 ml',minPrice:7,maxPrice:10})[0].price,8);
 assert.equal(ctx.displayedShopOffers(shop,{variant:'400 ml',maxPrice:5})[0].stock,'Nicht lieferbar');
 assert.equal(ctx.displayedShopOffers(shop,{variant:'400 ml',maxPrice:4}).length,0);
 assert.equal(shop.offers.length,5);
 assert.equal(ctx.displayedShopOffers({...shop,comparisonMode:''},{variant:'400 ml',maxPrice:10}).length,4);
 const rows=ctx.wishlistPriceRows([{shop}],{variant:'400 ml',maxPrice:10});assert.equal(rows.length,1);assert.equal(rows[0].offer.price,6);
 const updated=ctx.applyWishlistSearch([{id:'general',query:'Spray',variant:'',ean:''}],'general',[shop],'2026-10-29T12:00:00Z');assert.equal(updated[0].ean,'');assert.equal(updated[0].shops[0].offers.length,5);
});

test('Applying a wishlist name fallback preserves the requested EAN and independent confirmed EAN results',()=>{
 const ctx=vm.createContext({URL});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),ctx);
 ctx.item={id:'one',query:'Generic gel 24er',variant:'Citrus',ean:'1234567890128',useEAN:true,minPrice:10,maxPrice:20,shops:[]};
 const offer=(ean,url)=>({name:'Generic gel 24x40ml',ean,variant:'Citrus',price:15,priceKind:'exact',stock:'Auf Lager',url});
 for(const actual of ['', '9876543210982']){
  ctx.shops=[{name:'BIKE24',matchMode:'name-fallback',offers:[offer(actual,'https://www.bike24.de/generic-pack')]},{name:'Bike-Discount',offers:[offer('1234567890128','https://www.bike-discount.de/generic-pack')]}];
  const row=vm.runInContext("applyWishlistSearch([item],'one',shops,'2026-10-30T16:00:00Z')[0]",ctx);assert.equal(row.ean,'1234567890128');assert.equal(row.useEAN,true);assert.equal(row.shops[0].matchMode,'name-fallback');if(actual){assert.equal(row.shops[0].offers.length,0);assert.equal(row.shops[0].suggestions[0].ean,actual);}else assert.equal(row.shops[0].offers[0].ean,'');assert.equal(row.shops[1].offers[0].ean,'1234567890128');assert.equal(row.minPrice,10);assert.equal(row.maxPrice,20);
 }
});

test('Saved conflicting name-fallback offers are suggestions immediately, excluded from every wishlist comparison and retained when EAN is disabled',()=>{
 const c=vm.createContext({URL});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),c);
 const wanted='1234567890128',wrong='9876543210982',make=(ean,price)=>({name:'Generic chain 12-speed',ean,price,priceKind:'exact',variant:'',stock:'Auf Lager',url:'https://example.org/'+ean});
 const item={id:'one',query:'Generic chain',ean:wanted,useEAN:true,maxPrice:50,shops:[{name:'BIKE24',offers:[make(wanted,30)]},{name:'Bike-Discount',matchMode:'name-fallback',offers:[make(wrong,10)]},{name:'r2-bike',matchMode:'name-fallback',offers:[make('',35)]}]},before=JSON.stringify(item);
 assert.equal(c.cheapestWishlist([item]).total,30);assert.equal(c.cheapestWishlist([item]).rows[0].availableShops,2);assert.equal(c.displayedShopOffers(item.shops[1],item).length,0);
 const entries=c.wishlistShopEntries([item],'Bike-Discount');assert.equal(entries[0].shop.offers.length,0);assert.equal(entries[0].shop.suggestions[0].ean,wrong);assert.equal(c.shopWishlistSummary(entries).total,0);assert.equal(c.wishlistPriceRows(entries,item).length,0);
 const normalized=c.verifiedWishlistItems([item]);assert.equal(normalized[0].ean,wanted);assert.equal(normalized[0].shops[1].suggestions[0].ean,wrong);assert.equal(normalized[0].shops[2].offers[0].ean,'');assert.equal(JSON.stringify(c.verifiedWishlistItems(normalized)),JSON.stringify(normalized));assert.equal(JSON.stringify(item),before);
 item.useEAN=false;assert.equal(c.cheapestWishlist([item]).total,10);assert.equal(c.displayedShopOffers(item.shops[1],item).length,1);assert.equal(c.verifiedWishlistItems([item])[0].shops[1].offers[0].ean,wrong);
});

test('Equivalent UPC and zero-prefixed EAN remain accepted in a name fallback',()=>{
 const c=vm.createContext({URL});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),c);
 const shops=[{name:'BIKE24',matchMode:'name-fallback',offers:[{name:'Generic tool',ean:'763477000385',price:20,priceKind:'exact',stock:'Auf Lager'}]}];
 const result=c.filterConflictingEANs(shops,'0763477000385');assert.equal(result[0].offers.length,1);assert.equal(result[0].offers[0].ean,'763477000385');
});
