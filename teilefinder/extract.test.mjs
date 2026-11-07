import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readSource} from './test-sources.mjs';
const context=vm.createContext({URL});vm.runInContext(readSource('extract.js'),context);
const {euro,stockText,structuredOffers,safeUrl}=context;

test('Shared price parser handles EUR formatting and rejects missing or negative amounts',()=>{
 assert.equal(euro('1.249,99'),1249.99);assert.equal(euro('27.99'),27.99);assert.equal(euro(''),null);assert.equal(euro(-1),null);
});
test('Shared availability parser keeps missing, negative and future stock distinct from available stock',()=>{
 assert.equal(stockText('Nicht lieferbar'),'Nicht lieferbar');assert.equal(stockText('Lagernd, Lieferzeit 1-3 Tage'),'Lagernd, Lieferzeit 1-3 Tage');assert.equal(stockText('Verfügbar in 2-4 Wochen'),'in 2-4 Wochen');assert.equal(stockText('In den Warenkorb'),'Lagerstatus nicht auslesbar');
});
test('Shared schema parser distinguishes exact and starting prices, rejects other models and unsafe URLs',()=>{
 const rows=structuredOffers([
  {'@type':'Product',name:'Example AD-120',offers:{'@type':'AggregateOffer',lowPrice:'27.99',priceCurrency:'EUR',url:'https://r2-bike.com/adapter'}},
  {'@type':'Product',name:'Example AD-121',offers:{price:10,priceCurrency:'EUR',url:'https://r2-bike.com/other'}},
  {'@type':'Product',name:'Example AD-120',offers:{price:20,priceCurrency:'EUR',url:'https://r2-bike.com/exact'}}
 ],'r2-bike.com','https://r2-bike.com/search','AD-120');
 assert.equal(rows.length,2);assert.equal(rows[0].price,27.99);assert.equal(rows[0].priceKind,'from');assert.equal(rows[0].stock,'Lagerstatus nicht auslesbar');assert.equal(rows[1].priceKind,'exact');
 assert.equal(safeUrl('https://evil.example/product','r2-bike.com'),null);assert.equal(safeUrl('javascript:alert(1)','r2-bike.com'),null);
});
