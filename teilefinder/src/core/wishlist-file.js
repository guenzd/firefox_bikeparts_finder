// Portable snapshots include wishlist results and the current search view.
function snapshotShops(shops){
 const hosts=new Set(['bike24.de','bike-discount.de','bike-components.de','r2-bike.com']);
 const url=value=>{try{const parsed=new URL(value);return parsed.protocol==='https:'&&hosts.has(parsed.hostname.replace(/^www\./,''))?cleanShopUrl(parsed.href):'';}catch{return '';}};
 const offer=o=>{if(!o||typeof o.name!=='string'||!url(o.url)||!Number.isFinite(o.price)||o.price<=0)return null;return {name:o.name.slice(0,1000),...(o.eanEvidence==='datasheet'?{eanEvidence:'datasheet'}:{}),variant:String(o.variant||'').slice(0,300),ean:/^\d{8,14}$/.test(String(o.ean||''))?String(o.ean):'',url:url(o.url),price:o.price,priceKind:o.priceKind==='from'?'from':'exact',stock:String(o.stock||'').slice(0,500),source:String(o.source||'').slice(0,200),...(Array.isArray(o.selection)?{selection:cleanVariantSelection(o.selection)}:{})};};
 return (Array.isArray(shops)?shops:[]).slice(0,4).filter(s=>s&&['BIKE24','Bike-Discount','bike-components','r2-bike'].includes(s.name)).map(s=>({name:s.name,...(s.comparisonMode==='cheapest'?{comparisonMode:'cheapest'}:{}),url:url(s.url),queriedEAN:validEAN(s.queriedEAN),offers:(Array.isArray(s.offers)?s.offers:[]).slice(0,100).map(offer).filter(Boolean),suggestions:(Array.isArray(s.suggestions)?s.suggestions:[]).slice(0,40).map(offer).filter(Boolean),checkedAt:typeof s.checkedAt==='string'&&Number.isFinite(Date.parse(s.checkedAt))?s.checkedAt:null,stale:!!s.stale,variantAlternatives:!!s.variantAlternatives,message:String(s.message||'').slice(0,2000),done:s.done===true}));
}
function wishlistFile(items,screen,history=[]){
 return JSON.stringify({format:'teilefinder-wishlist',version:2,history,exportedAt:new Date().toISOString(),items:items.map(({query,variant,maxPrice,minPrice,ean,useEAN,shops,checkedAt})=>({query,...(ean?{ean}:{}),useEAN:useEAN!==false,variant:variant||'',maxPrice:maxPrice??null,minPrice:minPrice??null,shops:snapshotShops(shops),checkedAt:checkedAt||null})),...(screen?{screen:{...screen,shops:snapshotShops(screen.shops)}}:{})},null,2);
}
function parseWishlistFile(text){
 if(text.length>20_000_000)throw Error('Die Datei ist zu groß.');
 const data=JSON.parse(text);
 if(data?.format!=='teilefinder-wishlist'||![1,2].includes(data.version)||!Array.isArray(data.items)||data.items.length>500)throw Error('Keine unterstützte Teilefinder-Wunschliste.');
 const rows=data.items.map(item=>{
  if(!item||typeof item.query!=='string'||!item.query.trim()||item.query.length>160||typeof item.variant!=='string'||item.variant.length>100||!(item.maxPrice===null||Number.isFinite(item.maxPrice)&&item.maxPrice>=0))throw Error('Ein Artikel enthält ungültige Angaben.');
  if(item.minPrice!=null&&(!Number.isFinite(item.minPrice)||item.minPrice<0||item.maxPrice===null||item.minPrice>item.maxPrice))throw Error('Ungültiger Preisbereich.');
  if(item.ean!==undefined&&item.ean!==''&&!/^\d{8,14}$/.test(String(item.ean)))throw Error('Ungültige EAN.');
  return {...(item.ean?{ean:String(item.ean)}:{}),useEAN:item.useEAN!==false,id:crypto.randomUUID(),query:item.query.trim(),variant:item.variant.trim(),maxPrice:item.maxPrice,minPrice:item.minPrice??null,shops:data.version===2?snapshotShops(item.shops):[],checkedAt:data.version===2&&typeof item.checkedAt==='string'&&Number.isFinite(Date.parse(item.checkedAt))?item.checkedAt:null};
 });
 if(data.version===2&&data.screen){const s=data.screen;if(s.minPrice!=null&&(!Number.isFinite(s.minPrice)||s.minPrice<0||s.maxPrice===null||s.minPrice>s.maxPrice))throw Error('Ungültiger Preisbereich.');if(typeof s.query!=='string'||s.query.length>160||typeof s.variant!=='string'||s.variant.length>100||!(s.maxPrice===null||Number.isFinite(s.maxPrice)&&s.maxPrice>=0)||s.ean&&!/^\d{8,14}$/.test(String(s.ean)))throw Error('Ungültige gespeicherte Suche.');rows.screen={wishlistDetails:!!s.wishlistDetails,query:s.query,variant:s.variant,ean:String(s.ean||''),useEAN:s.useEAN!==false,maxPrice:s.maxPrice,minPrice:s.minPrice??null,searchedQuery:typeof s.searchedQuery==='string'?s.searchedQuery.slice(0,160):s.query,searchedVariant:typeof s.searchedVariant==='string'?s.searchedVariant.slice(0,100):s.variant,shops:snapshotShops(s.shops)};}
 if(data.history!==undefined)rows.history=cleanPriceHistory(data.history);
 return rows;
}
function mergeWishlistFile(existing,imported){
 const key=item=>JSON.stringify([item.query.toLowerCase().trim(),(item.variant||'').toLowerCase().trim(),item.maxPrice??null,item.minPrice??null]);
 const rows=[...existing],seen=new Map(rows.map(item=>[key(item),item]));
 for(const item of imported){const current=seen.get(key(item));if(!current){rows.push(item);seen.set(key(item),item);}else{const restore=item.shops?.length&&(!current.shops?.length||Date.parse(item.checkedAt||0)>=Date.parse(current.checkedAt||0));const updated={...current,useEAN:item.useEAN!==false,...(!current.ean&&item.ean?{ean:item.ean}:{}),...(restore?{shops:item.shops,checkedAt:item.checkedAt}:{})};rows[rows.indexOf(current)]=updated;seen.set(key(item),updated);}}
 return rows;
}
