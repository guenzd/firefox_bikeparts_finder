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
// Use exactly the offers displayed in shop lists. This is presentation only:
// completion flags, freshness and EAN metadata do not change whether a row exists.
function allShopsHaveDisplayedOffers(shops,item={}){
 return ['BIKE24','Bike-Discount','bike-components','r2-bike'].every(name=>
  (shops.find(shop=>shop.name===name)?.offers||[]).some(offer=>
   Number.isFinite(offer.price)&&withinPriceRange(offer.price,item)&&variantMatches(offer,item.variant)));
}

// Retain all candidates in storage; presentation follows the current filters.
function displayedShopOffers(shop,item={}){
 const rows=uniqueOffers(shop.offers||[]).filter(offer=>Number.isFinite(offer.price)&&withinPriceRange(offer.price,item)&&variantMatches(offer,item.variant));
 if(shop.comparisonMode!=='cheapest')return rows;
 const exact=rows.filter(offer=>offer.priceKind==='exact');
 const available=exact.filter(offer=>deliverable(offer.stock));
 // Unavailable matches stay inspectable if this shop has no deliverable offer.
 return (available.length?available:exact).sort((a,b)=>a.price-b.price).slice(0,1);
}

function cheapestWishlist(items){
 const rows=items.map(item=>{
  const matching=(item.shops||[]).flatMap(shop=>(shop.stale?[]:shop.offers||[]).filter(o=>Number.isFinite(o.price)&&o.price>0&&o.priceKind==='exact'&&variantMatches(o,item.variant)).map(o=>({...o,shop:shop.name})));
  const inRange=matching.filter(o=>withinPriceRange(o.price,item));
  const candidates=inRange.filter(o=>deliverable(o.stock));candidates.sort((a,b)=>a.price-b.price);
  const missingMessage=inRange.length?(inRange.some(o=>!o.stock||/nicht auslesbar|unbekannt/i.test(o.stock))?'Lagerstatus unbekannt':'Nicht lieferbar'):matching.length?'Kein passendes Angebot im Preisbereich':item.checkedAt?'Kein passendes Angebot':'Noch nicht geprüft';
  return {item,best:candidates[0]||null,availableShops:new Set(candidates.map(offer=>offer.shop)).size,missingMessage};
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
 return items.map(item=>{if(item.id!==id)return item;const shared=shareVariantEAN(mergeShopResults(item.shops||[],shops),item.variant,item.useEAN===false?'':item.ean);return {...item,ean:item.useEAN===false?(item.ean||shared.ean):shared.ean,shops:filterConflictingEANs(shared.shops,item.useEAN===false?'':shared.ean),checkedAt};});
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
 const groups=new Map(current.map(shop=>[shop.name,{name:shop.name,comparisonMode:shop.comparisonMode,offers:[...(shop.offers||[])]}]));
 if(validEAN(ean))for(const item of items)for(const shop of item.shops||[]){
  const offers=(shop.offers||[]).filter(o=>validEAN(o.ean)===ean);
  if(!offers.length)continue;
  if(!groups.has(shop.name))groups.set(shop.name,{name:shop.name,offers:[]});
  groups.get(shop.name).offers.push(...offers);
 }
 return [...groups.values()].map(shop=>({...shop,offers:uniqueOffers(shop.offers)}));
}


function wishlistPriceRows(entries,item){
 return entries.flatMap(({shop})=>displayedShopOffers(shop||{},item).map(offer=>({shop,offer}))).sort((a,b)=>a.offer.price-b.offer.price||a.shop.name.localeCompare(b.shop.name));
}


function shopWishlistSummary(entries){
 let total=0,available=0;
 for(const {item,shop} of entries){
  const prices=(shop.stale?[]:shop.offers||[]).filter(offer=>offer.priceKind==='exact'&&withinPriceRange(offer.price,item)&&variantMatches(offer,item.variant)&&deliverable(offer.stock)).map(offer=>offer.price);
  if(prices.length){total+=Math.min(...prices);available++;}
 }
 return {total:Math.round(total*100)/100,available,count:entries.length};
}
