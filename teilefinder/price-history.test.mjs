import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});
vm.runInContext(readFileSync(new URL('./firefox-r2/price-history.js',import.meta.url),'utf8'),ctx);
const observations=prices=>prices.map((price,index)=>({key:String(index),at:new Date(Date.UTC(2026,9,12+index)).toISOString(),offers:[{price,shop:'Shop A'},{price:price+10,shop:'Shop B'}]}));
const keys=rows=>Array.from(ctx.priceHistoryPoints(rows),point=>point.row.key);
test('Price history keeps only the first and last point of each consecutive equal-price run',()=>{
 const rows=observations([30.78,30.78,30.78,30.78,30.78,44.99,44.99,44.99]);
 assert.deepEqual(keys(rows),['0','4','5','7']);
 assert.equal(rows.length,8);assert.equal(rows[2].offers.length,2);
});
test('Price history preserves empty, single and two-point runs and every actual price change',()=>{
 assert.deepEqual(keys([]),[]);
 assert.deepEqual(keys(observations([10])),['0']);
 assert.deepEqual(keys(observations([10,10])),['0','1']);
 assert.deepEqual(keys(observations([10,10,10,10])),['0','3']);
 assert.deepEqual(keys(observations([10,20,10,20,20,10])),['0','1','2','3','4','5']);
});
test('Compression sorts chronologically and retains endpoints inside the selected date range',()=>{
 const rows=observations([10,10,10,10,10]);
 assert.deepEqual(keys(rows.slice(1,4).reverse()),['1','3']);
 assert.deepEqual(rows.map(row=>row.key),['0','1','2','3','4']);
});
