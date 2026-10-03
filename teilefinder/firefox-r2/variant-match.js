function variantMatches(offer,requested){
 if(!requested?.trim())return true;
 const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑–—]/g,'-').replace(/\bblack\b/g,'schwarz').replace(/\bwhite\b/g,'weiss').replace(/[()\[\]]/g,' ').replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:liter|litre|liters|litres|l)\b/gi,(_,n)=>String(Math.round(Number(n.replace(',','.'))*1000*1000)/1000)+'ml');
 // Listing link text can contain prices; prices must never count as dimensions.
 const name=String(offer.name||'').split(/\bUVP\b|\d{1,5}(?:\.\d{3})*,\d{2}\s*€/i)[0];
 const text=normalize(name+' '+(offer.variant||''));
 const wanted=normalize(requested).replace(/(\d)\s+(mm|cm|ml|inch)\b/g,'$1$2').split(/\s+/).filter(Boolean);
 return wanted.every(token=>{
  const dimension=token.match(/^(\d+(?:[.,]\d+)?)(mm|cm|ml|inch)?$/);
  if(dimension){
   const number=dimension[1].replace(',','.');const numeric=Number(number);
   const value=String(numeric).replace('.', '[.,]');
   const decimals=Number.isInteger(numeric)?'(?:[.,]0+)?':'';
   const re=new RegExp('(?<![\\d.,])'+value+decimals+'(?![\\d.,])','i');
   let evidence=text;
   const selected=normalize(offer.variant||'');
   const explicitUnit=dimension[2]&&new RegExp('\\d\\s*'+dimension[2]+'\\b','i').test(selected);
   if(explicitUnit||/breite|width/.test(selected))evidence=selected;
   const occurrences=[...evidence.matchAll(new RegExp(re.source,'gi'))];
   return occurrences.some(m=>{const unit=evidence.slice(m.index+m[0].length).match(/^\s*(mm|cm|ml|inch)\b/)?.[1];return !dimension[2]||!unit||unit===dimension[2];});
  }
  if(token==='schwarz'&&/schwarz\s*[\/|\-]\s*(?:transparent|braun|tan)/.test(text)&&!wanted.includes('transparent'))return false;
  const escaped=token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp('(?<![a-z0-9])'+escaped+'(?![a-z0-9])','i').test(text))return true;
  return /^[a-z]{3,}$/.test(token)&&text.split(/[^a-z]+/).some(word=>word.length===token.length&&[...token].some((_,i)=>i+1<token.length&&token.slice(0,i)+token[i+1]+token[i]+token.slice(i+2)===word));
 });
}

// Keep an explicitly requested variant out of the base product-name search.
function productSearchQuery(query,variant){
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const tokens=String(variant||'').trim().match(/\d+(?:[.,]\d+)?|[a-zäöüß]+/gi)||[];
 if(!tokens.length)return query.trim();
 const pattern=tokens.map(escape).join('\\s*');
 const cleaned=query.replace(new RegExp('(?<![a-z0-9])'+pattern+'(?![a-z0-9])','gi'),' ').replace(/\s+/g,' ').trim();
 return cleaned||query.trim();
}

function validEAN(value){const text=String(value||'').trim();return /^\d{8,14}$/.test(text)?text:'';}
// Share only one unambiguous identifier for the requested, confirmed variant.
function shareVariantEAN(shops,requested,known=''){
 const candidates=shops.filter(s=>!s.stale).flatMap(s=>s.offers||[]).filter(o=>o.priceKind==='exact'&&variantMatches(o,requested));
 const identifiers=[...new Set(candidates.map(o=>validEAN(o.ean)).filter(Boolean))];
 const ean=validEAN(known)||(identifiers.length===1?identifiers[0]:'');
 if(!ean||identifiers.length!==1||identifiers.some(value=>value!==ean))return {ean:validEAN(known),shops};
 if(!requested?.trim())return {ean,shops};
 return {ean,shops:shops.map(shop=>({...shop,offers:(shop.offers||[]).map(o=>!shop.stale&&o.priceKind==='exact'&&variantMatches(o,requested)&&!validEAN(o.ean)?{...o,ean}:o)}))};
}

function offerIdentity(offer){
 try{
  const url=new URL(offer.url);url.hash='';
  for(const key of [...url.searchParams.keys()])if(/^(?:origin|utm_.+|gclid|fbclid)$/i.test(key))url.searchParams.delete(key);
  if(url.hostname.replace(/^www\./,'')==='bike24.de'){
   // Each BIKE24 product path identifies its linked execution; tracking and
   // listing labels do not create another offer. Native selections still do.
   const selection=(offer.selection||[]).map(s=>[s.id,s.value]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
   return url.origin+url.pathname+'|'+JSON.stringify(selection);
  }
  url.searchParams.sort();return url.href+'|'+String(offer.variant||'').trim();
 }catch{return String(offer.url)+'|'+String(offer.variant||'');}
}
function uniqueOffers(offers){
 const rows=new Map();
 const quality=o=>(o.source?.includes('Produkt')?8:0)+(o.priceKind==='exact'?4:0)+(validEAN(o.ean)?2:0)+(o.stock&&!/nicht auslesbar|unbekannt/i.test(o.stock)?1:0);
 for(const offer of offers){const key=offerIdentity(offer),old=rows.get(key);if(!old||quality(offer)>quality(old))rows.set(key,offer);}
 return [...rows.values()];
}
