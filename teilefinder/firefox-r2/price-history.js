// Price observations are keyed by search and confirmed EAN; repeated final messages update the same observation.
const historyHosts=new Set(['bike24.de','bike-discount.de','bike-components.de','r2-bike.com']);
function cleanPriceHistory(rows){
 if(!Array.isArray(rows)||rows.length>50000)throw Error('Ungültige Preishistorie.');
 return rows.map(row=>{
  if(!row||!/^\d{8,14}$/.test(row.ean)||!Number.isFinite(Date.parse(row.at))||!Array.isArray(row.offers))throw Error('Ungültiger Preisverlauf.');
  const offers=row.offers.map(o=>{let u;try{u=new URL(o.url);}catch{}if(!u||u.protocol!=='https:'||!historyHosts.has(u.hostname.replace(/^www\./,''))||!Number.isFinite(o.price)||o.price<=0||typeof o.shop!=='string')throw Error('Ungültiges historisches Angebot.');return {shop:o.shop.slice(0,80),price:o.price,url:u.href,stock:String(o.stock||'').slice(0,500)};});
  return {key:String(row.key||row.ean+'|'+row.at).slice(0,200),ean:row.ean,at:row.at,offers};
 });
}
function priceObservations(shops,searchId,at){
 const byEAN=new Map();
 for(const shop of shops){if(shop.stale||!shop.done)continue;for(const offer of shop.offers||[]){const ean=validEAN(offer.ean);if(!ean||offer.priceKind!=='exact'||!Number.isFinite(offer.price)||offer.price<=0||!deliverable(offer.stock))continue;const rows=byEAN.get(ean)||[];rows.push({shop:shop.name,price:offer.price,url:offer.url,stock:offer.stock});byEAN.set(ean,rows);}}
 return [...byEAN].map(([ean,offers])=>({key:searchId+'|'+ean,ean,at,offers:offers.sort((a,b)=>a.price-b.price)}));
}
const priceHistoryDB=(()=>{
 let pending;
 const open=()=>pending||(pending=new Promise((resolve,reject)=>{const request=indexedDB.open('teilefinder-price-history',1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore('observations',{keyPath:'key'});store.createIndex('ean','ean');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>{pending=null;reject(request.error);};}));
 return {
  async put(rows){const clean=cleanPriceHistory(rows);if(!clean.length)return;const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('observations','readwrite');for(const row of clean)tx.objectStore('observations').put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Speicherung abgebrochen'));});},
  async all(ean){const db=await open();return new Promise((resolve,reject)=>{const store=db.transaction('observations').objectStore('observations');const request=ean?store.index('ean').getAll(ean):store.getAll();request.onsuccess=()=>resolve(request.result.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)));request.onerror=()=>reject(request.error);});}
 };
})();
