import {readSource} from './test-sources.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});vm.runInContext(readSource('variant-match.js'),ctx);
const match=(offer,requested)=>{ctx.offer=offer;ctx.requested=requested;return vm.runInContext('variantMatches(offer,requested)',ctx);};
test('Width matches separate product names and selected dropdown variants',()=>{
 assert.equal(match({name:'Continental GP 5000 700x30C',variant:'Ausführung im Shop prüfen'},'30 mm'),true);
 assert.equal(match({name:'Continental GP 5000',variant:'schwarz | 30mm'},'30 mm'),true);
 assert.equal(match({name:'Continental GP 5000 30-622'},'30mm'),true);
 assert.equal(match({name:'Continental GP 5000',variant:'Breite: 30,0 mm'},'30 mm'),true);
});
test('Rejects other widths and prices and prioritizes selected width',()=>{
 assert.equal(match({name:'Reifen 130 mm'},'30 mm'),false);
 assert.equal(match({name:'Reifen 30,5 mm'},'30 mm'),false);
 assert.equal(match({name:'Reifen 28 mm 30,00 €'},'30 mm'),false);
 assert.equal(match({name:'Reifen 30 mm',variant:'Breite: 28 mm'},'30 mm'),false);
 assert.equal(match({name:'Flasche 30 ml'},'30 mm'),false);
});
test('Color and capacity can be combined and empty variant accepts all',()=>{
 assert.equal(match({name:'Flasche',variant:'silber | 750 ml'},'silber 750ml'),true);
 assert.equal(match({name:'Flasche',variant:'silber | 500 ml'},'silber 750ml'),false);
 assert.equal(match({name:'Reifen 28mm'},''),true);
});

test('Aero 111 base name stays separate from a duplicated requested width',()=>{
 ctx.query='Continental Aero-111 29 mm';ctx.variant='29mm';
 assert.equal(vm.runInContext('productSearchQuery(query,variant)',ctx),'Continental Aero-111');
 assert.equal(match({name:'Continental Aero 111 Tubeless Ready 28" Faltreifen',variant:'schwarz | 29 mm | 29-622 | 28 "'},'29 mm'),true);
 assert.equal(match({name:'Continental Aero 111 Tubeless Ready 28" Faltreifen',variant:'schwarz | 26 mm | 26-622 | 28 "'},'29 mm'),false);
 vm.runInContext("query='Continental Aero 111';variant='29 mm'",ctx);
 assert.equal(vm.runInContext('productSearchQuery(query,variant)',ctx),'Continental Aero 111');
});
test('Product matching accepts model name separators',()=>{
 const helpers=vm.createContext({});vm.runInContext(readSource('extract.js'),helpers);
 assert.equal(vm.runInContext('matches(\'Continental Aero 111 Tubeless Ready 28" Faltreifen\',\'Continental Aero-111\')',helpers),true);
 assert.equal(vm.runInContext('matches(\'DT Swiss ARC 1100\',\'Continental Aero-111\')',helpers),false);
});

test('Sealant volumes match liters and milliliters while rejecting other capacities',()=>{
 assert.equal(match({name:"Peaty's Holeshot BioFibre 1L"},'1000 ml'),true);
 assert.equal(match({name:"Peaty's Holeshot BioFibre",variant:'1000 ml'},'1 L'),true);
 assert.equal(match({name:"Peaty's Holeshot BioFibre",variant:'500 ml'},'0,5 Liter'),true);
 assert.equal(match({name:"Peaty's Holeshot BioFibre 1L",variant:'500 ml'},'1 L'),false);
 assert.equal(match({name:"Peaty's Holeshot BioFibre 5L"},'1 L'),false);
 assert.equal(match({name:"Peaty's Holeshot BioFibre 120ml"},'1L'),false);
});

test('Peatys brand apostrophes normalize identically in all extraction paths',()=>{
 const c=vm.createContext({});vm.runInContext(readSource('extract.js'),c);
 c.query="Peaty's Holeshot BioFibre";
 for(const brand of ['PEATYS','PEATY´S','Peaty’s',"Peaty's"]){c.name=brand+' Dichtmittel Holeshot Biofibre Tubeless Sealant | 1000 ml';assert.equal(vm.runInContext('matches(name,query)',c),true);}
 assert.equal(match({name:'PEATY´S Dichtmittel Holeshot Biofibre Tubeless Sealant | 1000 ml'},'1 L'),true);
});

test('Generic abbreviations, compound suggestions and typos need no product-specific dictionary',()=>{
 const c=vm.createContext({});vm.runInContext(readSource('extract.js')+readSource('suggestions.js'),c);
 assert.equal(c.matches('Acme Ultra Light Cable','Acme UL Cable'),true);
 assert.equal(c.matches('Acme UL Cable','Acme Ultra Light Cable'),true);
 assert.equal(c.matches('Acme Light Cable','Acme UL Cable'),false);
 const cards=[{name:'Acme Hydro Seal Fluid 24er',url:'https://shop.test/a'},{name:'Acme Original Fluid 24er',url:'https://shop.test/b'}];
 assert.equal(c.similarProducts(cards,'Acme Hydroseal 24er')[0].url,cards[0].url);
 assert.equal(c.matches(cards[0].name,'Acme Hydroseal 24er'),false);
 assert.equal(c.compoundTokenMatch('hydroseal',['hydro','seal']),true);
 assert.equal(c.compoundTokenMatch('hydroseal',['original','seal']),false);
});

test('Pack variants accept spacing, multiplication signs and comma-separated flavour',()=>{
 for(const variant of ['25 x 50 g | Vanille','25×50g, Vanille','25x50g - Vanille']){
  assert.equal(match({name:'Energy food',variant},'25x50g, vanille'),true);
 }
 assert.equal(match({name:'Energy food',variant:'12 x 50 g | Vanille'},'25x50g, vanille'),false);
 assert.equal(match({name:'Energy food',variant:'25 x 40 g | Vanille'},'25x50g, vanille'),false);
 assert.equal(match({name:'Energy food',variant:'25 x 50 g | Schokolade'},'25x50g, vanille'),false);
 assert.equal(match({name:'Tyre',variant:'Breite: 30,5 mm | Schwarz'},'30,5 mm, schwarz'),true);
 assert.equal(match({name:'Tyre',variant:'Breite: 30 mm | Schwarz'},'30,5 mm, schwarz'),false);
});

test('Long variant words allow one generic edit while numeric identifiers stay exact',()=>{
 assert.equal(match({name:'Energy bar',variant:'24x50g | vanilla'},'24x50g, vanille'),true);
 assert.equal(match({name:'Energy bar',variant:'24x50g | vanille'},'24x50g, vanilla'),true);
 assert.equal(match({name:'Part',variant:'matte black'},'matte blak'),false);
 assert.equal(match({name:'Part',variant:'graphite'},'graphit'),true);
 assert.equal(match({name:'Part',variant:'medium'},'medim'),true);
 assert.equal(match({name:'Energy bar',variant:'24x50g | chocolate'},'24x50g, vanille'),false);
 assert.equal(match({name:'Energy bar',variant:'25x50g | vanilla'},'24x50g, vanille'),false);
 assert.equal(match({name:'Part',variant:'30mm'},'31mm'),false);
 assert.equal(match({name:'Part',variant:'ABC123'},'ABC124'),false);
 assert.equal(match({name:'Part',variant:'Cola'},'Colo'),false);
 assert.equal(match({name:'Part',variant:'vanilla'},'vanilxx'),false);
});

test('Saved URLs drop referral metadata while retaining variant IDs and search queries',()=>{
 const clean=vm.createContext({URL});vm.runInContext(readSource('variant-match.js'),clean);
 const original={shops:[{url:'https://r2-bike.com/suchergebnisse#search?query=8055136020431',offers:[{url:'https://www.bike-components.de/product/?o=123-black&v=456&origin=SRP&utm_source=email&referrer=search&ref=affiliate&gclid=abc'}]}]};
 const saved=clean.cleanSavedUrls(original);
 assert.equal(saved.shops[0].url,original.shops[0].url);
 assert.equal(saved.shops[0].offers[0].url,'https://www.bike-components.de/product/?o=123-black&v=456');
 assert.match(original.shops[0].offers[0].url,/origin=SRP/);
 assert.equal(clean.cleanShopUrl('https://www.bike-discount.de/de/search?search=763477000385&REF=mail'),'https://www.bike-discount.de/de/search?search=763477000385');
});

test('Bare numeric variants match titles and selected values, while selected alternatives and prices stay strict',()=>{
 assert.equal(match({name:'Acme chain 116 links',variant:'silver'},'116'),true);
 assert.equal(match({name:'Acme chain CN-M9100',variant:'116 Glieder · silber'},'116'),true);
 assert.equal(match({name:'Acme chain 116 links',variant:'126 Glieder · silber'},'116'),false);
 assert.equal(match({name:'Acme chain ABC116',variant:'silver'},'116'),false);
 assert.equal(match({name:'Acme chain',variant:'silver · 116,00 €'},'116'),false);
 assert.equal(match({name:'Acme chain',variant:'EAN: 1234567890116'},'116'),false);
});

test('Exact model identifiers bridge shop series names without a product dictionary or loose numeric matching',()=>{
 const c=vm.createContext({});vm.runInContext(readSource('extract.js')+readSource('suggestions.js'),c);
 const query='Shimano Kette Dura Ace 12 fach CN-M9100';
 for(const name of ['Shimano XTR CN-M9100 Kette 12-fach - mit Quick Link - silver','Shimano XTR CN-M9100 12-fach Kette mit Quick-Link'])assert.equal(c.matches(name,query),true);
 for(const name of ['Shimano XTR CN-M8100 Kette 12-fach','Shimano XTR CN-M91000 Kette 12-fach','Other XTR CN-M9100 Kette 12-fach','Shimano Kettenschloss für CN-M9100 Kette 12-fach','Shimano Verschleißset CN-M9100 Kette 12-fach'])assert.equal(c.matches(name,query),false,name);
 assert.equal(c.matches('Acme Touring BC-2400 Cable Kit','Acme Cable Racing BC-2400'),true);
 assert.equal(c.matches('Acme BC-24000 Cable','Acme Racing Cable BC-2400'),false);
 assert.equal(c.broaderQuery(query),'Shimano CN-M9100');assert.equal(c.broaderQuery('Shimano CN-M9100'),null);
});

test('EAN discovery intersects shop identifiers without choosing an arbitrary execution',()=>{
 const good='8057628581253',other='8057628583325';
 const offer=ean=>({ean,name:'Example chain',variant:'',priceKind:'exact'});
 const shops=[{offers:[offer(good)]},{offers:[offer(good),offer(other)]}];
 assert.equal(ctx.shareVariantEAN(shops,'').ean,good);
 assert.equal(ctx.shareVariantEAN([{offers:[offer(good)]},{offers:[offer(other)]}],'').ean,'');
 assert.equal(ctx.shareVariantEAN([{offers:[offer(good),offer(other)]}],'').ean,'');
 assert.equal(ctx.shareVariantEAN(shops,'',other).ean,other);
 const filtered=ctx.filterConflictingEANs(shops,good);assert.equal(filtered[1].offers.length,1);assert.equal(filtered[1].offers[0].ean,good);assert.equal(shops[1].offers.length,2);
 assert.equal(ctx.filterConflictingEANs(shops,'')[1].offers.length,2);
});
