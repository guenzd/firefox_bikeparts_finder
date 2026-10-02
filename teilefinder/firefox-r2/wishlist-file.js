// Portable wishlist files contain search settings and cart repeat-prevention markers.
function wishlistFile(items){
 return JSON.stringify({format:'teilefinder-wishlist',version:1,exportedAt:new Date().toISOString(),items:items.map(({query,variant,maxPrice,cart})=>({query,variant:variant||'',maxPrice:maxPrice??null,...(cart?{cart}: {})}))},null,2);
}
function parseWishlistFile(text){
 if(text.length>2_000_000)throw Error('Die Datei ist zu groß.');
 const data=JSON.parse(text);
 if(data?.format!=='teilefinder-wishlist'||data.version!==1||!Array.isArray(data.items)||data.items.length>500)throw Error('Keine unterstützte Teilefinder-Wunschliste.');
 return data.items.map(item=>{
  if(!item||typeof item.query!=='string'||!item.query.trim()||item.query.length>160||typeof item.variant!=='string'||item.variant.length>100||!(item.maxPrice===null||Number.isFinite(item.maxPrice)&&item.maxPrice>=0))throw Error('Ein Artikel enthält ungültige Angaben.');
  const row={id:crypto.randomUUID(),query:item.query.trim(),variant:item.variant.trim(),maxPrice:item.maxPrice,shops:[],checkedAt:null};
  if(item.cart&&typeof item.cart.key==='string'&&item.cart.key.length<=2048&&(item.cart.clicked===true||item.cart.pending===true))row.cart={key:item.cart.key,clicked:item.cart.clicked===true,pending:item.cart.pending===true,message:'Warenkorb-Marker aus Sicherung übernommen.'};
  return row;
 });
}
function mergeWishlistFile(existing,imported){
 const key=item=>JSON.stringify([item.query.toLowerCase().trim(),(item.variant||'').toLowerCase().trim(),item.maxPrice??null]);
 const rows=[...existing],seen=new Map(rows.map(item=>[key(item),item]));
 for(const item of imported){const current=seen.get(key(item));if(current){if(!current.cart&&item.cart)current.cart=item.cart;}else{rows.push(item);seen.set(key(item),item);}}
 return rows;
}
