function parsePriceRange(value){
 const text=String(value??'').trim();if(!text)return {minPrice:null,maxPrice:null};
 const match=text.match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:[-–]\s*(\d+(?:[.,]\d{1,2})?))?$/);
 if(!match)throw Error('Preis als Maximum oder Bereich eingeben, z. B. 10 oder 5-10.');
 const first=Number(match[1].replace(',','.')),second=match[2]===undefined?null:Number(match[2].replace(',','.'));
 if(!Number.isFinite(first)||second!==null&&(!Number.isFinite(second)||second<first))throw Error('Der Mindestpreis darf nicht über dem Maximum liegen.');
 return {minPrice:second===null?null:first,maxPrice:second===null?first:second};
}
function priceRangeText(item){return item.minPrice!=null?String(item.minPrice)+'-'+String(item.maxPrice):String(item.maxPrice??'');}
function withinPriceRange(price,item){return Number.isFinite(price)&&price>=(item.minPrice??0)&&price<=(item.maxPrice??Infinity);}
function priceFilteredSuggestions(suggestions,range){
 const bounded=range.minPrice!=null||range.maxPrice!=null;
 return suggestions.filter(o=>!bounded||withinPriceRange(o.price,range));
}
function inputPriceRange(input){try{const value=parsePriceRange(input.value);input.setCustomValidity('');return value;}catch(error){input.setCustomValidity(error.message);return null;}}
function deliverable(stock){
 const s=String(stock||'');
 if(/\bWochen?\b|nicht|ausverkauft|out of stock|sold out|vorbestell|nachbestell|(?:verfügbar|lieferbar|erhältlich)\s+(?:ab|in)|available (?:from|in)|unbekannt|nicht auslesbar/i.test(s))return false;
 return /auf lager|lagernd|ab lager|sofort lieferbar|in stock|available from stock|(?:Versand in|Lieferzeit:?|lieferbar in)\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:Werk|Arbeits)?tage[n]?|\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeits|Werk)tage[n]?/i.test(s);
}
function cheapestWishlist(items){
 const rows=items.map(item=>{
  const matching=(item.shops||[]).flatMap(shop=>(shop.stale?[]:shop.offers||[]).filter(o=>Number.isFinite(o.price)&&o.price>0&&o.priceKind==='exact'&&variantMatches(o,item.variant)).map(o=>({...o,shop:shop.name})));
  const inRange=matching.filter(o=>withinPriceRange(o.price,item));
  const candidates=inRange.filter(o=>deliverable(o.stock));candidates.sort((a,b)=>a.price-b.price);
  const missingMessage=inRange.length?(inRange.some(o=>!o.stock||/nicht auslesbar|unbekannt/i.test(o.stock))?'Lagerstatus unbekannt':'Nicht lieferbar'):matching.length?'Kein passendes Angebot im Preisbereich':item.checkedAt?'Kein passendes Angebot':'Noch nicht geprüft';
  return {item,best:candidates[0]||null,missingMessage};
 });
 const total=Math.round(rows.reduce((sum,row)=>sum+(row.best?.price||0),0)*100)/100;
 return {rows,total,complete:rows.length>0&&rows.every(row=>!!row.best),missing:rows.filter(row=>!row.best).length};
}

function renameWishlistItem(items,id,query){
 const name=query.trim();
 if(!name||name.length>160)throw Error('Ungültiger Produktname');
 return items.map(item=>item.id===id&&item.query!==name?{...item,query:name,shops:[],checkedAt:null}:item);
}

function applyWishlistSearch(items,id,shops,checkedAt){
 return items.map(item=>{if(item.id!==id)return item;const shared=shareVariantEAN(mergeShopResults(item.shops||[],shops),item.variant,item.useEAN===false?'':item.ean);return {...item,ean:item.useEAN===false?(item.ean||shared.ean):shared.ean,shops:shared.shops,checkedAt};});
}

function mergeShopResults(previous,incoming){
 const byName=new Map(previous.map(shop=>[shop.name,shop]));
 for(const shop of incoming){const old=byName.get(shop.name);byName.set(shop.name,!shop.offers?.length&&old?.offers?.length?{...old,stale:true,done:true,message:'Vorherige Ergebnisse · aktuell nicht bestätigt. '+(shop.message||'')}:shop);}
 return [...byName.values()];
}

function wishlistShopEntries(items,name,activeId='',live=new Map()){
 return items.map(item=>({item,shop:(item.id===activeId?live.get(name):null)||(item.shops||[]).find(s=>s.name===name)||{name,offers:[],suggestions:[],message:'Noch nicht geprüft.'}}));
}

// Reuse known product URLs for direct EAN searches as well as wishlist refreshes.
// These are hints only: the background reader verifies the EAN again on the page.
function knownSearchShops(current,items,ean){
 const groups=new Map(current.map(shop=>[shop.name,{name:shop.name,offers:[...(shop.offers||[])]}]));
 if(validEAN(ean))for(const item of items)for(const shop of item.shops||[]){
  const offers=(shop.offers||[]).filter(o=>validEAN(o.ean)===ean);
  if(!offers.length)continue;
  if(!groups.has(shop.name))groups.set(shop.name,{name:shop.name,offers:[]});
  groups.get(shop.name).offers.push(...offers);
 }
 return [...groups.values()].map(shop=>({...shop,offers:uniqueOffers(shop.offers)}));
}


function wishlistPriceRows(entries,item){
 return entries.flatMap(({shop})=>uniqueOffers(shop?.offers||[]).filter(offer=>withinPriceRange(offer.price,item)&&variantMatches(offer,item.variant)).map(offer=>({shop,offer}))).sort((a,b)=>a.offer.price-b.offer.price||a.shop.name.localeCompare(b.shop.name));
}
