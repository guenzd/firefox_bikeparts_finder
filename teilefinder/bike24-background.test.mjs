import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readSource} from './test-sources.mjs';

function fixture({rendered=false,hidden=true}={}){
 const props={productId:123,deliveryLocationCountry:4,productName:'Generic fixed product',ean:'1234567890128',productOptionList:[],productDetailPrice:{grossPrice:54.9899,currencyCode:'EUR',hasStartingPrice:false},productVariantList:{currentVariantId:123,variantList:[{id:123,variant:'30 mm',url:'https://www.bike24.de/p1000123.html'}]}};
 let payload={availabilityMapping:{123:123},availabilityVariantsList:{123:{id:123,availability:{message:'Aktuell 10+ auf Lager'},shipping:{isShippable:true}}}};
 const requests=[],cart={getAttribute:()=>JSON.stringify(props),querySelector:()=>rendered?{}:null};
 const document={hidden,readyState:'complete',body:{innerText:''},querySelectorAll:()=>[],querySelector(selector){
  if(selector==='#add-to-cart')return cart;
  if(selector==='h1')return {innerText:props.productName};
  if(rendered&&selector.includes('price__value'))return {innerText:'27,99 €'};
  if(rendered&&selector.includes('product-availability'))return {innerText:'Auf Lager'};
  return null;
 }};
 const ctx=vm.createContext({document,URL,AbortController,setTimeout,clearTimeout,location:{hostname:'www.bike24.de',origin:'https://www.bike24.de',href:'https://www.bike24.de/p1000123.html'},platform:{browserFamily:'chromium',runtime:{onMessage:{addListener(){}}}},async fetch(url,options){requests.push({url,options});return {ok:true,async json(){return payload;}};}});
 for(const name of ['extract.js','variants.js','shop.js'])vm.runInContext(readSource(name),ctx);
 return {ctx,props,requests,setPayload(value){payload=value;}};
}

test('BIKE24 fixed products in unrendered background tabs use fresh page prices and mapped live availability',async()=>{
 const {ctx,props,requests}=fixture();
 const result=await ctx.bike24Details({name:'Old name',variant:'Old variant',price:999,stock:'Nicht lieferbar',ean:'9999999999999'},false,'30 mm');
 assert.equal(result.ready,true);assert.equal(result.offers.length,1);
 const offer=result.offers[0];assert.equal(offer.name,props.productName);assert.equal(offer.variant,'30 mm');assert.equal(offer.price,54.99);assert.equal(offer.priceKind,'exact');assert.equal(offer.stock,'auf Lager');assert.equal(offer.ean,props.ean);
 assert.equal(requests.length,1);assert.equal(requests[0].url,'https://www.bike24.de/api/product/123/availability?deliveryCountryId=4');assert.equal(requests[0].options.cache,'no-store');assert.equal(requests[0].options.credentials,'same-origin');assert.equal(requests[0].options.signal.aborted,false);
 assert.equal(offer.selection,undefined,'No simulated dropdown selection or cart action');
});

test('Already rendered BIKE24 widgets keep the DOM path in foreground and background without extra HTTP requests',async()=>{
 for(const hidden of [false,true]){
  const {ctx,requests}=fixture({rendered:true,hidden});
  const result=await ctx.bike24Details({price:999},false,'30 mm');
  assert.equal(result.ready,true);assert.equal(result.offers[0].price,27.99);assert.equal(requests.length,0);
 }
});

test('The fixed-product fallback refuses malformed options, from-price, foreign-currency and incomplete page metadata',async()=>{
 for(const change of [p=>p.productOptionList=[{id:1}],p=>delete p.productOptionList,p=>p.productDetailPrice.hasStartingPrice=true,p=>p.productDetailPrice.currencyCode='USD',p=>p.productDetailPrice.grossPrice=NaN,p=>p.productDetailPrice.grossPrice=0,p=>p.productId='123',p=>p.deliveryLocationCountry=null]){
  const {ctx,props,requests}=fixture();change(props);assert.equal(await ctx.bike24PageProducts(props,'30 mm'),null);assert.equal(requests.length,0);
 }
});

test('BIKE24 fixed-product availability must map to an explicit row with readable stock and shipping data',async()=>{
 const invalid=[{}, {availabilityMapping:{123:123},availabilityVariantsList:{123:{id:999,availability:{message:'Auf Lager'},shipping:{isShippable:true}}}}, {availabilityMapping:{123:123},availabilityVariantsList:{123:{id:123,availability:{message:'Auf Lager'}}}}, {availabilityMapping:{123:123},availabilityVariantsList:{123:{id:123,availability:{message:'Unbekannt'},shipping:{isShippable:true}}}}, {availabilityMapping:{123:123},availabilityVariantsList:{123:{id:123,availability:{message:'Auf Lager'},shipping:{isShippable:false}}}}];
 for(const value of invalid){const {ctx,props,setPayload}=fixture();setPayload(value);assert.equal(await ctx.bike24PageProducts(props,'30 mm'),null);}
 const {ctx,props,setPayload}=fixture();setPayload({availabilityMapping:{123:123},availabilityVariantsList:{123:{id:123,availability:{message:'Aktuell nicht lieferbar'},shipping:{isShippable:false}}}});
 const {offers:[offer]}=await ctx.bike24PageProducts(props,'30 mm');assert.equal(offer.stock,'nicht lieferbar');assert.equal(offer.price,54.99);
});

test('Network, HTTP and malformed availability responses never turn stored BIKE24 prices into fresh offers',async()=>{
 for(const fetch of [async()=>{throw Error('Network failed');},async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw Error('Malformed JSON');}})]){
  const {ctx,props}=fixture();ctx.fetch=fetch;assert.equal(await ctx.bike24PageProducts(props,'30 mm'),null);
 }
});


test('Unrendered BIKE24 dropdowns require exact option mappings, keep variants separate and never invent their EAN',async()=>{
 const {ctx,props,setPayload}=fixture();
 props.productOptionList=[{id:10,label:'Colour',optionValueList:[{id:11,name:'Black',surcharge:0,ean:null},{id:12,name:'White',surcharge:0,ean:null}]},{id:20,label:'Length',optionValueList:[{id:21,name:'116',surcharge:0,ean:'1234567890128'},{id:22,name:'126',surcharge:0,ean:'9999999999999'}]}];
 const keys=['123:opt_10=11,opt_20=21','123:opt_10=11,opt_20=22','123:opt_10=12,opt_20=21'];
 const payload={availabilityMapping:Object.fromEntries(keys.map(key=>[key,key])),availabilityVariantsList:Object.fromEntries(keys.map(key=>[key,{id:key,availability:{message:key===keys[2]?'Nicht lieferbar':'Auf Lager'},shipping:{isShippable:key!==keys[2]}}]))};setPayload(payload);
 const result=await ctx.bike24Details({name:'Old',price:999,ean:'0000000000000'},false,'black, 116');
 assert.equal(result.ready,true);assert.equal(result.offers.length,1);const offer=result.offers[0];assert.equal(offer.variant,'30 mm · Colour: Black · Length: 116');assert.equal(offer.ean,'1234567890128');assert.equal(offer.eanEvidence,'product-options');assert.equal(offer.price,54.99);assert.equal(offer.selection.length,2);
 props.productOptionList[1].optionValueList[0].ean=null;
 const unidentified=await ctx.bike24PageProducts(props,'30 mm','Black, 116');assert.equal(unidentified.offers[0].ean,'');assert.equal(unidentified.offers[0].eanEvidence,'unconfirmed');
 const checked=ctx.confirmBike24ProductMatch({...unidentified,eanCandidates:['1234567890128']},{shopId:'bike24',query:'1234567890128',variant:'Black, 116',nameQuery:props.productName},props.productName);
 assert.equal(checked.offers[0].ean,'','A datasheet list cannot prove the EAN of an unrendered option');
 const unavailable=await ctx.bike24PageProducts(props,'30 mm','white, 116');assert.equal(unavailable.offers[0].stock,'Nicht lieferbar');
 assert.equal((await ctx.bike24PageProducts(props,'30 mm','128')).offers.length,0);
});

test('Unknown, duplicate, incomplete or unpriced option combinations never inherit the base product price',async()=>{
 for(const key of ['123:opt_10=99','123:opt_99=11','123:opt_10=11,opt_10=11','123','999:opt_10=11','123:opt_10=11:extra']){
  const {ctx,props,setPayload}=fixture();props.productOptionList=[{id:10,label:'Size',optionValueList:[{id:11,name:'M',surcharge:0}]}];
  setPayload({availabilityMapping:{[key]:key},availabilityVariantsList:{[key]:{id:key,availability:{message:'Auf Lager'},shipping:{isShippable:true}}}});
  assert.equal(await ctx.bike24PageProducts(props,'','M'),null,key);
 }
 const {ctx,props,setPayload}=fixture();props.productOptionList=[{id:10,label:'Size',optionValueList:[{id:11,name:'M',surcharge:5}]}];const key='123:opt_10=11';setPayload({availabilityMapping:{[key]:key},availabilityVariantsList:{[key]:{id:key,availability:{message:'Auf Lager'},shipping:{isShippable:true}}}});
 assert.equal(await ctx.bike24PageProducts(props,'','M'),null);
});


test('Firefox keeps waiting for its DOM widget and does not use the Chromium fallback',async()=>{
 const {ctx,requests}=fixture();ctx.platform.browserFamily='firefox';ctx.setTimeout=fn=>queueMicrotask(fn);
 const result=await ctx.bike24Details({price:999},false,'30 mm');assert.equal(result.ready,false);assert.equal(result.offers.length,0);assert.equal(result.readIssue,'priceMissing');assert.equal(requests.length,0);
});

test('Mapped option prices include only explicit surcharges and the current page tax rate; exact EAN and SKU stay with that option',async()=>{
 const {ctx,props,setPayload}=fixture();props.productDetailPrice.hasStartingPrice=true;props.taxGroup=1;props.countryTax={taxRates:[{taxGroup:1,value:19}]};
 props.productOptionList=[{id:10,label:'Length',optionValueList:[{id:11,name:'126',surcharge:0.8403,ean:'1234567890128',erpId:456}]}];
 const key='123:opt_10=11';setPayload({availabilityMapping:{[key]:key},availabilityVariantsList:{[key]:{id:key,availability:{message:'Auf Lager'},shipping:{isShippable:true}}}});
 const {offers:[offer]}=await ctx.bike24PageProducts(props,'','126');assert.equal(offer.price,55.99);assert.equal(offer.ean,'1234567890128');assert.equal(new URL(offer.url).searchParams.get('sku'),'456');
 props.countryTax={taxRates:{1:{value:19}}};assert.equal((await ctx.bike24PageProducts(props,'','126')).offers[0].price,55.99);
 props.countryTax.taxRates[1].value=null;assert.equal(await ctx.bike24PageProducts(props,'','126'),null);
});


test('Unrendered metadata cannot confirm a requested variant using a cached base variant',async()=>{
 const {ctx,props}=fixture();props.productVariantList={};
 const result=await ctx.bike24Details({name:'Cached',price:999,baseVariant:'116'},false,'116');assert.equal(result.ready,true);assert.equal(result.offers.length,0);
});
