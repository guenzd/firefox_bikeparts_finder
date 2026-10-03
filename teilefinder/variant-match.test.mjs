import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/variant-match.js',import.meta.url),'utf8'),ctx);
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
 const helpers=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/extract.js',import.meta.url),'utf8'),helpers);
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
 const c=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/extract.js',import.meta.url),'utf8'),c);
 c.query="Peaty's Holeshot BioFibre";
 for(const brand of ['PEATYS','PEATY´S','Peaty’s',"Peaty's"]){c.name=brand+' Dichtmittel Holeshot Biofibre Tubeless Sealant | 1000 ml';assert.equal(vm.runInContext('matches(name,query)',c),true);}
 assert.equal(match({name:'PEATY´S Dichtmittel Holeshot Biofibre Tubeless Sealant | 1000 ml'},'1 L'),true);
});

test('Generic abbreviations, compound suggestions and typos need no product-specific dictionary',()=>{
 const c=vm.createContext({});vm.runInContext(readFileSync(new URL('./firefox-r2/extract.js',import.meta.url),'utf8')+readFileSync(new URL('./firefox-r2/suggestions.js',import.meta.url),'utf8'),c);
 assert.equal(c.matches('Acme Ultra Light Cable','Acme UL Cable'),true);
 assert.equal(c.matches('Acme UL Cable','Acme Ultra Light Cable'),true);
 assert.equal(c.matches('Acme Light Cable','Acme UL Cable'),false);
 const cards=[{name:'Acme Hydro Seal Fluid 24er',url:'https://shop.test/a'},{name:'Acme Original Fluid 24er',url:'https://shop.test/b'}];
 assert.equal(c.similarProducts(cards,'Acme Hydroseal 24er')[0].url,cards[0].url);
 assert.equal(c.matches(cards[0].name,'Acme Hydroseal 24er'),false);
 assert.equal(c.compoundTokenMatch('hydroseal',['hydro','seal']),true);
 assert.equal(c.compoundTokenMatch('hydroseal',['original','seal']),false);
});
