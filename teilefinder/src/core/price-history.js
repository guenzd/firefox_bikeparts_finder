// Price observations are keyed by search and confirmed EAN; repeated final messages update the same observation.
const historyHosts=new Set(['bike24.de','bike-discount.de','bike-components.de','r2-bike.com']);
function cleanPriceHistory(rows){
 if(!Array.isArray(rows)||rows.length>50000)throw Error('Ungültige Preishistorie.');
 return rows.map(row=>{
  if(!row||!/^\d{8,14}$/.test(row.ean)||!Number.isFinite(Date.parse(row.at))||!Array.isArray(row.offers))throw Error('Ungültiger Preisverlauf.');
  const offers=row.offers.map(o=>{let u;try{u=new URL(o.url);}catch{}if(!u||u.protocol!=='https:'||!historyHosts.has(u.hostname.replace(/^www\./,''))||!Number.isFinite(o.price)||o.price<=0||typeof o.shop!=='string')throw Error('Ungültiges historisches Angebot.');return {shop:o.shop.slice(0,80),price:o.price,url:cleanShopUrl(u.href),stock:String(o.stock||'').slice(0,500)};});
  return {key:String(row.key||row.ean+'|'+row.at).slice(0,200),ean:row.ean,at:row.at,offers};
 });
}
function priceObservations(shops,searchId,at){
 const byEAN=new Map();
 for(const shop of shops){if(shop.stale||!shop.done)continue;for(const offer of shop.offers||[]){const ean=validEAN(offer.ean);if(!ean||offer.eanEvidence==='datasheet'||offer.priceKind!=='exact'||!Number.isFinite(offer.price)||offer.price<=0||!deliverable(offer.stock))continue;const key=gtinKey(ean),entry=byEAN.get(key)||{ean,offers:[]};entry.offers.push({shop:shop.name,price:offer.price,url:cleanShopUrl(offer.url),stock:offer.stock});byEAN.set(key,entry);}}
 return [...byEAN.values()].map(({ean,offers})=>({key:searchId+'|'+ean,ean,at,offers:offers.sort((a,b)=>a.price-b.price)}));
}
// Show the daily minimum, then keep endpoints of each unchanged-price run.
// Stored observations remain complete for exports and future views.
function priceHistoryPoints(rows){
 const daily=new Map();
 for(const row of rows){
  if(!row.offers.length)continue;
  const at=Date.parse(row.at),date=new Date(at),day=[date.getFullYear(),date.getMonth(),date.getDate()].join('-');
  const point={at,price:Math.min(...row.offers.map(offer=>offer.price)),row},previous=daily.get(day);
  if(!previous||point.price<previous.price||(point.price===previous.price&&at>previous.at))daily.set(day,point);
 }
 const points=[...daily.values()].sort((a,b)=>a.at-b.at);
 const cents=point=>Math.round(point.price*100);
 return points.filter((point,index)=>index===0||index===points.length-1||cents(point)!==cents(points[index-1])||cents(point)!==cents(points[index+1]));
}
