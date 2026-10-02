function deliverable(stock){
 const s=String(stock||'');
 if(/nicht|ausverkauft|out of stock|sold out|vorbestell|nachbestell|verfügbar (?:ab|in)|available (?:from|in)|unbekannt|nicht auslesbar/i.test(s))return false;
 return /auf lager|lagernd|ab lager|sofort lieferbar|in stock|available from stock|(?:Versand in|Lieferzeit:?|lieferbar in)\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:Werk|Arbeits)?tage[n]?|\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeits|Werk)tage[n]?/i.test(s);
}
function cheapestWishlist(items){
 const rows=items.map(item=>{
  const candidates=(item.shops||[]).flatMap(shop=>(shop.stale?[]:shop.offers||[]).filter(o=>Number.isFinite(o.price)&&o.price>0&&o.priceKind==='exact'&&deliverable(o.stock)&&(item.maxPrice===null||o.price<=item.maxPrice)&&variantMatches(o,item.variant)).map(o=>({...o,shop:shop.name})));
  candidates.sort((a,b)=>a.price-b.price);
  return {item,best:candidates[0]||null};
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
 return items.map(item=>{if(item.id!==id)return item;const shared=shareVariantEAN(mergeShopResults(item.shops||[],shops),item.variant,item.ean);return {...item,ean:shared.ean,shops:shared.shops,checkedAt};});
}

function mergeShopResults(previous,incoming){
 const byName=new Map(previous.map(shop=>[shop.name,shop]));
 for(const shop of incoming){const old=byName.get(shop.name);byName.set(shop.name,!shop.offers?.length&&old?.offers?.length?{...old,stale:true,done:true,message:'Vorherige Ergebnisse · aktuell nicht bestätigt. '+(shop.message||'')}:shop);}
 return [...byName.values()];
}

function wishlistShopEntries(items,name,activeId='',live=new Map()){
 return items.map(item=>({item,shop:(item.id===activeId?live.get(name):null)||(item.shops||[]).find(s=>s.name===name)||{name,offers:[],suggestions:[],message:'Noch nicht geprüft.'}}));
}
