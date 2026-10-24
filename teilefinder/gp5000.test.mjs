import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('./firefox-r2/',import.meta.url);
const context=vm.createContext({URL});
vm.runInContext(readFileSync(new URL('extract.js',root),'utf8')+readFileSync(new URL('variant-match.js',root),'utf8'),context);
const search=JSON.parse(readFileSync(new URL('./fixtures/gp5000-search-results.json',import.meta.url)));
const schema=JSON.parse(readFileSync(new URL('./fixtures/gp5000-bc-schema.json',import.meta.url)));
const query='Continental Grand Prix 5000 S TR';
test('Live four-shop search fixtures contain all four requested product links',()=>{
 const expected=['p84853/','p1530145.html','continental-grand-prix-5000-s-tr-28-faltreifen','700-x-30C-BlackChili-VectranBreaker'];
 for(const [i,shop] of search.entries()){
  const offer=shop.offers.find(o=>new URL(o.url).pathname.endsWith(expected[i]));
  assert.ok(offer,shop.shop);
  assert.equal(context.matches('Continental '+offer.name,query),true,shop.shop);
 }
});
test('Model S/TR is distinct from AS, TT, base GP5000, and bundles',()=>{
 for(const name of ['Continental Grand Prix 5000 AS TR schwarz','Continental Grand Prix 5000 TT TR','Continental Grand Prix 5000 Set','Continental Grand Prix 5000 S TR 2er-Set','Continental Reifen Bundle Aero 111 + Grand Prix 5000 S TR'])assert.equal(context.matches(name,query),false,name);
});
test('Real bike-components ProductGroup preserves selected variant EAN, price and unavailable status',()=>{
 const rows=context.structuredOffers(schema,'www.bike-components.de','https://www.bike-components.de/',query);
 const matching=rows.filter(o=>context.variantMatches(o,'30 mm schwarz'));
 assert.equal(matching.length,1);
 assert.equal(matching[0].ean,'4019238054415');assert.equal(matching[0].price,54.99);assert.equal(matching[0].stock,'Ausverkauft');
 assert.ok(matching[0].url.includes('o=1000312746'));
 assert.equal(context.structuredOffers(schema,'www.bike-components.de','https://www.bike-components.de/','4019238054415').length,1);
});
test('Requested black 30 mm rejects transparent sidewalls and other widths',()=>{
 assert.equal(context.variantMatches({name:'700 x 30C',variant:'black'},'30 mm schwarz'),true);
 for(const variant of ['30-622 | schwarz/transparent','30 mm schwarz / transparent','schwarz-transparent | 30 mm','28 mm schwarz'])assert.equal(context.variantMatches({name:query,variant},'30 mm schwarz'),false,variant);
});
test('One discovered EAN fills all four confirmed variants, preserving other widths and stale offers',()=>{
 const offer={name:query,variant:'30 mm schwarz',priceKind:'exact',price:54.99};
 const shops=['A','B','C','D'].map((name,i)=>({name,offers:[{...offer,...(i===0?{ean:'4019238054415'}:{})}]}));
 shops[1].offers.push({...offer,variant:'28 mm schwarz'});
 shops.push({name:'old',stale:true,offers:[{...offer}]});
 const shared=context.shareVariantEAN(shops,'30 mm schwarz');
 assert.equal(shared.ean,'4019238054415');
 for(const shop of shared.shops.slice(0,4))assert.equal(shop.offers[0].ean,shared.ean);
 assert.equal(shared.shops[1].offers[1].ean,undefined);assert.equal(shared.shops[4].offers[0].ean,undefined);
 assert.equal(shops[1].offers[0].ean,undefined);
});
test('Conflicting variant identifiers never get copied to another shop',()=>{
 const offers=['4019238054415','4019238055610',undefined].map(ean=>({ean,name:query,variant:'30 mm schwarz',priceKind:'exact'}));
 const result=context.shareVariantEAN(offers.map(o=>({offers:[o]})),'30 mm schwarz');
 assert.equal(result.ean,'');assert.equal(result.shops[2].offers[0].ean,undefined);
});
test('BIKE24 linked detail and listing Aero 111 collapse to one product despite tracking and labels',()=>{
 const listing={name:'Continental Aero 111',variant:'Ausführung im Shop prüfen',url:'https://www.bike24.de/p1823456.html?origin=SRP',price:80,priceKind:'exact',stock:'Lagerstatus nicht auslesbar',source:'Firefox · Suchseite'};
 const detail={...listing,variant:'29-622 | schwarz',url:'https://www.bike24.de/p1823456.html',stock:'Auf Lager',ean:'4019238099999',source:'Firefox · ausgewählte Produktvariante'};
 const rows=context.uniqueOffers([listing,detail,{...detail,url:detail.url+'?utm_source=test'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].ean,detail.ean);assert.equal(rows[0].variant,detail.variant);assert.equal(rows[0].stock,'Auf Lager');
});
test('Different BIKE24 widths and native dropdown choices remain separate offers',()=>{
 const url='https://www.bike24.de/p1823456.html';
 const rows=context.uniqueOffers([{url,selection:[{id:'length',value:'short'}]},{url,selection:[{id:'length',value:'long'}]},{url:'https://www.bike24.de/p1823457.html'}]);
 assert.equal(rows.length,3);
});
test('Live Aero 111 schema with separate brand confirms only 29 mm and its EAN',()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/aero111-bc-schema.json',import.meta.url)));
 const rows=context.structuredOffers([data],'www.bike-components.de','https://www.bike-components.de/','Continental Aero 111').filter(o=>context.variantMatches(o,'29 mm'));
 assert.equal(rows.length,1);assert.equal(rows[0].ean,'4019238283907');assert.equal(rows[0].price,71.99);assert.equal(rows[0].stock,'Auf Lager');assert.ok(rows[0].url.includes('o=1000472573'));
});
test('Real Aero 111 detail message confirms 29 mm before the product UI has mounted',async()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/aero111-bc-schema.json',import.meta.url)));
 let listener;
 const document={body:{innerText:''},querySelector:()=>null,querySelectorAll(selector){return selector==='script[type="application/ld+json"]'?[{textContent:JSON.stringify(data)}]:[];}};
 const url='https://www.bike-components.de/de/Continental/Aero-111-Tubeless-Ready-28-Faltreifen-p172556/?v=46026-schwarz';
 const c=vm.createContext({document,location:{href:url,hostname:'www.bike-components.de'},URL,browser:{runtime:{onMessage:{addListener(fn){listener=fn;}}}}});
 for(const file of ['variant-match.js','extract.js','shop.js'])vm.runInContext(readFileSync(new URL(file,root),'utf8'),c);
 const result=await listener({type:'detail',shopId:'bike-components',host:'www.bike-components.de',query:'Continental Aero 111',variant:'29 mm',url,fallback:{name:'Continental Aero 111 Tubeless Ready 28" Faltreifen',variant:'Ausführung im Shop prüfen',price:71.99,priceKind:'from',url}});
 assert.equal(result.ready,true);assert.equal(result.offers.length,1);assert.equal(result.offers[0].ean,'4019238283907');assert.equal(result.offers[0].priceKind,'exact');
});
test('Product UI that is still loading must not finalize an unconfirmed listing as ready',async()=>{
 let listener;const url='https://www.bike-components.de/de/Continental/Aero-111-Tubeless-Ready-28-Faltreifen-p172556/';
 const document={body:{innerText:''},querySelector:()=>null,querySelectorAll:()=>[]};
 const c=vm.createContext({document,location:{href:url,hostname:'www.bike-components.de'},URL,browser:{runtime:{onMessage:{addListener(fn){listener=fn;}}}}});
 for(const file of ['variant-match.js','extract.js','shop.js'])vm.runInContext(readFileSync(new URL(file,root),'utf8'),c);
 const result=await listener({type:'detail',shopId:'bike-components',host:'www.bike-components.de',query:'Continental Aero 111',variant:'29 mm',url,fallback:{name:'Continental Aero 111',variant:'Ausführung im Shop prüfen',url}});
 assert.equal(result.ready,false);assert.equal(result.offers.length,0);
});
test('BIKE24 datasheet GTIN is read without opening tabs or triggering controls',()=>{
 const label={textContent:'GTIN:',nextElementSibling:{textContent:'4019238283907'}};
 const c=vm.createContext({document:{querySelector:()=>null,querySelectorAll:()=>[label]}});
 vm.runInContext(readFileSync(new URL('extract.js',root),'utf8'),c);
 assert.equal(c.currentProductEAN(),'4019238283907');
 label.nextElementSibling.textContent='4019238283907, 4019238283921';assert.equal(c.currentProductEAN(),'');
});
test('r2-bike reads description EAN even in collapsed text and ignores unrelated recommendations',()=>{
 const c=vm.createContext({document:{querySelector:s=>s==='#tab-description'?{textContent:'Inhalt: 1000 ml\nEAN: 5060541584983'}:{textContent:'9999999999999',getAttribute:()=>null},querySelectorAll:()=>[]}});
 vm.runInContext(readFileSync(new URL('extract.js',root),'utf8'),c);assert.equal(c.currentProductEAN(),'5060541584983');
});
test('r2-bike opens only its read-more control if the description EAN loads afterwards',async()=>{
 let text='Beschreibung',clicked=0;
 const toggle={textContent:'mehr lesen weniger Lesen',querySelector:()=>({textContent:'mehr lesen'}),getClientRects:()=>[{}],getAttribute:()=>null,click(){clicked++;text='EAN: 5060541584983';}};
 const description={get textContent(){return text;},querySelectorAll:()=>[toggle]};
 const c=vm.createContext({document:{querySelector:s=>s==='#tab-description'?description:null,querySelectorAll:()=>[]},setTimeout:f=>setImmediate(f)});
 vm.runInContext(readFileSync(new URL('extract.js',root),'utf8'),c);assert.equal(await c.r2DescriptionEAN(),'5060541584983');assert.equal(clicked,1);assert.equal(await c.r2DescriptionEAN(),'5060541584983');assert.equal(clicked,1);
});
test('Different product terms are not silently rewritten into exact matches',()=>{
 assert.equal(context.matches('Powerbar Powergel Hydro 24er Box','Powerbar Hydrogel 24er'),false);
 assert.equal(context.matches('Powerbar Powergel Hydro 67ml','Powerbar Hydrogel 24er'),false);
 assert.equal(context.matches('Powerbar Powergel Original 24er Box','Powerbar Hydrogel 24er'),false);
});


test('Generic pack-count matching accepts attached quantities without confusing other sizes or models',()=>{
 const query='Dextro Energy Kohlenhydrat-Riegel Energy Bar 24';
 assert.equal(context.matches('DEXTRO ENERGY* Bar - Kohlenhydrat-Riegel - 24x50g',query),true);
 assert.equal(context.matches('DEXTRO ENERGY* Bar - Kohlenhydrat-Riegel - 24 × 50 g',query),true);
 for(const size of ['50g','25x50g','124x50g'])assert.equal(context.matches('DEXTRO ENERGY* Bar - Kohlenhydrat-Riegel - '+size,query),false);
 assert.equal(context.matches('Example Drink 12x60ml','Example Drink 12'),true);
 assert.equal(context.matches('Example Drink 12x60ml','Example Drink 60'),false);
 assert.equal(context.matches('Example Part M24','Example Part 24'),false);
 assert.equal(context.matches('Other Brand Bar 24x50g',query),false);
});


test('r2-bike delayed delivery text is read without confusing shipping promises with stock',()=>{
 for(const label of ['in ca. 1 - 2 Wochen','in ca. 2–4 Wochen','Lieferzeit: 1-2 Wochen','lieferbar in 1 Woche'])assert.equal(context.stockText(label),label);
 assert.equal(context.stockText('in ca. 1 - 2 Wochen. Andere Artikel ab Lager verfügbar'),'in ca. 1 - 2 Wochen');
 assert.equal(context.stockText('in 3 - 5 Tagen'),'in 3 - 5 Tagen');
 assert.equal(context.stockText('ab Lager verfügbar'),'ab Lager verfügbar');
});


test('Future availability dates retain day, month and optional year instead of truncating at the first period',()=>{
 for(const label of ['verfügbar ab 4.11.','Verfügbar ab 04.11.2026','lieferbar ab 4. 11.','erhältlich ab dem 04.11.2026','verfügbar\u00a0ab\u00a04.11.'])assert.equal(context.stockText(label+' · weitere Angaben'),label);
 assert.equal(context.stockText('Nicht verfügbar ab 4.11.'),'Nicht verfügbar');
});


test('Bike-Discount restock notice means unavailable and ignores notices outside the product buy area',()=>{
 const notice='Benachrichtigen Sie mich, sobald der Artikel lieferbar ist.';
 const nodes={'.product-detail-buy':{innerText:notice}};
 const c=vm.createContext({document:{body:{innerText:notice},querySelector:s=>nodes[s]||null}});
 vm.runInContext(readFileSync(new URL('extract.js',root),'utf8'),c);
 assert.equal(c.bikeDiscountStock(),'Nicht lieferbar');
 nodes['.product-detail-buy'].innerText='';nodes['.nele-product-availability-info']={innerText:'Lagernd, Lieferzeit 1-3 Tage'};
 assert.equal(c.bikeDiscountStock(),'Lagernd, Lieferzeit 1-3 Tage');
 delete nodes['.nele-product-availability-info'];assert.equal(c.bikeDiscountStock(),'Lagerstatus nicht auslesbar');
 assert.equal(c.stockText('Benachrichtigen Sie mich,\n sobald der Artikel lieferbar ist.'),'Nicht lieferbar');
});
