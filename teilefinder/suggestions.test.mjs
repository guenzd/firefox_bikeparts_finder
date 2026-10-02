import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/suggestions.js',import.meta.url),'utf8'),ctx);
const rank=(cards,q)=>{ctx.cards=cards;ctx.q=q;return vm.runInContext('similarProducts(cards,q)',ctx);};
test('Suggests similar model spellings, ranks relevant products, excludes unrelated matches',()=>{
 const rows=rank([{name:'Shimano XT CN-M8100 Kette',url:'https://shop/chain',price:27.99},{name:'Shimano Bremsscheibe',url:'https://shop/brake',price:20},{name:'Schwalbe Reifen',url:'https://shop/tyre',price:25}],'Shimano CM-M8100');assert.equal(rows.length,1);assert.equal(rows[0].name,'Shimano XT CN-M8100 Kette');
});
test('EAN searches never substitute approximate identifiers; suggestion names omit prices',()=>{
 assert.equal(rank([{name:'Shimano CN-M8100',url:'https://shop/chain'}],'1234567890123').length,0);
 const rows=rank([{name:'SHIMANO\nDeore XT CN-M8100 Kette\n46,95 € UVP ab 28,49 €',url:'https://shop/chain'}],'CN-M8100');assert.equal(rows[0].name,'SHIMANO Deore XT CN-M8100 Kette');
 assert.equal(vm.runInContext("broaderQuery('Shimano CN-M8100 126 Glieder')",ctx),'Shimano CN-M8100');
});
