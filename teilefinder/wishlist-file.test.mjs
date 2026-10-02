import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';
const ctx=vm.createContext({crypto:webcrypto});vm.runInContext(readFileSync(new URL('./firefox-r2/wishlist-file.js',import.meta.url),'utf8'),ctx);
test('Wishlist file round trip retains query, variant, cap and cart markers without stale offers',()=>{
 ctx.items=[{query:'Continental Aero 111',variant:'29 mm',maxPrice:80,shops:[{offers:[{price:1}]}],cart:{key:'bike-components|url|29mm',clicked:true}}];
 const rows=vm.runInContext('parseWishlistFile(wishlistFile(items))',ctx);
 assert.equal(rows[0].query,'Continental Aero 111');assert.equal(rows[0].variant,'29 mm');assert.equal(rows[0].maxPrice,80);assert.equal(rows[0].cart.clicked,true);assert.equal(rows[0].shops.length,0);assert.equal(rows[0].checkedAt,null);
});
test('Import merges without losing existing items or duplicating repeats',()=>{
 ctx.existing=[{id:'kept',query:'Chain',variant:'116',maxPrice:null}];ctx.incoming=[{query:'chain',variant:'116',maxPrice:null},{query:'Tyre',variant:'29mm',maxPrice:90}];
 const rows=vm.runInContext('mergeWishlistFile(existing,incoming)',ctx);assert.equal(rows.length,2);assert.equal(rows[0].id,'kept');
});
test('Invalid format, excessive size and invalid prices fail before modifying the list',()=>{
 for(const data of [{format:'other',version:1,items:[]},{format:'teilefinder-wishlist',version:1,items:[{query:'Tyre',variant:'29mm',maxPrice:-1}]},{format:'teilefinder-wishlist',version:1,items:[{query:'',variant:'',maxPrice:null}]}]){ctx.text=JSON.stringify(data);assert.throws(()=>vm.runInContext('parseWishlistFile(text)',ctx));}
 ctx.text=' '.repeat(2_000_001);assert.throws(()=>vm.runInContext('parseWishlistFile(text)',ctx));
});
