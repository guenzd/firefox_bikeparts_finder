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
browser.runtime.onMessage.addListener(async data=>{
 if(!['extract','detail','cart-ready','cart-add'].includes(data?.type)||(['extract','detail'].includes(data.type)&&typeof data.query!=='string')||location.hostname.replace(/^www\./,'')!==data.host?.replace(/^www\./,''))return;
 if(data.type==='cart-ready')return {blocked:challenge(),ready:!challenge()&&new URL(location.href).pathname===new URL(data.url).pathname&&!!document.querySelector('h1')};
 if(data.type==='cart-add'){if(challenge())return {message:'Bitte Sicherheitsprüfung im Shop abschließen.'};if(new URL(location.href).pathname!==new URL(data.url).pathname)return {message:'Produktseite stimmt nicht überein. Bitte im Shop prüfen.'};return cartAction(data);}
 const body=document.body?.innerText||'';
 if(challenge())return Promise.resolve({blocked:true,offers:[]});
 for(const label of ['Alle ablehnen','Ablehnen','Nur notwendige Cookies','Nur Notwendige Cookies','Nur essenzielle Cookies']){const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===label&&b.getClientRects().length);if(b){b.click();break;}}
 if(data.type==='detail'){
  const same=new URL(location.href).pathname===new URL(data.url).pathname;
  if(same&&document.querySelector('h1')&&data.shopId==='bike24'&&data.fallback)return bike24Details(data.fallback,data.followLinked!==false);
  if(same&&document.querySelector('h1')&&data.shopId==='bike-components'&&data.fallback){const variants=await bikeComponentsVariants(data.fallback);if(variants.offers.length)return {ready:true,...variants};}
  if(same&&document.querySelector('h1')&&data.shopId==='bike-discount'&&data.fallback){const variants=await bikeDiscountVariants(data.fallback);if(variants.length)return {ready:true,offers:variants};}
  if(same&&document.querySelector('h1')&&data.fallback&&productDropdowns().length){const variants=await dropdownVariants(data.fallback);if(variants.offers.length)return {ready:true,...variants};}
  const main=document.querySelector('[itemtype$="/Product"]')||document.querySelector('main')||document.body;
  const availability=document.querySelector('.nele-product-availability-info, .delivery-status, .delivery, .availability, .stock-status');
  return Promise.resolve({ready:same&&!!document.querySelector('h1'),stock:stockText(availability?.innerText||main.innerText.split(/Beschreibung|Wird oft zusammen gekauft|Zuletzt angesehen/)[0])});
 }
 const cards=data.shopId==='bike-discount'?readBikeDiscountCards({q:data.query,limit:data.variant?40:8}):data.shopId==='bike-components'?bcCards(data.query,data.variant?40:8):readCards({host:data.host,q:data.query,limit:data.variant?40:8});
 const json=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(n=>{try{return [JSON.parse(n.textContent)];}catch{return [];}});
 const rows=cards.map(c=>({name:c.name,variant:/^\d{8,14}$/.test(data.query)?'EAN im Shop prüfen':'Ausführung im Shop prüfen',price:c.price,priceKind:c.priceKind,stock:stockText(c.text),url:c.url,source:'Firefox · Suchseite'}));
 const offers=dedupe(rows.length?rows:structuredOffers(json,data.host,location.href,data.query)).sort((a,b)=>Number(variantMatches(b,data.variant))-Number(variantMatches(a,data.variant))).slice(0,12);
 const loose=offers.length?[]:data.shopId==='bike-discount'?readBikeDiscountCards({q:'',limit:40}):data.shopId==='bike-components'?bcCards('',40):readCards({host:data.host,q:'',limit:40});
 const suggestions=similarProducts(loose,data.query);
 return Promise.resolve({blocked:false,offers,suggestions,empty:/keine (?:Artikel|Produkte|Ergebnisse|Treffer)|0 (?:Artikel|Produkte|Treffer)|no results/i.test(body)});
});

async function bike24Details(fallback,followLinked){
 const cart=document.querySelector('#add-to-cart');if(!cart)return {ready:false};
 let props;try{props=JSON.parse(cart.getAttribute('data-props'));}catch{return {ready:false};}
 const clean=s=>String(s||'').replace(/\s*-\s*\d+[.,]\d{2}\s*(?:EUR|€).*$/i,'').trim();
 const linkedVariants=followLinked?(props.productVariantList?.variantList||[]).flatMap(v=>{const url=safeUrl(v.url,'www.bike24.de');return url?[{url,variant:clean(v.variant)}]:[];}):[];
 const base=clean((props.productVariantList?.variantList||[]).find(v=>String(v.id)===String(props.productVariantList.currentVariantId))?.variant||fallback.baseVariant||'');
 let variants={offers:[],limited:false};
 if(productDropdowns().length)variants=await dropdownVariants(fallback);
 const offers=variants.offers.map(o=>({...o,name:document.querySelector('h1')?.innerText.trim()||o.name,variant:[base,o.variant].filter(Boolean).join(' · ')}));
 if(!offers.length&&!productDropdowns().length){
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<12;i++){
   const text=document.querySelector('#add-to-cart .product-availability')?.innerText||'';
   const stock=stockText(text),price=euro((document.querySelector('#add-to-cart .price__value')?.innerText||'').replace(/€/g,''));
   if(price!==null&&!/Bitte Option wählen/i.test(text)&&stock!=='Lagerstatus nicht auslesbar'){offers.push({...fallback,name:document.querySelector('h1')?.innerText.trim()||fallback.name,variant:base||fallback.variant,price,priceKind:'exact',stock,url:location.href,source:'Firefox · ausgewählte Produktvariante'});break;}
   await pause(250);
  }
 }
 return {ready:true,offers,linkedVariants,limited:variants.limited,stock:offers[0]?.stock||'Lagerstatus nicht auslesbar'};
}
