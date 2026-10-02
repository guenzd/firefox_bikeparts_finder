const shops=[{id:'bike24',name:'BIKE24',host:'www.bike24.de',search:q=>'https://www.bike24.de/suchergebnis?searchTerm='+encodeURIComponent(q)},{id:'bike-discount',name:'Bike-Discount',host:'www.bike-discount.de',search:q=>'https://www.bike-discount.de/de/search?search='+encodeURIComponent(q)},{id:'bike-components',name:'bike-components',host:'www.bike-components.de',search:q=>'https://www.bike-components.de/de/s/?keywords='+encodeURIComponent(q)},{id:'r2-bike',name:'r2-bike',host:'r2-bike.com',search:q=>'https://r2-bike.com/?qs='+encodeURIComponent(q.replace(/['’‘`´ʼ]/g,''))}];
const jobs=new Map(),shopTabs=new Map();
async function shopTab(source,shop,url,active=false){
 const key=source+":"+shop.id,existing=shopTabs.get(key);
 if(existing!==undefined){try{const tab=await browser.tabs.get(existing);const host=new URL(tab.url).hostname.replace(/^www\./,"");if(host===shop.host.replace(/^www\./,""))return await browser.tabs.update(existing,{url,active});}catch{}shopTabs.delete(key);}
 const tab=await browser.tabs.create({url,active});shopTabs.set(key,tab.id);return tab;
}
browser.browserAction.onClicked.addListener(()=>browser.tabs.create({url:browser.runtime.getURL('home.html')}));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function boundedMessage(tab,data,ms=15000){
 let timer;return Promise.race([browser.tabs.sendMessage(tab,data),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Antwort dauert zu lange')),ms);})]).finally(()=>clearTimeout(timer));
}
browser.runtime.onMessage.addListener((data,sender)=>{
 if(!sender.tab||sender.url!==browser.runtime.getURL('home.html'))return;
 if(data?.type==='cancel'){jobs.delete(sender.tab.id);return Promise.resolve({cancelled:true});}
 if(data?.type!=='search'||typeof data.query!=='string'||!data.query.trim()||data.query.length>160||typeof data.id!=='string')return;
 if(data.variant!==undefined&&(typeof data.variant!=='string'||data.variant.length>100))return;
 const job={id:data.id,query:validEAN(data.ean)||productSearchQuery(data.query,(data.variant||'')),variant:(data.variant||'').trim(),source:sender.tab.id,results:new Map(),counts:new Map()};jobs.set(job.source,job);
 void searchAll(job).finally(()=>{if(jobs.get(job.source)===job)jobs.delete(job.source);});
 return Promise.resolve({accepted:true});
});
function listingOfferComplete(offer,requested){
 return offer.priceKind==='exact'&&Number.isFinite(offer.price)&&variantMatches(offer,requested)&&offer.stock&&!/nicht auslesbar|unbekannt/i.test(offer.stock)&&!/Ausführung im Shop prüfen/i.test(offer.variant||'');
}
function listingVariantConflict(offer,requested){
 if(!requested?.trim()||/Ausführung im Shop prüfen/i.test(offer.variant||''))return false;
 const text=String(offer.name||'')+' '+String(offer.variant||'');
 const width=requested.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*mm\b/i);
 // A missing width or color needs detail inspection. Reject only evidence
 // of an actual different execution, never an unconfirmed listing.
 if(width&&/\d+(?:[.,]\d+)?\s*mm\b|\d+\s*-\s*(?:622|584)\b|\d+\s*x\s*\d+[cCbB]\b/.test(text)&&!variantMatches(offer,width[1]+' mm'))return true;
 if(/\bschwarz\b/i.test(requested)&&/schwarz\s*[\/|\-]\s*transparent|transparent.edition/i.test(text)&&!/transparent/i.test(requested))return true;
 return false;
}
async function searchAll(job){
 await Promise.all(shops.map(shop=>run(job,shop)));
 if(jobs.get(job.source)!==job)return;
 const shared=shareVariantEAN([...job.results.values()],job.variant,validEAN(job.query));
 if(shared.ean&&shared.ean!==job.query){
  await Promise.all(shops.filter(shop=>(job.counts.get(shop.id)||0)>1).map(async shop=>{
   const previous=job.results.get(shop.id);
   await browser.runtime.sendMessage({...previous,type:'status',message:'Mehrere Treffer: Suche wird mit EAN '+shared.ean+' eingegrenzt.'}).catch(()=>{});
   await run(job,shop,shared.ean);
   const next=job.results.get(shop.id);
   if(!next?.offers?.length&&previous?.offers?.length)job.results.set(shop.id,{...previous,message:'EAN-Suche ohne bestätigten Treffer. Angebote der Namenssuche bleiben erhalten.'});
  }));
 }
 if(jobs.get(job.source)!==job)return;
 const final=shareVariantEAN([...job.results.values()],job.variant,shared.ean);
 for(const result of final.shops)await browser.runtime.sendMessage(result).catch(()=>{});
}
async function run(job,shop,searchQuery=job.query){
 const send=async data=>{const requestedEAN=validEAN(searchQuery);if(requestedEAN){data={...data,offers:(data.offers||[]).filter(o=>validEAN(o.ean)===requestedEAN),suggestions:[]};}const payload={...data,target:job.source,id:job.id,query:searchQuery,shop:shop.name,url:shop.search(searchQuery)};if(data.type==='result'){job.results.set(shop.id,payload);await browser.runtime.sendMessage({...payload,type:'partial-result'}).catch(()=>{});return;}await browser.runtime.sendMessage(payload).catch(()=>{});};
 try{
  const tab=await shopTab(job.source,shop,shop.search(searchQuery));
  let previous='',stable=0,last,broadened=false,emptyReads=0;
  for(let i=0;i<12&&jobs.get(job.source)===job;i++){
   await pause(2000);if(jobs.get(job.source)!==job)return;
   try{last=await boundedMessage(tab.id,{type:'extract',query:searchQuery,variant:job.variant,host:shop.host,shopId:shop.id});}catch{try{await browser.tabs.get(tab.id);}catch{throw Error('Tab geschlossen');}continue;}
   if(last.blocked){emptyReads=0;await send({type:'status',message:'Sicherheitsprüfung: Bitte den '+shop.name+'-Tab öffnen und dort selbst abschließen. Ergebnisse werden danach automatisch übernommen.'});continue;}
   last.offers=Array.isArray(last.offers)?last.offers:[];
   emptyReads=!last.offers.length&&!last.suggestions?.length?emptyReads+1:0;
   const signature=JSON.stringify([last.offers,last.suggestions]);stable=signature===previous?stable+1:0;previous=signature;
   if(last.offers.length&&stable>=1){
    job.counts.set(shop.id,last.offers.length);
    const rows=last.offers.sort((a,b)=>Number(variantMatches(b,job.variant))-Number(variantMatches(a,job.variant)));const variants=new Map();let limited=false;
    // Read missing delivery information on the actual product pages in the same Firefox session.
    const eanCandidate=['bike24','r2-bike'].includes(shop.id)?rows.find(row=>listingOfferComplete(row,job.variant)&&!validEAN(row.ean)):null;
    const inspect=rows.filter(row=>!listingVariantConflict(row,job.variant)&&(row===eanCandidate||!listingOfferComplete(row,job.variant)||(validEAN(searchQuery)&&validEAN(row.ean)!==searchQuery)));
    for(const row of inspect.slice(0,3)){
     if(jobs.get(job.source)!==job)return;
     await send({type:'status',message:'Produktdetails und Lieferangaben werden geprüft…'});
     await browser.tabs.update(tab.id,{url:row.url});
     for(let attempt=0;attempt<8;attempt++){
      await pause(750);
      try{const d=await boundedMessage(tab.id,{type:'detail',query:searchQuery,host:shop.host,url:row.url,shopId:shop.id,fallback:row,variant:job.variant,metadataOnly:['bike24','r2-bike'].includes(shop.id)&&listingOfferComplete(row,job.variant),followLinked:shop.id!=='bike24'||!rows.some(o=>listingOfferComplete(o,job.variant))},20000);if(d.blocked)break;if(d.ready){if(shop.id==='bike24'&&d.linkedVariants?.length){const extra=await bike24Linked(tab,shop,job,row,d,searchQuery);d.offers=extra.offers;d.limited ||= extra.limited;}limited ||= !!d.limited;if(d.offers?.length)variants.set(row,d.offers);else row.stock=d.stock;break;}}catch{}
     }
    }
    const expanded=uniqueOffers(rows.flatMap(row=>variants.get(row)||[row])),matching=expanded.filter(o=>variantMatches(o,job.variant)&&(!validEAN(searchQuery)||validEAN(o.ean)===searchQuery));
    if(validEAN(searchQuery)&&!matching.length){await send({type:'result',offers:[],message:'Kein Treffer mit bestätigter EAN '+searchQuery+'.'});return;}
    if(job.variant&&!matching.length){await send({type:'result',offers:[],suggestions:expanded.slice(0,12),variantAlternatives:true,message:'Produktname gefunden. Gewünschte Variante „'+job.variant+'“ nicht bestätigt. Gefundene Ausführungen:'});return;}
    await send({type:'result',offers:matching,message:limited?'Bis zu 24 Variantenkombinationen pro Produkt geprüft. Weitere Ausführungen bitte im Shop prüfen.':''});return;
   }
   if(!validEAN(searchQuery)&&!last.offers.length&&last.suggestions?.length&&stable>=1){
    const suggestions=await suggestionDetails(tab,shop,job,last.suggestions,send);
    await send({type:'result',offers:[],suggestions,message:'Kein genauer Treffer. Diese ähnlichen Produkte bitte prüfen.'});return;
   }
   if(stable>=2&&(last.empty||(emptyReads>=4&&last.ready)||emptyReads>=8)){const broader=validEAN(searchQuery)?null:broaderQuery(searchQuery);if(!broadened&&broader){broadened=true;emptyReads=0;previous='';stable=0;await send({type:'status',message:'Keine genauen Treffer. Ähnliche Produkte werden gesucht…'});await browser.tabs.update(tab.id,{url:shop.search(broader)});continue;}await send({type:'result',offers:[],message:'Keine passenden Angebote in der Shopsuche gefunden.'});return;}
  }
  if(jobs.get(job.source)===job)await send({type:'result',offers:last?.offers||[],message:last?.blocked?'Der Shop verlangt weiterhin eine Sicherheitsprüfung. Bitte dort abschließen und erneut suchen.':'Keine Angebote ausgelesen. Bitte Suchbegriff und sichtbare Shop-Ergebnisse prüfen.'});
 }catch{if(jobs.get(job.source)===job)await send({type:'result',offers:[],message:'Shop-Tab wurde geschlossen oder konnte nicht gelesen werden. Bitte erneut suchen.'});}
}

async function suggestionDetails(tab,shop,job,rows,send){
 const enriched=new Map();
 for(const row of rows.filter(o=>!validEAN(o.ean)&&!listingVariantConflict(o,job.variant)).slice(0,3)){
  if(jobs.get(job.source)!==job)break;
  await send({type:'status',message:'EAN und Ausführungen ähnlicher Produkte werden geprüft…'});
  await browser.tabs.update(tab.id,{url:row.url});
  for(let attempt=0;attempt<8&&jobs.get(job.source)===job;attempt++){
   await pause(750);
   try{
    const detail=await boundedMessage(tab.id,{type:'detail',query:row.name,host:shop.host,url:row.url,shopId:shop.id,fallback:row,variant:job.variant,followLinked:false},20000);
    if(detail.blocked)break;
    if(detail.ready){
     const offers=detail.offers||[],matching=offers.filter(o=>variantMatches(o,job.variant));
     if(offers.length)enriched.set(row,matching.length?matching:offers);
     break;
    }
   }catch{}
  }
 }
 return uniqueOffers(rows.flatMap(row=>enriched.get(row)||[row]));
}

async function bike24Linked(tab,shop,job,fallback,initial,searchQuery=job.query){
 const offers=[...(initial.offers||[])];let limited=!!initial.limited;
 for(const v of initial.linkedVariants.slice(0,24)){
  if(offers.length>=24){limited=true;break;}
  if(jobs.get(job.source)!==job)break;
  if(offers.some(o=>new URL(o.url).pathname===new URL(v.url).pathname))continue;
  await browser.tabs.update(tab.id,{url:v.url});
  for(let i=0;i<10;i++){
   await pause(1000);
   let d;try{d=await browser.tabs.sendMessage(tab.id,{type:'detail',query:searchQuery,host:shop.host,shopId:shop.id,url:v.url,followLinked:false,fallback:{...fallback,url:v.url,baseVariant:v.variant}});}catch{continue;}
   if(d.blocked)break;
   if(d.ready){offers.push(...(d.offers||[]));limited ||= !!d.limited;break;}
  }
 }
 return {offers:offers.slice(0,24),limited:limited||offers.length>24||initial.linkedVariants.length>24};
}
