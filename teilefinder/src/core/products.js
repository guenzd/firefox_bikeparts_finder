// Extraction helpers shared with Teilefinder.
function safeUrl(value,host){try{const u=new URL(value,'https://'+host);return u.protocol==='https:' && u.hostname.replace(/^www\./,'')===host.replace(/^www\./,'') ? u.href : null;}catch{return null;}}
function euro(value){if(typeof value==='number')return Number.isFinite(value)&&value>0?Math.round(value*100)/100:null;const text=String(value??'').replace(/\s/g,'');const n=Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;}
function productNameText(value){return String(value||'').toLowerCase().replace(/['’‘`´ʼ]/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑–—-]/g,' ').replace(/\s+/g,' ').trim();}
// Strong model identifiers survive shop-specific series and marketing names.
// No brand/product dictionary: require an exact model, matching brand prefix and
// shared descriptive words; accessory/compatibility references are not products.
function productModelCodes(text){
 return [...new Set(String(text||'').replace(/[‐‑–—]/g,'-').match(/\b[a-z]{1,8}(?:-[a-z]{1,8})*-?\d{2,}[a-z0-9-]*\b/gi)||[])];
}
function hasModelCode(name,code){
 const parts=code.toLowerCase().match(/[a-z]+|\d+/g)||[];
 return parts.length>1&&new RegExp('(?<![a-z0-9])'+parts.join('[\\s-]*')+'(?![a-z0-9])','i').test(productNameText(name));
}
function modelSearchQuery(query){
 const models=productModelCodes(query),brand=String(query||'').trim().split(/\s+/)[0];
 return models.length&&/^[a-zäöüß]+$/i.test(brand)?[brand,...models.filter(model=>model.toLowerCase()!==brand.toLowerCase())].join(' '):null;
}
function modelNameMatches(name,query){
 const models=productModelCodes(query);if(!models.length)return false;
 if(!models.every(code=>hasModelCode(name,code)))return false;
 const title=productNameText(name).split(/[^a-z0-9]+/).filter(Boolean),wanted=productNameText(query).split(/[^a-z0-9]+/).filter(Boolean);
 const brand=wanted[0];if(!brand||title[0]!==brand&&title.slice(0,2).join('')!==brand)return false;
 if(/\b(?:fur|for|kompatibel|compatible|passend|bundle|set)\b/.test(productNameText(name)))return false;
 const modelWords=new Set(models.flatMap(code=>productNameText(code).split(/[^a-z0-9]+/)));
 const descriptions=wanted.slice(1).filter((word,index)=>/^[a-z]{3,}$/.test(word)&&!modelWords.has(word)&&!/^\d+$/.test(wanted[index]));
 return !descriptions.length||descriptions.some(word=>title.includes(word));
}
function matches(name,q){
 const text=productNameText(name),query=productNameText(q),words=text.split(/[^a-z0-9]+/).filter(Boolean);
 if(/\b(?:bundle|set|\d+er\s+set)\b/.test(text)&&!/\b(?:bundle|set|\d+er\s+set)\b/.test(query))return false;
 // Tokenize both sides equally: punctuation in a brand/title is a separator,
 // not a required word. Model identifiers are still checked separately below.
 const requested=query.split(/[^a-z0-9]+/).filter(Boolean);
 if(!requested.length)return !query;
 if(!productModelCodes(q).every(code=>hasModelCode(name,code)))return false;
 const acronym=(token,tokens)=>/^[a-z]{2,4}$/.test(token)&&tokens.some((_,i)=>tokens.slice(i,i+token.length).length===token.length&&tokens.slice(i,i+token.length).every((word,j)=>/^[a-z]{3,}$/.test(word)&&word[0]===token[j]));
 return requested.every((token,index)=>{
  if(words.includes(token)||acronym(token,words))return true;
  // A pack count is meaningful even when attached to its per-item size (24x50g).
  // Keep numeric model identifiers and different counts strict.
  if(/^\d+$/.test(token)&&[...text.matchAll(/(?:^|[^a-z0-9])(\d+)\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/g)].some(m=>m[1]===token))return true;
  // Accept abbreviations of consecutive words without a vocabulary of product names.
  for(let length=2;length<=4;length++)for(let start=Math.max(0,index-length+1);start<=index;start++){
   const phrase=requested.slice(start,start+length);
   if(phrase.length===length&&phrase.every(word=>/^[a-z]{3,}$/.test(word))&&words.includes(phrase.map(word=>word[0]).join('')))return true;
  }
  return token.length>2&&text.includes(token);
 })||modelNameMatches(name,q);
}
function stockText(text){if(/benachrichtigen\s+Sie\s+mich,?\s+sobald\s+der\s+Artikel\s+lieferbar\s+ist/i.test(String(text||'')))return 'Nicht lieferbar';const patterns=[/\b(?:in\s+(?:ca\.?\s*)?|(?:Lieferzeit|lieferbar)\s*:?\s*(?:in\s*)?(?:ca\.?\s*)?)\d+(?:\s*[-–]\s*\d+)?\s*Wochen?\b/i,/\bin\s+(?:ca\.?\s*)?\d+(?:\s*[-–]\s*\d+)?\s*Tagen?\b/i,/(?:Lagernd,\s*Lieferzeit\s*\d+(?:\s*[-–]\s*\d+)?\s*Tage)/i,/(?:nicht (?:mehr )?(?:lieferbar|verfügbar|auf lager)|ausverkauft|out of stock)/i,/(?:verfügbar|lieferbar|erhältlich)\s+ab\s+(?:dem\s+)?\d{1,2}\.\s*\d{1,2}\.(?:[ \t]*\d{4})?/i,/(?:verfügbar (?:ab|in) [^\n.;]{1,65}|available (?:from|in) [^\n.;]{1,65})/i,/(?:ab lager verfügbar|sofort lieferbar|lagernd|auf lager|in stock|available from stock)/i,/(?:Versand in|Lieferzeit:?|delivery time:?|lieferbar in)\s*[^\n.;]{1,65}/i,/\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeitstage|Werktage|working days)\b/i];for(const re of patterns){const m=text.match(re);if(m)return m[0].trim();}return 'Lagerstatus nicht auslesbar';}
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
    if(!matches(name,q)&&!equivalentEANs(ean,q)&&!['sku','mpn'].some(k=>String(p[k]||'')===q))continue;
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
