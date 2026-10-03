// Extraction helpers shared with Teilefinder.
function safeUrl(value,host){try{const u=new URL(value,'https://'+host);return u.protocol==='https:' && u.hostname.replace(/^www\./,'')===host.replace(/^www\./,'') ? u.href : null;}catch{return null;}}
function euro(value){if(typeof value==='number')return Number.isFinite(value)&&value>0?Math.round(value*100)/100:null;const text=String(value??'').replace(/\s/g,'');const n=Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;}
function productNameText(value){return String(value||'').toLowerCase().replace(/['’‘`´ʼ]/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑–—-]/g,' ').replace(/\s+/g,' ').trim();}
function matches(name,q){
 const text=productNameText(name),query=productNameText(q),words=text.split(/[^a-z0-9]+/).filter(Boolean);
 if(/\b(?:bundle|set|\d+er\s+set)\b/.test(text)&&!/\b(?:bundle|set|\d+er\s+set)\b/.test(query))return false;
 const requested=query.split(/\s+/).filter(Boolean);
 const acronym=(token,tokens)=>/^[a-z]{2,4}$/.test(token)&&tokens.some((_,i)=>tokens.slice(i,i+token.length).length===token.length&&tokens.slice(i,i+token.length).every((word,j)=>/^[a-z]{3,}$/.test(word)&&word[0]===token[j]));
 return requested.every((token,index)=>{
  if(words.includes(token)||acronym(token,words))return true;
  // Accept abbreviations of consecutive words without a vocabulary of product names.
  for(let length=2;length<=4;length++)for(let start=Math.max(0,index-length+1);start<=index;start++){
   const phrase=requested.slice(start,start+length);
   if(phrase.length===length&&phrase.every(word=>/^[a-z]{3,}$/.test(word))&&words.includes(phrase.map(word=>word[0]).join('')))return true;
  }
  return token.length>2&&text.includes(token);
 });
}
function stockText(text){const patterns=[/(?:Lagernd,\s*Lieferzeit\s*\d+(?:\s*[-–]\s*\d+)?\s*Tage)/i,/(?:nicht (?:mehr )?(?:lieferbar|verfügbar|auf lager)|ausverkauft|out of stock)/i,/(?:verfügbar (?:ab|in) [^\n.;]{1,65}|available (?:from|in) [^\n.;]{1,65})/i,/(?:ab lager verfügbar|sofort lieferbar|lagernd|auf lager|in stock|available from stock)/i,/(?:Versand in|Lieferzeit:?|delivery time:?|lieferbar in)\s*[^\n.;]{1,65}/i,/\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeitstage|Werktage|working days)\b/i];for(const re of patterns){const m=text.match(re);if(m)return m[0].trim();}return 'Lagerstatus nicht auslesbar';}
function walk(x,fn){if(!x||typeof x!=='object')return;fn(x);for(const v of Object.values(x))walk(v,fn);}
function productEAN(product,offer={}){return ['gtin13','gtin','gtin14','gtin12','gtin8'].map(k=>String(offer[k]||product[k]||'')).find(x=>/^\d{8,14}$/.test(x))||'';}
function structuredOffers(json,host,fallbackUrl,q){
 const rows=[];
 const visit=(p,parent)=>{
  if(!p||typeof p!=='object')return;
  if(Array.isArray(p)){p.forEach(x=>visit(x,parent));return;}
  const types=[].concat(p['@type']||[]);
  const group=types.includes('ProductGroup')?p:parent;
  if(types.includes('Product')&&p.name&&p.offers){
   const brand=p.brand||group?.brand;const brandName=typeof brand==='string'?brand:brand?.name||'';
   const name=[brandName,group?.name&&group.name+' ·',p.name].filter(Boolean).join(' ');
   for(const o of [].concat(p.offers)){
    const ean=productEAN(p,o);
    if(!matches(name,q)&&ean!==q&&!['sku','mpn'].some(k=>String(p[k]||'')===q))continue;
    const url=safeUrl(o.url||p.url||fallbackUrl,host),price=euro(o.price??o.lowPrice);
    if(!url||o.priceCurrency!=='EUR'||price===null)continue;
    const status=String(o.availability||'').split('/').pop();
    const stock={InStock:'Auf Lager',OutOfStock:'Ausverkauft',PreOrder:'Vorbestellung',BackOrder:'Nachbestellung',LimitedAvailability:'Begrenzt verfügbar',SoldOut:'Ausverkauft'}[status]||'Lagerstatus nicht auslesbar';
    const variant=group?p.name:[p.color,p.size,o.name].filter(Boolean).join(' · ')||'Ausführung im Shop prüfen';
    rows.push({name,variant,ean,price,priceKind:o.price===undefined?'from':'exact',stock,url,source:'Produktseite'});
   }
  }
  for(const value of Object.values(p))visit(value,group);
 };
 json.forEach(x=>visit(x,null));return dedupe(rows);
}
function currentProductEAN(){
 const description=document.querySelector('#tab-description')||document.querySelector('#description-tab-pane');
 const described=[...new Set([...(description?.textContent||'').matchAll(/\b(?:EAN|GTIN)\s*:?\s*(\d{8,14})(?!\d)/gi)].map(m=>m[1]))];
 if(described.length===1)return described[0];
 if(described.length>1)return '';
 const direct=document.querySelector('.nele-fact-ean, [itemprop="gtin13"], [itemprop="gtin"]');
 const value=(direct?.getAttribute('content')||direct?.textContent||'').trim();
 if(/^\d{8,14}$/.test(value))return value;
 const identifiers=new Set();
 for(const label of document.querySelectorAll('.product-detail-data-sheet__row td, .product-detail-data-sheet__row th, .product-detail-data-sheet dt')){
  if(!/^(?:GTIN|EAN)\s*:?$/i.test((label.textContent||'').trim()))continue;
  const cell=label.nextElementSibling;
  for(const match of (cell?.textContent||'').matchAll(/(?<!\d)\d{8,14}(?!\d)/g))identifiers.add(match[0]);
 }
 return identifiers.size===1?[...identifiers][0]:'';
}
function productColor(){
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
