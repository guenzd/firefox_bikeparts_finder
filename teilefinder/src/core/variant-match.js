function variantMatches(offer,requested){
 if(!requested?.trim())return true;
 const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑–—]/g,'-').replace(/\bblack\b/g,'schwarz').replace(/\bwhite\b/g,'weiss').replace(/[()\[\]|;]/g,' ').replace(/(?<!\d),|,(?!\d)/g,' ').replace(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|mm|cm|inch)\b/g,'$1x$2$3').replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:liter|litre|liters|litres|l)\b/gi,(_,n)=>String(Math.round(Number(n.replace(',','.'))*1000*1000)/1000)+'ml');
 // Listing link text can contain prices; prices must never count as dimensions.
 const name=String(offer.name||'').split(/\bUVP\b|\d{1,5}(?:\.\d{3})*,\d{2}\s*€/i)[0];
 const selectedText=String(offer.variant||'').replace(/\d{1,5}(?:\.\d{3})*(?:[.,]\d{2})\s*(?:€|EUR\b)/gi,'');
 const text=normalize(name+' '+selectedText);
 const wanted=normalize(requested).replace(/(\d)\s+(mm|cm|ml|inch|g|kg)\b/g,'$1$2').split(/\s+/).filter(Boolean);
 return wanted.every(token=>{
  const dimension=token.match(/^(\d+(?:[.,]\d+)?)(mm|cm|ml|inch)?$/);
  if(dimension){
   const number=dimension[1].replace(',','.');const numeric=Number(number);
   const value=String(numeric).replace('.', '[.,]');
   const decimals=Number.isInteger(numeric)?'(?:[.,]0+)?':'';
   const re=new RegExp('(?<!'+(dimension[2]?'[\\d.,]':'[a-z0-9.,]')+')'+value+decimals+'(?![\\d.,])','i');
   let evidence=text;
   const selected=normalize(selectedText);
   const explicitUnit=dimension[2]&&new RegExp('\\d\\s*'+dimension[2]+'\\b','i').test(selected);
   const selectedNumbers=selected.replace(/\b(?:ean|gtin|upc)\s*:?\s*\d{8,14}\b/gi,'').replace(/\d+(?:[.,]\d+)?\s*(?:€|eur\b)/gi,'');
   const selectedHasNumber=/(?<![a-z0-9.,])\d+(?:[.,]\d+)?(?![a-z0-9.,])/i.test(selectedNumbers);
   if(explicitUnit||/breite|width/.test(selected)||!dimension[2]&&selectedHasNumber)evidence=selected;
   const occurrences=[...evidence.matchAll(new RegExp(re.source,'gi'))];
   return occurrences.some(m=>{const unit=evidence.slice(m.index+m[0].length).match(/^\s*(mm|cm|ml|inch)\b/)?.[1];return !dimension[2]||!unit||unit===dimension[2];});
  }
  if(token==='schwarz'&&/schwarz\s*[\/|\-]\s*(?:transparent|braun|tan)/.test(text)&&!wanted.includes('transparent'))return false;
  const escaped=token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp('(?<![a-z0-9])'+escaped+'(?![a-z0-9])','i').test(text))return true;
  if(!/^[a-z]{3,}$/.test(token))return false;
  return text.split(/[^a-z0-9]+/).some(word=>{
   if(!/^[a-z]+$/.test(word))return false;
   // Preserve adjacent-transposition support. Longer words additionally allow
   // one substitution, insertion or deletion, without a product vocabulary.
   if(word.length===token.length&&[...token].some((_,i)=>i+1<token.length&&token.slice(0,i)+token[i+1]+token[i]+token.slice(i+2)===word))return true;
   if(Math.min(word.length,token.length)<5||Math.abs(word.length-token.length)>1)return false;
   let i=0,j=0,edits=0;
   while(i<token.length&&j<word.length){
    if(token[i]===word[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(token.length>=word.length)i++;
    if(word.length>=token.length)j++;
   }
   return edits+(token.length-i)+(word.length-j)<=1;
  });
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
 const candidates=shops.filter(s=>!s.stale).flatMap(s=>s.offers||[]).filter(o=>o.eanEvidence!=='datasheet'&&o.priceKind==='exact'&&variantMatches(o,requested));
 const identifiers=[...new Set(candidates.map(o=>validEAN(o.ean)).filter(Boolean))];
 // A shop may list several executions. Only an identifier shared by every
 // shop that actually extracted identifiers is unambiguous; never vote by count.
 const perShop=shops.filter(s=>!s.stale).map(s=>[...new Set((s.offers||[]).filter(o=>o.eanEvidence!=='datasheet'&&o.priceKind==='exact'&&variantMatches(o,requested)).map(o=>validEAN(o.ean)).filter(Boolean))]).filter(ids=>ids.length);
 const common=perShop.length?perShop[0].filter(ean=>perShop.every(ids=>ids.includes(ean))):[];
 const ean=validEAN(known)||(common.length===1?common[0]:'');
 if(!ean||identifiers.length!==1||identifiers.some(value=>value!==ean))return {ean,shops};
 if(!requested?.trim())return {ean,shops};
 return {ean,shops:shops.map(shop=>({...shop,offers:(shop.offers||[]).map(o=>!shop.stale&&o.priceKind==='exact'&&variantMatches(o,requested)&&!validEAN(o.ean)?{...o,ean}:o)}))};
}

// Once an enabled EAN is established, an explicitly different identifier can
// never be restored as a matching offer. Unread identifiers stay unconfirmed.
function filterConflictingEANs(shops,ean){
 if(!validEAN(ean))return shops;
 const compatible=offer=>!validEAN(offer.ean)||validEAN(offer.ean)===ean;
 return shops.map(shop=>{
  const offers=(shop.offers||[]).filter(compatible);
  return {...shop,offers,suggestions:(shop.suggestions||[]).filter(compatible),
   ...((shop.offers||[]).length&&!offers.length?{message:'Keine Angebote mit EAN '+ean+'. Abweichende EAN ausgeschlossen.'}:{})};
 });
}

// Keep product/variant and search parameters; remove only referral and tracking metadata.
function cleanShopUrl(value){
 try{
  const url=new URL(value);
  for(const key of [...url.searchParams.keys()])if(/^(?:origin|ref|referrer|referer|referral|ref_.+|utm_.+|gclid|dclid|fbclid|msclkid|srsltid|mc_cid|mc_eid|affid|aff_id|affiliate|affiliateid|awc|zanpid|wt_mc|pk_campaign|pk_kwd|pk_source|pk_medium|tracking|trackingid)$/i.test(key))url.searchParams.delete(key);
  return url.href;
 }catch{return value;}
}
function cleanSavedUrls(value){
 if(Array.isArray(value))return value.map(cleanSavedUrls);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,row])=>[key,key==='url'&&typeof row==='string'?cleanShopUrl(row):cleanSavedUrls(row)]));
 return value;
}

function offerIdentity(offer){
 try{
  const url=new URL(cleanShopUrl(offer.url));url.hash='';
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
 for(const raw of offers){const offer={...raw,url:cleanShopUrl(raw.url)};const key=offerIdentity(offer),old=rows.get(key);if(!old||quality(offer)>quality(old))rows.set(key,offer);}
 return [...rows.values()];
}
