import {readSource} from './test-sources.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});
vm.runInContext(readSource('price-history.js'),ctx);
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
test('Daily history removes higher prices and simultaneous spikes without changing stored observations',()=>{
 const rows=observations([54.50,54.99,54.50,54.99,54.50]);
 rows[1].at='2026-10-13T10:00:00Z';
 rows[2].at='2026-10-13T10:00:00Z';
 rows[3].at='2026-10-13T10:05:00Z';
 const original=JSON.stringify(rows);
 assert.deepEqual(keys(rows.slice().reverse()),['0','4']);
 assert.equal(JSON.stringify(rows),original);
 const higherLast=rows.slice(0,4);
 assert.deepEqual(keys(higherLast),['0','2']);
 assert.equal(higherLast.at(-1).offers[0].price,54.99);
});
test('Daily history retains genuine increases on later days and uses the latest equal minimum',()=>{
 const rows=observations([10,10,20]);rows[1].at=rows[0].at;
 assert.deepEqual(keys(rows),['0','2']);
 rows[1].at=new Date(Date.parse(rows[0].at)+60000).toISOString();
 assert.deepEqual(keys(rows),['1','2']);
});

test('Product datasheet EAN matches do not become variant-specific price observations',()=>{
 const vmContext=vm.createContext({URL});
 for(const file of ['variant-match.js','wishlist.js','price-history.js'])vm.runInContext(readSource(file),vmContext);
 const shops=[{name:'BIKE24',done:true,offers:[{ean:'4524667879565',eanEvidence:'datasheet',price:39.99,priceKind:'exact',stock:'Auf Lager',url:'https://www.bike24.de/p1271583.html'}]}];
 assert.equal(vmContext.priceObservations(shops,'one','2026-10-24T12:00:00Z').length,0);
});
