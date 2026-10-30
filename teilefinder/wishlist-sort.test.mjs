import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readSource} from './test-sources.mjs';
const ctx=vm.createContext({});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),ctx);
const item=(id,query,price,shop='BIKE24',stock='Auf Lager',extra={})=>({id,query,variant:'',minPrice:null,maxPrice:null,shops:price===null?[]:[{name:shop,offers:[{name:query,price,priceKind:'exact',stock,url:'https://example.org/'+id}]}],...extra});
const ids=rows=>Array.from(rows,row=>row.id);
const rows=[item('z','Zug',15,'r2-bike'),item('a','Ärmel',25,'Bike-Discount'),item('ten','Teil 10',5,'BIKE24'),item('two','Teil 2',10,'bike-components'),item('none','Abdeckung',null)];
test('Name sorting uses German alphabet and natural numbers; insertion order and data remain recoverable',()=>{
 const before=JSON.stringify(rows);assert.deepEqual(ids(ctx.sortWishlistItems(rows,'name')),['a','two','ten','z','none']);
 assert.deepEqual(ids(ctx.sortWishlistItems(rows,'added')),['z','a','ten','two','none']);assert.equal(JSON.stringify(rows),before);
 assert.notEqual(ctx.sortWishlistItems(rows,'added'),rows);assert.deepEqual(ids(ctx.sortWishlistItems(rows,'invalid')),ids(rows));
});
test('Price uses the cheapest deliverable exact filtered offer, with missing and unavailable offers last',()=>{
 const entries=[item('unavailable','A',1,'BIKE24','Nicht lieferbar'),...rows,item('capped','Budget',2,'BIKE24','Auf Lager',{minPrice:3,maxPrice:10}),item('stale','Früher',1,'BIKE24','Auf Lager')];entries.at(-1).shops[0].stale=true;
 assert.deepEqual(ids(ctx.sortWishlistItems(entries,'price')),['ten','two','z','a','unavailable','none','capped','stale']);
});
test('Shop sorts by the cheapest deliverable shop, then product name; no available shop is last',()=>{
 assert.deepEqual(ids(ctx.sortWishlistItems(rows,'shop')),['ten','two','a','z','none']);
 const same=[item('b','Beta',20,'BIKE24'),item('a','Alpha',30,'BIKE24'),item('x','Alpha',30,'BIKE24')];assert.deepEqual(ids(ctx.sortWishlistItems(same,'shop')),['a','x','b']);assert.deepEqual(ids(ctx.sortWishlistItems(same,'price')),['b','a','x']);
});
test('Visible order stays fixed while results arrive, then updates after search completes',()=>{
 const c=vm.createContext({wishlist:structuredClone(rows),wishlistSort:'price',wishlistSortOrder:null,checkingList:false,searchRunning:false});vm.runInContext(readSource('variant-match.js')+readSource('wishlist.js'),c);
 const home=readSource('home.js');vm.runInContext(home.slice(home.indexOf('function wishlistDisplayItems('),home.indexOf('function queueResultRender(')),c);
 assert.deepEqual(ids(c.wishlistDisplayItems()),['ten','two','z','a','none']);c.checkingList=true;assert.deepEqual(ids(c.wishlistDisplayItems()),['ten','two','z','a','none']);
 c.wishlist[0].shops[0].offers[0].price=1;assert.deepEqual(ids(c.wishlistDisplayItems()),['ten','two','z','a','none']);
 c.checkingList=false;assert.deepEqual(ids(c.wishlistDisplayItems()),['z','ten','two','a','none']);assert.deepEqual(ids(c.wishlist),ids(rows));
 c.wishlistSort='added';assert.deepEqual(ids(c.wishlistDisplayItems()),ids(rows));
});

test('Articles without deliverable matches and their suggestions stay at the end in insertion order for every active sort',()=>{
 const a=item('missing-z','Zulu',null),b=item('missing-a','Alpha',null);a.shops=[{name:'BIKE24',offers:[],suggestions:[{name:'Z suggestion',price:5},{name:'A suggestion',price:1}]}];const input=[a,rows[0],b,rows[1]],before=JSON.stringify(input);
 for(const mode of ['name','price','shop']){const sorted=ctx.sortWishlistItems(input,mode);assert.deepEqual(ids(sorted).slice(-2),['missing-z','missing-a']);assert.equal(sorted.at(-2),a);assert.deepEqual(a.shops[0].suggestions.map(s=>s.name),['Z suggestion','A suggestion']);}
 assert.deepEqual(ids(ctx.sortWishlistItems(input,'added')),ids(input));assert.equal(JSON.stringify(input),before);
});
