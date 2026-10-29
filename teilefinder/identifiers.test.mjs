import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readSource} from './test-sources.mjs';
const ctx=vm.createContext({URL});vm.runInContext(readSource('variant-match.js')+readSource('extract.js'),ctx);

test('GTIN comparison accepts equivalent UPC/EAN padding without changing inputs or packaging identity',()=>{
 const upc='810093163519',ean='0810093163519',gtin='00810093163519';
 for(const a of [upc,ean,gtin])for(const b of [upc,ean,gtin])assert.equal(ctx.equivalentEANs(a,b),true);
 assert.equal(ctx.validEAN(upc),upc);assert.equal(ctx.validEAN(ean),ean);
 for(const other of ['1810093163519','10810093163519','810093163518','',null])assert.equal(ctx.equivalentEANs(upc,other),false);
 assert.equal(ctx.equivalentEANs('12345670','00000012345670'),true);
 assert.equal(ctx.equivalentEANs('123456789','00000123456789'),false);
 assert.deepEqual(Array.from(ctx.distinctEANs([ean,upc,gtin,'10810093163519'])),[ean,'10810093163519']);
 assert.equal(ctx.alternateEAN(upc),ean);assert.equal(ctx.alternateEAN(ean),upc);assert.equal(ctx.alternateEAN(gtin),ean);
 assert.equal(ctx.alternateEAN('10810093163519'),'');
});

test('Description EAN plus equivalent UPC identifies one product; genuinely different identifiers remain ambiguous',()=>{
 let text='EAN: 0810093163519\nUPC: 810093163519';
 const c=vm.createContext({URL,location:{hostname:'www.bike-discount.de'},document:{querySelector:selector=>selector==='#description-tab-pane'?{textContent:text}:null,querySelectorAll:()=>[]}});
 vm.runInContext(readSource('extract.js'),c);assert.equal(c.currentProductEAN(),'0810093163519');
 text+='\nEAN: 1810093163519';assert.equal(c.currentProductEAN(),'');
});

test('Structured data, sharing and conflicting-EAN filters agree on UPC/EAN equivalence',()=>{
 const rows=ctx.structuredOffers([{'@type':'Product',name:'Example wax',gtin13:'0810093163519',offers:{price:'26.99',priceCurrency:'EUR'}}],'bike-discount.de','https://www.bike-discount.de/de/wax','810093163519');assert.equal(rows.length,1);
 const shops=[{name:'A',offers:[{...rows[0],ean:'810093163519'}]},{name:'B',offers:[rows[0]]}];
 assert.equal(ctx.shareVariantEAN(shops,'','810093163519').ean,'810093163519');assert.equal(ctx.shareVariantEAN(shops,'').ean,'810093163519');
 const filtered=ctx.filterConflictingEANs([{offers:[...rows,{...rows[0],ean:'10810093163519'}]}],'810093163519');assert.equal(filtered[0].offers.length,1);
});

test('All equivalent forms remain available for legacy product caches and price histories',()=>{
 assert.deepEqual(Array.from(ctx.eanRepresentations('810093163519')),['810093163519','00810093163519','0810093163519']);
 assert.deepEqual(Array.from(ctx.eanRepresentations('10810093163519')),['10810093163519']);
 assert.deepEqual(Array.from(ctx.eanRepresentations('bad')),[]);
});

test('Price history reads equivalent legacy keys without rewriting existing records',async()=>{
 const requested=[];
 const records=[{key:'old',ean:'810093163519',at:'2026-10-28T12:00:00Z',offers:[]},{key:'new',ean:'0810093163519',at:'2026-10-29T12:00:00Z',offers:[]}];
 const store={index(){return {getAll(ean){requested.push(ean);const request={result:records.filter(row=>row.ean===ean)};setImmediate(()=>request.onsuccess());return request;}};}};
 const indexedDB={open(){const request={result:{transaction(){return {objectStore:()=>store};}}};setImmediate(()=>request.onsuccess());return request;}};
 const c=vm.createContext({indexedDB});vm.runInContext(readSource('identifiers.js')+readSource('price-history.js'),c);
 const {readFileSync}=await import('node:fs');vm.runInContext(readFileSync(new URL('./src/data/price-history-store.js',import.meta.url),'utf8')+'\nglobalThis.db=priceHistoryDB;',c);
 const rows=await c.db.all('810093163519');assert.equal(rows.length,2);assert.equal(rows[0].ean,'810093163519');assert.equal(rows[1].ean,'0810093163519');assert.ok(requested.includes('0810093163519'));assert.equal(records[0].ean,'810093163519');
});

test('Equivalent shop identifiers form one price observation instead of different prices at the same instant',()=>{
 const c=vm.createContext({URL});vm.runInContext(readSource('variant-match.js')+readSource('price-history.js'),c);
 const shops=['810093163519','0810093163519'].map((ean,index)=>({name:'Shop '+index,done:true,offers:[{ean,price:20+index,priceKind:'exact',stock:'Auf Lager',url:'https://www.bike24.de/p1.html'}]}));
 const rows=c.priceObservations(shops,'job','2026-10-29T12:00:00Z');assert.equal(rows.length,1);assert.equal(rows[0].offers.length,2);assert.equal(rows[0].offers[0].price,20);
});

test('Fixed product volume is read only from labelled description facts, including collapsed headings',()=>{
 let headings=[{textContent:'Inhalt',nextElementSibling:{textContent:'100 ml'}}];
 const root={textContent:'Discount 5,99 € / 1 l. Recommended other product 500 ml.',querySelectorAll:selector=>selector==='tr'?[]:headings};
 const c=vm.createContext({document:{querySelector:()=>root}});vm.runInContext(readSource('variant-match.js')+readSource('extract.js'),c);
 assert.equal(c.fixedProductProperties(),'inhalt: 100 ml');assert.equal(c.variantMatches({variant:c.fixedProductProperties()},'100 ml'),true);assert.equal(c.variantMatches({variant:c.fixedProductProperties()},'500 ml'),false);
 headings=[{textContent:'Anwendung',nextElementSibling:{textContent:'100 ml'}},{textContent:'Inhalt',nextElementSibling:{textContent:'100 ml oder 500 ml'}}];assert.equal(c.fixedProductProperties(),'');
 headings=[{textContent:'Inhalt',nextElementSibling:{textContent:'100 ml'}},{textContent:'Inhalt',nextElementSibling:{textContent:'500 ml'}}];assert.equal(c.fixedProductProperties(),'');
});
