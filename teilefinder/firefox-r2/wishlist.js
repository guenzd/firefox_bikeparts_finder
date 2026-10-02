function deliverable(stock){
 const s=String(stock||'');
 if(/nicht|ausverkauft|out of stock|sold out|vorbestell|nachbestell|verfügbar (?:ab|in)|available (?:from|in)|unbekannt|nicht auslesbar/i.test(s))return false;
 return /auf lager|lagernd|ab lager|sofort lieferbar|in stock|available from stock|(?:Versand in|Lieferzeit:?|lieferbar in)\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:Werk|Arbeits)?tage[n]?|\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeits|Werk)tage[n]?/i.test(s);
}
function cheapestWishlist(items){
 const rows=items.map(item=>{
  const candidates=(item.shops||[]).flatMap(shop=>(shop.offers||[]).filter(o=>Number.isFinite(o.price)&&o.price>0&&o.priceKind==='exact'&&deliverable(o.stock)&&(item.maxPrice===null||o.price<=item.maxPrice)&&variantMatches(o,item.variant)).map(o=>({...o,shop:shop.name})));
  candidates.sort((a,b)=>a.price-b.price);
  return {item,best:candidates[0]||null};
 });
 const total=Math.round(rows.reduce((sum,row)=>sum+(row.best?.price||0),0)*100)/100;
 return {rows,total,complete:rows.length>0&&rows.every(row=>!!row.best),missing:rows.filter(row=>!row.best).length};
}
