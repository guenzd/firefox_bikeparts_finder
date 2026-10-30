function challenge(){return /Just a moment|Verify you are human|Verifying you are human|Sicherheitsüberprüfung|Checking your browser|Access Denied|Bestätigen Sie.{0,40}Mensch/i.test((document.body?.innerText||'').slice(0,4000))||!!document.querySelector('iframe[src*="challenges.cloudflare.com"]');}
function bcCards(q,limit=8){
 const products=new Map();
 // Read the rendered results, including client-side searches in reused tabs.
 // Embedded data-props can describe an earlier render or omit the live list.
 for(const card of document.querySelectorAll('a[data-test="auto-product-item"][href]')){
  const name=(card.querySelector('[data-test="auto-product-item-name"]')?.textContent||card.getAttribute('title')||'').trim();
  if(!name||(!matches(name,q)&&!/^\d{8,14}$/.test(q)))continue;
  const url=safeUrl(card.getAttribute('href'),'www.bike-components.de');
  const priceText=card.querySelector('[data-test="product-price"]')?.textContent||'';
  const match=priceText.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
  const price=match?euro(match[1]):null;
  if(url&&price!==null)products.set(url,{name,url,price,priceKind:/\bab\b/i.test(priceText)?'from':'exact',text:card.innerText||''});
 }
 const walk=x=>{if(!x||typeof x!=='object')return;
  if(x.type==='variant'&&x.data?.productName&&x.data?.link&&(matches(x.data.productName,q)||/^\d{8,14}$/.test(q))){
   const p=x.data,url=safeUrl(p.link,'www.bike-components.de'),price=euro(p.priceRaw);
   if(url&&price!==null&&!products.has(url))products.set(url,{name:p.productName,url,price,priceKind:'from',text:p.availability?.text||''});
  }
  Object.values(x).forEach(walk);
 };
 document.querySelectorAll('[data-props]').forEach(n=>{try{walk(JSON.parse(n.getAttribute('data-props')));}catch{}});
 return [...products.values()].slice(0,limit);
}
function confirmBike24ProductMatch(result,data,productName){
 if(data.shopId!=='bike24')return result;
 const ean=validEAN(data.query);
 if(!ean||!data.variant?.trim()||!data.nameQuery||validEAN(data.nameQuery)||!matches(productName,data.nameQuery)||!result.eanCandidates?.some(value=>equivalentEANs(value,ean)))return result;
 return {...result,offers:(result.offers||[]).map(offer=>!validEAN(offer.ean)&&offer.eanEvidence!=='unconfirmed'&&offer.priceKind==='exact'&&Number.isFinite(offer.price)&&offer.selection?.length&&offer.selection.every(option=>option.value)&&variantMatches(offer,data.variant)?{...offer,ean,eanEvidence:'datasheet'}:offer)};
}
// A timed-out message does not cancel DOM work. Share duplicate retries and
// serialize different reads so asynchronous dropdown changes cannot overlap.
function createShopReadQueue(read){
 const pending=new Map();let tail=Promise.resolve();
 return data=>{
  if(!['ready','extract','detail'].includes(data?.type))return undefined;
  const key=JSON.stringify(data);if(pending.has(key))return pending.get(key);
  const result=tail.then(()=>read(data));pending.set(key,result);
  tail=result.then(()=>{pending.delete(key);},()=>{pending.delete(key);});
  return result;
 };
}
// Register the receiver at document_start, but never select variants or read
// incomplete markup before the page's deferred scripts and DOM are ready.
function waitForShopDocument(doc){
 if(doc.readyState!=='loading')return Promise.resolve();
 return new Promise(resolve=>doc.addEventListener('DOMContentLoaded',resolve,{once:true}));
}
platform.runtime.onMessage.addListener(createShopReadQueue(async data=>{if(data?.type==='ready'){if(location.hostname.replace(/^www\./,'')!==data.host?.replace(/^www\./,''))return {ready:false};if(new URL(location.href).pathname!==new URL(data.url).pathname)return {ready:false};await waitForShopDocument(document);return {ready:true};}await waitForShopDocument(document);const result=await readShopPage(data);if(data?.type==='detail'&&result){const productName=document.querySelector('h1')?.innerText?.trim()||'';return {...confirmBike24ProductMatch(result,data,productName),productName,pageMatchesRequested:new URL(location.href).pathname===new URL(data.url).pathname};}return result;}));
async function readShopPage(data){
 if(!['extract','detail'].includes(data?.type)||(['extract','detail'].includes(data.type)&&typeof data.query!=='string')||location.hostname.replace(/^www\./,'')!==data.host?.replace(/^www\./,''))return;
 const body=document.body?.innerText||'';
 if(challenge())return Promise.resolve({blocked:true,offers:[]});
 for(const label of ['Alle ablehnen','Ablehnen','Nur notwendige Cookies','Nur Notwendige Cookies','Nur essenzielle Cookies']){const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===label&&b.getClientRects().length);if(b){b.click();break;}}
 if(data.type==='detail'){
  const same=new URL(location.href).pathname===new URL(data.url).pathname;
  if(same&&data.shopId==='r2-bike'&&data.fallback){const ean=await r2DescriptionEAN();if(data.metadataOnly)return {ready:!!ean||document.readyState==='complete',offers:[{...data.fallback,ean}]};}
  if(same&&data.shopId==='bike24'&&data.metadataOnly&&data.fallback){const sheetReady=await openBike24DataSheet();const ean=currentProductEAN();if(productDropdowns().length&&(!ean||data.variant?.trim()))return bike24Details(data.fallback,false,data.variant,data.savedSelection,validEAN(data.query));return {ready:!!ean||sheetReady,eanCandidates:bike24DataSheetEANs(),offers:[{...data.fallback,ean}]};}
  if(same&&document.querySelector('h1')&&data.shopId==='bike24'&&data.fallback)return bike24Details(data.fallback,data.followLinked!==false,data.variant,data.savedSelection,validEAN(data.query));
  if(same&&data.shopId==='bike-components'&&data.fallback){const json=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(n=>{try{return [JSON.parse(n.textContent)];}catch{return [];}});const schema=structuredOffers(json,data.host,location.href,data.query).filter(o=>variantMatches(o,data.variant));if(schema.length&&!data.savedSelection?.length)return {ready:true,offers:schema};if(!document.querySelector('h1'))return {ready:false,offers:[]};if(document.querySelector('.pdp-variant-button[aria-controls="options-list"]')){const variants=await bikeComponentsVariants(data.fallback,data.variant,data.savedSelection,validEAN(data.query));if(variants.offers.length||variants.inspectionComplete)return {ready:true,...variants};if(data.variant&&!variantMatches(data.fallback,data.variant))return {ready:false,offers:[]};}}
  if(same&&document.querySelector('h1')&&data.shopId==='bike-discount'&&data.fallback&&document.querySelector('#productDetailConfiguratorOptions')){const variants=await bikeDiscountVariants(data.fallback,data.variant,data.savedSelection,validEAN(data.query));if(variants.length)return {ready:true,offers:variants};return {ready:!!variants.inspectionComplete,offers:[],readIssue:variants.readIssue||'optionsMissing'};}
  if(same&&document.querySelector('h1')&&data.fallback&&productDropdowns().length){const variants=await dropdownVariants(data.fallback,data.variant,data.savedSelection,validEAN(data.query));if(variants.offers.length||variants.inspectionComplete)return {ready:true,...variants};}
  const main=(data.shopId==='r2-bike'?document.querySelector('#buy_form'):null)||document.querySelector('[itemtype$="/Product"]')||document.querySelector('main')||document.body;
  const availability=(data.shopId==='r2-bike'?main.querySelector?.('.delivery-status, .delivery, .availability, .stock-status'):null)||document.querySelector('.nele-product-availability-info, .delivery-status, .delivery, .availability, .stock-status');
  const stock=data.shopId==='bike-discount'?bikeDiscountStock():stockText(availability?.innerText||availability?.textContent||(data.shopId==='r2-bike'&&main.id==='buy_form'?main.innerText:main.innerText.split(/Beschreibung|Wird oft zusammen gekauft|Zuletzt angesehen/)[0]));
  // A comma-separated selector follows DOM order, not selector priority.
  // Bike-Discount places recommendation-card prices before the actual product.
  const priceNode=data.direct?(data.shopId==='bike-discount'?document.querySelector('.product-detail-price'):document.querySelector('#buy_form .price, #product-offer [itemprop="price"], [data-test="auto-product-price"], .product-detail-price, [itemprop="offers"] [itemprop="price"], .product-info .price, .product-price')):null;
  const priceText=(priceNode?.innerText||priceNode?.textContent||priceNode?.getAttribute('content')||'').trim();
  const amount=priceText.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);const freshPrice=amount?euro(amount[1]):euro(priceNode?.getAttribute('content'));
  const offer=data.fallback?{...data.fallback,ean:currentProductEAN(),variant:[data.fallback.variant,productColor()].filter(Boolean).join(' · '),stock,...(data.direct?{price:freshPrice,priceKind:/^ab\s/i.test(priceText)?'from':'exact',name:document.querySelector('h1')?.innerText?.trim()||'',variant:[document.querySelector('h1')?.innerText?.trim(),productColor(),fixedProductProperties()].filter(Boolean).join(' · ')}:{})}:null;
  return {ready:same&&!!document.querySelector('h1')&&(!data.direct||freshPrice!==null),stock,...(offer?{offers:[offer]}:{})};
 }
 // A single-result shop search can redirect directly to a product page.
 // Read its own fields before recommendation cards, which are not search results.
 if(data.shopId==='bike-discount'&&document.querySelector('h1')&&document.querySelector('.product-detail-price')){
  const name=document.querySelector('h1').innerText.trim(),ean=currentProductEAN();
  const priceText=document.querySelector('.product-detail-price').innerText.trim();
  const amount=priceText.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
  const configurable=!!document.querySelector('#productDetailConfiguratorOptions');
  const stock=bikeDiscountStock();
  const accepted=validEAN(data.query)?!ean||equivalentEANs(ean,data.query):matches(name,data.query);
  const offers=accepted&&amount?[{name,ean,price:euro(amount[1]),priceKind:/^ab\s/i.test(priceText)?'from':'exact',variant:configurable?'Ausführung im Shop prüfen':[productColor()||name,fixedProductProperties()].filter(Boolean).join(' · '),stock,url:location.href,source:'Firefox · Produktseite'}]:[];
  return {blocked:false,offers,suggestions:[],ready:document.readyState==='complete',empty:!accepted,message:!accepted&&validEAN(data.query)&&ean?'Gefundenes Produkt hat EAN '+ean+' statt der gesuchten EAN '+data.query+'.':''};
 }
 const listingQuery=validEAN(data.query)?'':data.query;
 const cards=data.shopId==='bike-discount'?readBikeDiscountCards({q:listingQuery,limit:data.variant?40:8}):data.shopId==='bike-components'?bcCards(listingQuery,data.variant?40:8):readCards({host:data.host,q:listingQuery,limit:data.variant?40:8});
 const json=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(n=>{try{return [JSON.parse(n.textContent)];}catch{return [];}});
 const rows=cards.map(c=>({name:c.name,ean:c.ean||'',variant:c.variant||c.name||'Ausführung im Shop prüfen',price:c.price,priceKind:c.priceKind,stock:stockText(c.text),url:c.url,source:'Firefox · Suchseite'}));
 const offers=dedupe(rows.length?rows:structuredOffers(json,data.host,location.href,data.query)).sort((a,b)=>Number(variantMatches(b,data.variant))-Number(variantMatches(a,data.variant))).slice(0,12);
 const loose=offers.length?[]:data.shopId==='bike-discount'?readBikeDiscountCards({q:'',limit:40}):data.shopId==='bike-components'?bcCards('',40):readCards({host:data.host,q:'',limit:40});
 const suggestions=similarProducts(loose,data.query);
 return Promise.resolve({blocked:false,offers,suggestions,ready:document.readyState==='complete'&&(cards.length>0||loose.length>0||!!document.querySelector('[data-test="auto-product-item"], .product-title a, .product-listing, #product-listing-0')),empty:/keine (?:Artikel|Produkte|Ergebnisse|Treffer)|0 (?:Artikel|Produkte|Treffer)|no results/i.test(body)});
}

async function bike24Details(fallback,followLinked,requested,savedSelection=[],requestedEAN=''){
 await openBike24DataSheet();
 const cart=document.querySelector('#add-to-cart');if(!cart)return {ready:false,readIssue:'productNotReady'};
 let props;try{props=JSON.parse(cart.getAttribute('data-props'));}catch{return {ready:false,readIssue:'productNotReady'};}
 const clean=s=>String(s||'').replace(/\s*-\s*\d+[.,]\d{2}\s*(?:EUR|€).*$/i,'').trim();
 const linkedVariants=followLinked?(props.productVariantList?.variantList||[]).flatMap(v=>{const url=safeUrl(v.url,'www.bike24.de');return url?[{url,variant:clean(v.variant)}].filter(o=>!requested||variantMatches({...fallback,variant:o.variant},requested)):[];}):[];
 const pageBase=clean((props.productVariantList?.variantList||[]).find(v=>String(v.id)===String(props.productVariantList.currentVariantId))?.variant||'');
 const base=pageBase||fallback.baseVariant||'';
 let variants={offers:[],limited:false},readIssue='';
 if(productDropdowns().length)variants=await dropdownVariants({...fallback,baseVariant:base},requested,savedSelection,requestedEAN);
 // Chromium can defer the shop's animation-frame widget mount in hidden tabs.
 // Only fresh page data plus an exact availability mapping may replace it.
 // An already mounted widget retains its existing DOM/dropdown path.
 if(platform.browserFamily==='chromium'&&Array.isArray(props.productOptionList)&&!cart.querySelector('.price__value')){
  const page=await bike24PageProducts(props,pageBase,requested);
  if(page)return {ready:true,...page,eanCandidates:bike24DataSheetEANs(),linkedVariants};
 }
 const offers=variants.offers.map(o=>({...o,name:document.querySelector('h1')?.innerText.trim()||o.name,variant:[base,o.variant].filter(Boolean).join(' · ')}));
 if(!offers.length&&!productDropdowns().length){
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<12;i++){
   const availabilityNode=document.querySelector('#add-to-cart .product-availability'),priceNode=document.querySelector('#add-to-cart .price__value');
   const text=availabilityNode?.innerText||availabilityNode?.textContent||'';
   const stock=stockText(text),price=euro((priceNode?.innerText||priceNode?.textContent||'').replace(/€/g,''));
   readIssue=price===null?'priceMissing':/Bitte Option wählen/i.test(text)?'selectionUnconfirmed':stock==='Lagerstatus nicht auslesbar'?'stockMissing':'';
   if(!readIssue){offers.push({...fallback,ean:currentProductEAN()||validEAN(props.ean),eanEvidence:undefined,name:document.querySelector('h1')?.innerText.trim()||fallback.name,variant:base||fallback.variant,price,priceKind:'exact',stock,url:location.href,source:'Firefox · ausgewählte Produktvariante'});break;}
   await pause(250);
  }
 }
 return {ready:offers.length>0||!!variants.inspectionComplete,offers,readIssue,eanCandidates:bike24DataSheetEANs(),linkedVariants,limited:variants.limited,stock:offers[0]?.stock||'Lagerstatus nicht auslesbar'};
}

// Read-only shop data, never cached offer prices or guessed option/GTIN order.
async function bike24PageProducts(props,base,requested){
 const price=props.productDetailPrice,productId=props.productId,country=props.deliveryLocationCountry,groups=props.productOptionList;
 if(!Number.isSafeInteger(productId)||productId<=0||!Number.isSafeInteger(country)||country<=0||!Array.isArray(groups)||price?.currencyCode!=='EUR'||(price.hasStartingPrice!==false&&!(price.hasStartingPrice===true&&groups.length))||!Number.isFinite(price.grossPrice)||price.grossPrice<=0)return null;
 const optionGroups=new Map();
 for(const group of groups){
  if(!Number.isSafeInteger(group.id)||group.id<=0||optionGroups.has(String(group.id))||typeof group.label!=='string'||!Array.isArray(group.optionValueList))return null;
  const values=new Map();
  for(const value of group.optionValueList){if(!Number.isSafeInteger(value.id)||value.id<=0||values.has(String(value.id))||typeof value.name!=='string')return null;values.set(String(value.id),value);}
  optionGroups.set(String(group.id),{label:group.label,values});
 }
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6000);
 try{
  const url=new URL('/api/product/'+productId+'/availability',location.origin);url.searchParams.set('deliveryCountryId',country);
  const response=await fetch(url.href,{credentials:'same-origin',cache:'no-store',signal:abort.signal});if(!response.ok)return null;
  const data=await response.json(),mapping=data?.availabilityMapping;if(!mapping||typeof mapping!=='object'||!data.availabilityVariantsList)return null;
  const name=document.querySelector('h1')?.innerText?.trim()||props.productName;if(typeof name!=='string'||!name.trim())return null;
  const offers=[];let verified=0,limited=false;
  for(const [key,mapped] of Object.entries(mapping)){
   const [id,options,...extra]=key.split(':');if(id!==String(productId)||extra.length)continue;
   const selection=[],selectedValues=[];let valid=true;
   if(groups.length){
    const seen=new Set();
    for(const pair of (options||'').split(',')){
     const match=pair.match(/^opt_(\d+)=(\d+)$/),group=match&&optionGroups.get(match[1]),value=group&&group.values.get(match[2]);
     if(!group||!value||seen.has(match[1])||!Number.isFinite(value.surcharge)){valid=false;break;}
     seen.add(match[1]);selectedValues.push(value);selection.push({kind:'select',name:match[1],label:group.label,value:match[2],text:value.name});
    }
    if(seen.size!==groups.length)valid=false;
   }else if(options!==undefined)valid=false;
   if(!valid)continue;
   let surcharge=selectedValues.reduce((total,value)=>total+value.surcharge,0);
   if(surcharge){
    const rates=props.countryTax?.taxRates,tax=Array.isArray(rates)?rates.find(rate=>rate.taxGroup===props.taxGroup):rates?.[props.taxGroup];
    if(!tax||!Number.isFinite(tax.value)||tax.value<0||tax.value>100)continue;
    surcharge=Math.round(surcharge*(1+tax.value/100)*100)/100;
   }
   const amount=euro(price.grossPrice+surcharge);if(amount===null)continue;
   const row=data.availabilityVariantsList[String(mapped)];if(!row||String(row.id)!==String(mapped)||!row.availability||!row.shipping)continue;
   const stock=stockText(String(row.availability.message||'').replace(/<[^>]*>/g,' '));
   if(stock==='Lagerstatus nicht auslesbar'||row.shipping.isShippable!==true&&!/nicht|ausverkauft|out of stock/i.test(stock))continue;
   verified++;
   const variant=[base,...selection.map(option=>option.label+': '+option.text)].filter(Boolean).join(' · ')||name;
   if(!variantMatches({name,variant},requested))continue;
   if(offers.length>=24){limited=true;break;}
   const identifiers=distinctEANs(selectedValues.map(value=>validEAN(value.ean)).filter(Boolean));
   const ean=groups.length?(identifiers.length===1?identifiers[0]:''):currentProductEAN()||validEAN(props.ean);
   const productURL=new URL(location.href);
   if(groups.length){productURL.searchParams.delete('sku');const skus=[...new Set(selectedValues.map(value=>value.erpId).filter(value=>Number.isSafeInteger(value)&&value>0))];if(skus.length===1)productURL.searchParams.set('sku',skus[0]);}
   offers.push({name,variant,price:amount,priceKind:'exact',stock,ean,eanEvidence:groups.length?(ean?'product-options':'unconfirmed'):undefined,...(selection.length?{selection}:{}),url:productURL.href,source:'Shop · Produktdaten'});
  }
  return verified?{offers,limited}:null;
 }catch{return null;}finally{clearTimeout(timer);}
}
