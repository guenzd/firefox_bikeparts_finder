function variantMatches(offer,requested){
 if(!requested?.trim())return true;
 const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑–—]/g,'-');
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
  const escaped=token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?<![a-z0-9])'+escaped+'(?![a-z0-9])','i').test(text);
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
