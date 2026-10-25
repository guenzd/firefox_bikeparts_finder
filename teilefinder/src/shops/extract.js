// Resolve only explicit SKU records; a datasheet GTIN list has no implied order.
function bike24SkuEAN(allowURLSKU=true){
 if(typeof location==='undefined'||location.hostname?.replace(/^www\./,'')!=='bike24.de')return '';
 const cart=document.querySelector('#add-to-cart');
 const declared=[...document.querySelectorAll('#add-to-cart input[name="sku"], #add-to-cart input[name="skuId"], #add-to-cart option:checked[data-sku], #add-to-cart [role="radio"][aria-checked="true"][data-sku]')].map(node=>String(node.getAttribute?.('data-sku')||node.value||'').trim()).filter(Boolean);
 const selected=[...new Set(declared)];if(selected.length>1)return '';
 let sku=selected[0]||'';
 if(!sku&&allowURLSKU){try{sku=new URL(location.href).searchParams.get('sku')||'';}catch{}}
 if(!sku)return '';
 const identifiers=new Set();
 const scan=(value,key='')=>{
  if(!value||typeof value!=='object')return;
  const matches=String(value.sku??value.skuId??value.id??'')===sku||key===sku;
  if(matches)for(const [field,ean] of Object.entries(value))if(/^(?:ean|gtin(?:8|12|13|14)?)$/i.test(field)&&/^\d{8,14}$/.test(String(ean)))identifiers.add(String(ean));
  for(const [field,child] of Object.entries(value))scan(child,field);
 };
 try{scan(JSON.parse(cart?.getAttribute('data-props')||'null'));}catch{}
 for(const node of document.querySelectorAll('script[type="application/ld+json"]')){try{scan(JSON.parse(node.textContent));}catch{}}
 return identifiers.size===1?[...identifiers][0]:'';
}
function bike24DataSheetEANs(){
 const identifiers=new Set();
 for(const label of document.querySelectorAll('.product-detail-data-sheet__row td, .product-detail-data-sheet__row th, .product-detail-data-sheet dt')){
  if(!/^(?:GTIN|EAN|UPC)\s*:?$/i.test((label.textContent||'').trim()))continue;
  for(const match of (label.nextElementSibling?.textContent||'').matchAll(/(?<!\d)\d{8,14}(?!\d)/g))identifiers.add(match[0]);
 }
 return [...identifiers];
}
async function openBike24DataSheet(){
 const labels=()=>[...document.querySelectorAll('.product-detail-data-sheet__row td, .product-detail-data-sheet__row th, .product-detail-data-sheet dt')].filter(node=>/^(?:GTIN|EAN|UPC)\s*:?$/i.test((node.textContent||'').trim()));
 const loaded=()=>labels().some(node=>/(?<!\d)\d{8,14}(?!\d)/.test(node.nextElementSibling?.textContent||''));
 if(loaded())return true;
 const tab=[...document.querySelectorAll('[role="tab"], button, a[href^="#"], summary')].find(node=>{
  const text=(node.getAttribute?.('aria-label')||node.innerText||node.textContent||'').replace(/\s+/g,' ').trim();
  if(!/^(?:Datenblatt|Data sheet|Technical data)$/i.test(text)||node.disabled||!node.getClientRects?.().length)return false;
  if(node.closest?.('#add-to-cart, form')||node.getAttribute?.('type')==='submit')return false;
  const href=node.getAttribute?.('href');return !href||href.startsWith('#');
 });
 if(!tab)return false;
 if(tab.getAttribute?.('aria-selected')!=='true'&&tab.getAttribute?.('aria-expanded')!=='true'&&!(tab.tagName==='SUMMARY'&&tab.parentElement?.open))tab.click();
 for(let attempt=0;attempt<10;attempt++){
  if(loaded())return true;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 return false;
}
function currentProductEAN({allowURLSKU=true}={}){
 const mapped=bike24SkuEAN(allowURLSKU);if(mapped)return mapped;
 const description=document.querySelector('#tab-description')||document.querySelector('#description-tab-pane');
 const described=[...new Set([...(description?.textContent||'').matchAll(/\b(?:EAN|GTIN|UPC)\s*:?\s*(\d{8,14})(?!\d)/gi)].map(m=>m[1]))];
 if(described.length===1)return described[0];
 if(described.length>1)return '';
 const direct=document.querySelector('.nele-fact-ean, .nele-fact-upc, [itemprop="gtin13"], [itemprop="gtin12"], [itemprop="gtin14"], [itemprop="gtin8"], [itemprop="gtin"]');
 const value=(direct?.getAttribute('content')||direct?.textContent||'').trim();
 if(/^\d{8,14}$/.test(value))return value;
 const identifiers=new Set();
 for(const label of document.querySelectorAll('.product-detail-data-sheet__row td, .product-detail-data-sheet__row th, .product-detail-data-sheet dt')){
  if(!/^(?:GTIN|EAN|UPC)\s*:?$/i.test((label.textContent||'').trim()))continue;
  const cell=label.nextElementSibling;
  for(const match of (cell?.textContent||'').matchAll(/(?<!\d)\d{8,14}(?!\d)/g))identifiers.add(match[0]);
 }
 return identifiers.size===1?[...identifiers][0]:'';
}
function productColor(){
 // Product property tables can be collapsed; their labelled text remains in DOM.
 const colors=new Set(),add=value=>{const text=String(value||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\s+/g,' ').trim();if(text&&text.length<=100)colors.add(text);};
 for(const row of document.querySelectorAll('table tr')){
  const cells=[...(row.querySelectorAll?.('th, td')||[])];
  if(cells.length===2&&/^(?:farbe|colou?r)\s*:?$/i.test(cells[0].textContent?.trim()||''))add(cells[1].textContent);
 }
 for(const term of document.querySelectorAll('dt'))if(/^(?:farbe|colou?r)\s*:?$/i.test(term.textContent?.trim()||'')&&term.nextElementSibling?.tagName==='DD')add(term.nextElementSibling.textContent);
 for(const node of document.querySelectorAll('[itemprop="color"]'))add(node.getAttribute?.('content')||node.textContent);
 if(colors.size===1)return [...colors][0];if(colors.size>1)return '';
 const text=document.body?.innerText||'';
 return text.match(/(?:^|\n)Farbe\s*:?\s*\n?\s*(schwarz(?:\s*\/\s*transparent)?|black|weiß|weiss|white)\b/i)?.[1]||'';
}
function dedupe(rows){return typeof uniqueOffers==='function'?uniqueOffers(rows):[...new Map(rows.map(x=>[x.url+'|'+x.variant,x])).values()];}
// This function runs in Chromium and reads only the visible shop DOM.
function readCards({host,q,limit=8}){
 const normalize=productNameText;const tokens=/^\d{8,14}$/.test(q)?[]:normalize(q).split(/\s+/).filter(Boolean);const rows=[];
 for(const a of document.querySelectorAll('a[href]')){
  const name=(a.innerText||a.getAttribute('aria-label')||a.getAttribute('title')||'').trim();if(!name||name.length>500||!(!tokens.length||matches(name,q)))continue;
  let url;try{url=new URL(a.href);if(url.protocol!=='https:'||url.hostname.replace(/^www\./,'')!==host.replace(/^www\./,''))continue;}catch{continue;}
  if(url.pathname==='/'||/\/search|\/suchergebnis|\/s\//.test(url.pathname))continue;
  let card=a;for(let i=0;i<6&&card;i++,card=card.parentElement){const text=card.innerText||'';const monetary=[...text.matchAll(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/g)];if(!monetary.length)continue;if(text.length>2200)break;
   const productLinks=[...card.querySelectorAll('a[href]')].filter(x=>x.innerText?.trim()&&(!tokens.length||matches(x.innerText,q)));if(new Set(productLinks.map(x=>x.href)).size>1)break;
   rows.push({name:(a.getAttribute('title')||a.getAttribute('aria-label')||name).replace(/^Link zum Artikel\s*/i,'').split(/\bUVP\b|\d{1,5}(?:\.\d{3})*,\d{2}\s*€/i)[0].replace(/^\d+\s*\/\s*\d+\s*/,'').trim(),url:url.href,text,price:Math.min(...monetary.map(m=>Number(m[1].replace(/\./g,'').replace(',','.')))),priceKind:/\bab\s+\d|\bfrom\s+\d/i.test(text)?'from':'exact'});break;
  }
 }
 return [...new Map(rows.map(x=>[x.url,x])).values()].slice(0,limit);
}

function readBikeDiscountCards({q,limit=8}){
 const normalize=productNameText;
 const tokens=/^\d{8,14}$/.test(q)?[]:normalize(q).split(' ').filter(Boolean);
 const rows=[];
 for(const anchor of document.querySelectorAll('.product-title a[href]')){
  const name=(anchor.innerText||anchor.textContent||'').replace(/\s+/g,' ').trim();
  if(!(!tokens.length||matches(name,q)))continue;
  const info=anchor.closest('.product-info');
  const priceElement=info?.querySelector('.product-price');
  const text=[...(priceElement?.childNodes||[])].filter(n=>!n.classList?.contains('list-price')).map(n=>n.textContent||'').join(' ');
  const match=text.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
  if(!match)continue;
  const u=new URL(anchor.href,location.href);
  if(u.protocol!=='https:'||u.hostname.replace(/^www\./,'')!=='bike-discount.de')continue;
  rows.push({name,url:u.href,price:Number(match[1].replace(/\./g,'').replace(',','.')),priceKind:/\bab\b/i.test(text)?'from':'exact',text:info.innerText});
 }
 return [...new Map(rows.map(r=>[r.url,r])).values()].slice(0,limit);
}

async function r2DescriptionEAN(){
 const existing=currentProductEAN();if(existing)return existing;
 const description=document.querySelector('#tab-description');if(!description)return '';
 const toggle=[...description.querySelectorAll('a.aw_toggle_animated, button[type="button"]')].find(node=>/mehr lesen/i.test(node.querySelector('.more')?.textContent||node.textContent||'')&&node.getClientRects().length&&node.getAttribute('aria-expanded')!=='true'&&(!node.getAttribute('href')||node.getAttribute('href').startsWith('#')));
 if(!toggle)return '';
 toggle.click();
 for(let i=0;i<8;i++){await new Promise(resolve=>setTimeout(resolve,200));const ean=currentProductEAN();if(ean)return ean;}
 return '';
}


function bikeDiscountStock(){
 const availability=document.querySelector('.nele-product-availability-info');
 const buy=document.querySelector('.product-detail-buy')||document.querySelector('.product-detail-buy-inner');
 const text=[availability?.innerText,buy?.innerText].filter(Boolean).join('\n');
 return stockText(text);
}
