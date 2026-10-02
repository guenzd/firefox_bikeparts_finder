// Extraction helpers shared with Teilefinder.
function safeUrl(value,host){try{const u=new URL(value,'https://'+host);return u.protocol==='https:' && u.hostname.replace(/^www\./,'')===host.replace(/^www\./,'') ? u.href : null;}catch{return null;}}
function euro(value){if(typeof value==='number')return Number.isFinite(value)&&value>0?Math.round(value*100)/100:null;const text=String(value??'').replace(/\s/g,'');const n=Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;}
function matches(name,q){const normalize=s=>s.toLowerCase().replace(/[‐‑–—-]/g,' ').replace(/\s+/g,' ').trim();return normalize(q).split(/\s+/).filter(Boolean).every(t=>normalize(name).includes(t));}
function stockText(text){const patterns=[/(?:Lagernd,\s*Lieferzeit\s*\d+(?:\s*[-–]\s*\d+)?\s*Tage)/i,/(?:nicht (?:mehr )?(?:lieferbar|verfügbar|auf lager)|ausverkauft|out of stock)/i,/(?:verfügbar (?:ab|in) [^\n.;]{1,65}|available (?:from|in) [^\n.;]{1,65})/i,/(?:ab lager verfügbar|sofort lieferbar|lagernd|auf lager|in stock|available from stock)/i,/(?:Versand in|Lieferzeit:?|delivery time:?|lieferbar in)\s*[^\n.;]{1,65}/i,/\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeitstage|Werktage|working days)\b/i];for(const re of patterns){const m=text.match(re);if(m)return m[0].trim();}return 'Lagerstatus nicht auslesbar';}
function walk(x,fn){if(!x||typeof x!=='object')return;fn(x);for(const v of Object.values(x))walk(v,fn);}
function structuredOffers(json,host,fallbackUrl,q){const rows=[];for(const d of json)walk(d,p=>{if(!(Array.isArray(p['@type'])?p['@type'].includes('Product'):p['@type']==='Product')||!p.name||!p.offers||(!matches(p.name,q)&&!['gtin','gtin8','gtin12','gtin13','gtin14','sku','mpn'].some(k=>String(p[k]||'')===q)))return;for(const o of Array.isArray(p.offers)?p.offers:[p.offers]){const url=safeUrl(o.url||p.url||fallbackUrl,host);if(!url||o.priceCurrency!=='EUR')continue;const amount=euro(o.price??o.lowPrice);if(amount===null)continue;const status=String(o.availability||'').split('/').pop();const stock={InStock:'Auf Lager',OutOfStock:'Ausverkauft',PreOrder:'Vorbestellung',BackOrder:'Nachbestellung',LimitedAvailability:'Begrenzt verfügbar',SoldOut:'Ausverkauft'}[status]||'Lagerstatus nicht auslesbar';rows.push({name:String(p.name),variant:o.name||p.size||p.sku&&('Artikel '+p.sku)||'Ausführung im Shop prüfen',price:amount,priceKind:o.price===undefined?'from':'exact',stock,url,source:'Produktseite'});}});return dedupe(rows);}
function dedupe(rows){return [...new Map(rows.map(x=>[x.url+'|'+x.variant,x])).values()];}
// This function runs in Chromium and reads only the visible shop DOM.
function readCards({host,q,limit=8}){
 const normalize=s=>(s||'').toLowerCase().replace(/[‐‑–—]/g,'-');const tokens=/^\d{8,14}$/.test(q)?[]:normalize(q).split(/\s+/).filter(Boolean);const rows=[];
 for(const a of document.querySelectorAll('a[href]')){
  const name=(a.innerText||a.getAttribute('aria-label')||a.getAttribute('title')||'').trim();if(!name||name.length>500||!tokens.every(t=>normalize(name).includes(t)))continue;
  let url;try{url=new URL(a.href);if(url.protocol!=='https:'||url.hostname.replace(/^www\./,'')!==host.replace(/^www\./,''))continue;}catch{continue;}
  if(url.pathname==='/'||/\/search|\/suchergebnis|\/s\//.test(url.pathname))continue;
  let card=a;for(let i=0;i<6&&card;i++,card=card.parentElement){const text=card.innerText||'';const monetary=[...text.matchAll(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/g)];if(!monetary.length)continue;if(text.length>2200)break;
   const productLinks=[...card.querySelectorAll('a[href]')].filter(x=>x.innerText?.trim()&&tokens.every(t=>normalize(x.innerText).includes(t)));if(new Set(productLinks.map(x=>x.href)).size>1)break;
   rows.push({name:name.replace(/^Link zum Artikel\s*/i,''),url:url.href,text,price:Math.min(...monetary.map(m=>Number(m[1].replace(/\./g,'').replace(',','.')))),priceKind:/\bab\s+\d|\bfrom\s+\d/i.test(text)?'from':'exact'});break;
  }
 }
 return [...new Map(rows.map(x=>[x.url,x])).values()].slice(0,limit);
}

function readBikeDiscountCards({q,limit=8}){
 const normalize=s=>(s||'').toLowerCase().replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
 const tokens=/^\d{8,14}$/.test(q)?[]:normalize(q).split(' ').filter(Boolean);
 const rows=[];
 for(const anchor of document.querySelectorAll('.product-title a[href]')){
  const name=(anchor.innerText||anchor.textContent||'').replace(/\s+/g,' ').trim();
  if(!tokens.every(t=>normalize(name).includes(t)))continue;
  const info=anchor.closest('.product-info');
  const priceElement=info?.querySelector('.product-price')?.cloneNode(true);
  priceElement?.querySelectorAll('.list-price').forEach(node=>node.remove());
  const text=priceElement?.textContent||'';
  const match=text.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
  if(!match)continue;
  const u=new URL(anchor.href,location.href);
  if(u.protocol!=='https:'||u.hostname.replace(/^www\./,'')!=='bike-discount.de')continue;
  rows.push({name,url:u.href,price:Number(match[1].replace(/\./g,'').replace(',','.')),priceKind:/\bab\b/i.test(text)?'from':'exact',text:info.innerText});
 }
 return [...new Map(rows.map(r=>[r.url,r])).values()].slice(0,limit);
}
