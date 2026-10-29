// GS1 GTIN identity: zero padding changes representation, not the product.
// Keep original strings for display, shop queries and stored user input.
function gtinKey(value){
 const text=String(value||'').trim();
 if(!/^\d{8,14}$/.test(text))return '';
 return [8,12,13,14].includes(text.length)?text.padStart(14,'0'):'raw:'+text;
}
function equivalentEANs(a,b){const key=gtinKey(a);return !!key&&key===gtinKey(b);}
function distinctEANs(values){
 const byIdentity=new Map();
 for(const value of values){const key=gtinKey(value);if(key&&!byIdentity.has(key))byIdentity.set(key,String(value).trim());}
 return [...byIdentity.values()];
}
// Try only an equivalent retail representation; never strip a packaging digit.
function alternateEAN(value){
 const text=String(value||'').trim();
 if(/^\d{12}$/.test(text))return '0'+text;
 if(/^0\d{12,13}$/.test(text))return text.slice(1);
 return '';
}
function eanRepresentations(value){
 const text=String(value||'').trim(),key=gtinKey(text);
 if(!key)return [];
 if(key.startsWith('raw:'))return [text];
 return [...new Set([text,key,...[13,12,8].filter(length=>key.slice(0,14-length)==='0'.repeat(14-length)).map(length=>key.slice(-length))])];
}
