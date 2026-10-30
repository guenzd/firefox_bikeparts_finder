const priceHistoryDB=(()=>{
 let pending;
 const open=()=>pending||(pending=new Promise((resolve,reject)=>{const request=indexedDB.open('teilefinder-price-history',1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore('observations',{keyPath:'key'});store.createIndex('ean','ean');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>{pending=null;reject(request.error);};}));
 return {
  async put(rows){const clean=cleanPriceHistory(rows);if(!clean.length)return;const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('observations','readwrite');for(const row of clean)tx.objectStore('observations').put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Speicherung abgebrochen'));});},
  async all(ean){const db=await open();return new Promise((resolve,reject)=>{const store=db.transaction('observations').objectStore('observations');const requests=ean?eanRepresentations(ean).map(value=>store.index('ean').getAll(value)):[store.getAll()];if(!requests.length){resolve([]);return;}const rows=new Map();let remaining=requests.length;for(const request of requests){request.onsuccess=()=>{for(const row of cleanPriceHistory(request.result))rows.set(row.key,row);if(!--remaining)resolve([...rows.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)));};request.onerror=()=>reject(request.error);}});}
 };
})();
