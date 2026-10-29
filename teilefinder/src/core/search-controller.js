// Local, bounded timing summaries with requested product identity. No product URLs.
const searchProfiles=[];
const profileNow=()=>typeof performance!=='undefined'?performance.now():Date.now();
function getSearchProfiles(){return JSON.parse(JSON.stringify(searchProfiles));}
function searchProfile(job){const root=job.root||job;return root.profile||(root.profile={started:profileNow(),shops:{}});}
async function profileStep(job,shop,phase,work){
 const profile=searchProfile(job),entry=profile.shops[shop.id]||(profile.shops[shop.id]={});
 const timer=profileNow();try{return await work();}finally{const row=entry[phase]||(entry[phase]={calls:0,ms:0});row.calls++;row.ms=Math.round((row.ms+profileNow()-timer)*100)/100;}
}
function finishSearchProfile(job){const profile=searchProfile(job);searchProfiles.push({productName:job.productName||job.nameQuery||job.query||'',ean:job.knownEAN||'',variant:job.variant||'',useEAN:job.useEAN!==false,elapsedMs:Math.round(profileNow()-profile.started),shops:JSON.parse(JSON.stringify(profile.shops))});if(searchProfiles.length>20)searchProfiles.shift();}
const shopPause=(job,shop,ms)=>profileStep(job,shop,'wait',()=>pause(ms));
function recordReadError(entry,error){
 const message=String(error?.message||'');
 const kind=error?.code==='REMOTE_SCRIPT_ERROR'?'readerError':/Zeitlimit|dauert zu lange|timed? ?out/i.test(message)?'timeout':/receiving end does not exist|could not establish connection|no matching message handler/i.test(message)?'noReceiver':/message (?:port|manager).*closed|disconnected|went out of scope/i.test(message)?'disconnected':'other';
 const kinds=entry.errorKinds||(entry.errorKinds={});kinds[kind]=(kinds[kind]||0)+1;
 if(kind==='readerError'&&error.info){
  const info=error.info,details=entry.readerErrors||(entry.readerErrors={});
  const label=[info.name,info.site,info.signature].filter(Boolean).join(' · ');
  if(label&&(Object.keys(details).length<8||label in details))details[label]=(details[label]||0)+1;
 }
}
const shopMessage=(job,shop,tab,data,ms)=>profileStep(job,shop,data.type==='extract'?'listing':'detail',async()=>{
 const entry=searchProfile(job).shops[shop.id],outcomes=entry.outcomes||(entry.outcomes={});
 try{const result=await boundedMessage(tab,data,ms);const status=!result?'noResponse':result.blocked?'blocked':result.ready?'ready':'notReady';outcomes[status]=(outcomes[status]||0)+1;if(['optionsMissing','noMatchingOption','selectionUnconfirmed','priceMissing','fromPrice','stockMissing','selectionUnsettled'].includes(result?.readIssue)){const issues=entry.readIssues||(entry.readIssues={});issues[result.readIssue]=(issues[result.readIssue]||0)+1;}if(result?.pageMatchesRequested===false)outcomes.pageMismatch=(outcomes.pageMismatch||0)+1;return result;}
 catch(error){outcomes.errors=(outcomes.errors||0)+1;recordReadError(entry,error);throw error;}
});
const navigateShop=(job,shop,tab,url)=>profileStep(job,shop,'navigation',()=>searchPlatform.tabs.update(tab,{url}));
const jobs=new Map(),shopTabs=new Map(),tabSessions=new Map();
async function shopTab(source,shop,url,active=false){
 const session=tabSessions.get(source)||{};tabSessions.set(source,session);
 const current=()=>tabSessions.get(source)===session;
 const key=source+":"+shop.id,existing=shopTabs.get(key);
 if(existing!==undefined){
  try{
   const tab=await searchPlatform.tabs.get(existing);if(!current())throw Error('Shop-Tabs geschlossen');
   const host=new URL(tab.pendingUrl||tab.url).hostname.replace(/^www\./,"");
   if(host===shop.host.replace(/^www\./,""))return await searchPlatform.tabs.update(existing,{url,active});
  }catch{}
  if(!current())throw Error('Shop-Tabs geschlossen');shopTabs.delete(key);
 }
 const tab=await searchPlatform.tabs.create({url,active});
 if(!current()){await searchPlatform.tabs.remove(tab.id).catch(()=>{});throw Error('Shop-Tabs geschlossen');}
 shopTabs.set(key,tab.id);return tab;
}
async function closeShopTabs(source){
 jobs.delete(source);tabSessions.delete(source);
 const ids=[];for(const [key,id] of shopTabs){if(key.startsWith(source+':')){shopTabs.delete(key);ids.push(id);}}
 const results=await Promise.allSettled(ids.map(id=>searchPlatform.tabs.remove(id)));
 return {closed:results.filter(result=>result.status==='fulfilled').length};
}
searchPlatform.tabs?.onRemoved?.addListener(tabId=>{
 for(const [key,id] of shopTabs)if(id===tabId)shopTabs.delete(key);
 return closeShopTabs(tabId);
});
function jobActive(job){return jobs.get(job.source)===(job.root||job)&&!job.cancelled;}
async function boundedOperation(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Zeitlimit überschritten')),ms);})]);}finally{clearTimeout(timer);}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function boundedMessage(tab,data,ms=15000){
 let timer;return Promise.race([searchPlatform.tabs.sendMessage(tab,data),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Antwort dauert zu lange')),ms);})]).finally(()=>clearTimeout(timer));
}
searchPlatform.runtime.onMessage.addListener((data,sender)=>{
 if(!sender.tab||sender.url!==searchPlatform.runtime.getURL('ui/home.html'))return;
 if(data?.type==='close-shop-tabs')return closeShopTabs(sender.tab.id);
 if(data?.type==='cancel'){jobs.delete(sender.tab.id);return Promise.resolve({cancelled:true});}
 if(data?.type!=='search'||typeof data.query!=='string'||!data.query.trim()||data.query.length>160||typeof data.id!=='string')return;
 if(data.variant!==undefined&&(typeof data.variant!=='string'||data.variant.length>100))return;
 const job={productName:data.query.trim(),refreshKnown:data.refreshKnown===true,nameQuery:productSearchQuery(data.query,data.variant||''),nameFallback:data.nameFallback===true,id:data.id,minPrice:Number.isFinite(data.minPrice)&&data.minPrice>=0?data.minPrice:null,maxPrice:Number.isFinite(data.maxPrice)&&data.maxPrice>=0?data.maxPrice:null,knownEAN:validEAN(data.ean),useEAN:data.useEAN!==false,query:(data.useEAN===false?'':validEAN(data.ean))||productSearchQuery(data.query,(data.variant||'')),variant:(data.variant||'').trim(),source:sender.tab.id,results:new Map(),counts:new Map(),knownShops:Array.isArray(data.knownShops)?data.knownShops.slice(0,4):[]};searchProfile(job);jobs.set(job.source,job);
 void searchAll(job).catch(async()=>{if(!jobActive(job))return;for(const shop of shops){const result=job.results.get(shop.id)||{offers:[],suggestions:[],message:'Shopprüfung fehlgeschlagen.'};await searchPlatform.runtime.sendMessage({...result,type:'result',target:job.source,id:job.id,query:job.query,shop:shop.name,url:shop.search(job.query)}).catch(()=>{});}}).finally(()=>{finishSearchProfile(job);if(jobActive(job))jobs.delete(job.source);});
 return Promise.resolve({accepted:true});
});
// Shop EAN searches can return compatibility matches and bundles too.
// Narrow confirmed EAN offers by the original product name when it matches;
// keep verified EAN offers if shop naming provides no reliable name match.
function narrowEANResults(offers,nameQuery){
 if(offers.length<2||!nameQuery||validEAN(nameQuery)||typeof matches!=='function')return offers;
 const named=offers.filter(offer=>matches(offer.name||'',nameQuery));
 return named.length?named:offers;
}
function exceedsSearchBudget(offer,job){return job.maxPrice!=null&&Number.isFinite(offer.price)&&['exact','from'].includes(offer.priceKind)&&offer.price>job.maxPrice;}
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
let productCacheWrites=Promise.resolve();
function productCacheKey(job){return job.knownEAN||validEAN(job.query)?'ean:'+(job.knownEAN||validEAN(job.query)):'name:'+job.query.toLowerCase().replace(/\s+/g,' ').trim()+'|'+job.variant.toLowerCase();}
function trustedProductHints(rows,shop){return (Array.isArray(rows)?rows:[]).filter(o=>{try{const u=new URL(o.url);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===shop.host.replace(/^www\./,'')&&typeof o.name==='string';}catch{return false;}}).map(o=>({...o,url:cleanShopUrl(o.url)}));}
async function loadProductHints(job){
 if(!searchPlatform.storage?.local)return;
 try{await boundedOperation(productCacheWrites,1500);const data=await boundedOperation(searchPlatform.storage.local.get('productUrlCache'),1500);const identifier=job.knownEAN||validEAN(job.query),keys=identifier?eanRepresentations(identifier).map(ean=>'ean:'+ean):[productCacheKey(job)],saved=keys.map(key=>data.productUrlCache?.[key]).filter(Boolean);
  for(const shop of shops){const stored=trustedProductHints(saved.flatMap(entry=>entry[shop.name]||[]),shop);if(!stored.length)continue;const known=job.knownShops.find(s=>s.name===shop.name);if(known)known.offers=uniqueOffers([...(known.offers||[]),...stored]);else job.knownShops.push({name:shop.name,offers:stored});}
 }catch{}
}
function saveProductHints(job,shop,offers){
 const rows=trustedProductHints(offers,shop).filter(o=>o.priceKind==='exact'&&variantMatches(o,job.variant)&&(!validEAN(job.query)||equivalentEANs(o.ean,job.query)));
 if(!rows.length||!searchPlatform.storage?.local)return Promise.resolve();
 productCacheWrites=productCacheWrites.catch(()=>{}).then(async()=>{const data=await boundedOperation(searchPlatform.storage.local.get('productUrlCache'),1500);const cache=cleanSavedUrls(data.productUrlCache||{});const keys=[productCacheKey(job),...rows.map(o=>validEAN(o.ean)?'ean:'+o.ean:'').filter(Boolean)];for(const key of new Set(keys)){cache[key]={...cache[key],[shop.name]:rows.slice(0,12)};}const entries=Object.entries(cache);await boundedOperation(searchPlatform.storage.local.set({productUrlCache:Object.fromEntries(entries.slice(-2000))}),1500);}).catch(()=>{});return productCacheWrites;
}
async function readKnownProducts(job,shop,tab,searchQuery){
 const known=job.knownShops.find(s=>s.name===shop.name),ean=validEAN(searchQuery);
 const candidates=trustedProductHints(known?.offers,shop).filter(o=>!ean||!validEAN(o.ean)||equivalentEANs(o.ean,ean));
 const hints=candidates.filter(o=>o.selection?.length||!candidates.some(other=>other.url===o.url&&other.selection?.length&&variantMatches(other,job.variant)));
 const unique=[...new Map(hints.map(o=>[JSON.stringify([o.url,o.variant,o.selection||[]]),o])).values()].slice(0,3);const offers=[];
 job.checkedKnownUrls ||= new Set();
 for(const [index,hint] of unique.entries()){
  if(!jobActive(job))break;
  if(index&&hint.url!==unique[index-1].url)await navigateShop(job,shop,tab.id,hint.url);
  job.checkedKnownUrls.add(hint.url);
  let attempts=0;
  for(let poll=0;poll<40&&attempts<6&&jobActive(job);poll++){
   await shopPause(job,shop,750);if(!jobActive(job))return;
   try{const result=await shopMessage(job,shop,tab.id,{type:'detail',nameQuery:job.nameQuery,query:searchQuery,variant:job.variant,host:shop.host,shopId:shop.id,url:hint.url,direct:true,followLinked:false,savedSelection:variantMatches(hint,job.variant)?cleanVariantSelection(hint.selection):[],fallback:{...hint,selection:[],variant:'',stock:'',price:null,ean:''}},20000);
    // An old document can answer while navigation is still committing. Do not
    // spend product-read attempts on it; the outer shop deadline still applies.
    if(result.pageMatchesRequested===false)continue;
    attempts++;
    if(result.blocked)continue;
    if(!result.ready)continue;
    const title=result.productName||'';
    offers.push(...(result.offers||[]).filter(o=>Number.isFinite(o.price)&&o.priceKind==='exact'&&variantMatches(o,job.variant)&&(ean?equivalentEANs(o.ean,ean):matchesKnownProduct(title,job.query,o,job.knownEAN))));break;
   }catch(error){if(!/receiving end does not exist|could not establish connection|no matching message handler/i.test(String(error?.message||'')))attempts++;}
  }
 }
 return uniqueOffers(offers);
}
function matchesKnownProduct(title,query,offer,knownEAN){
 if(knownEAN&&equivalentEANs(offer.ean,knownEAN))return true;
 // Reuse the same generic name matcher as the shop extractors.
 return typeof matches==='function'&&matches(title,query);
}
async function searchAll(job){
 await profileStep(job,{id:'cache'},'read',()=>loadProductHints(job));if(!jobActive(job))return;
 await Promise.all(shops.map(shop=>run(job,shop)));
 if(!jobActive(job))return;
 if(job.nameFallback&&job.useEAN&&validEAN(job.query)&&!validEAN(job.nameQuery)){
  await Promise.all(shops.filter(shop=>{
   const result=job.results.get(shop.id);return result&&!result.offers?.length&&!/Sicherheitsprüfung|Zeitlimit|Shopfehler|geschlossen|fehlgeschlagen|nicht abgeschlossen/i.test(result.message||'');
  }).map(async shop=>{
   const previous=job.results.get(shop.id);
   await searchPlatform.runtime.sendMessage({...previous,type:'status',message:'Kein EAN-Treffer · suche nach Name…'}).catch(()=>{});
   if(!jobActive(job))return;
   await run({...job,root:job,knownEAN:'',knownShops:[]},shop,job.nameQuery);
  }));
 }
 if(!jobActive(job))return;
 // Decide from matched product identities, never from particular search terms.
 // Keep candidates for later price-filter changes, but show one winner per shop.
 const compareProducts=!validEAN(job.query)&&(job.knownShops.some(shop=>shop.comparisonMode==='cheapest')||[...job.results.values()].some(result=>hasDifferentProducts((result.offers||[]).filter(offer=>variantMatches(offer,job.variant)&&!exceedsSearchBudget(offer,job)&&offer.price>=(job.minPrice??0)))));
 if(compareProducts)for(const [key,result] of job.results)job.results.set(key,{...result,comparisonMode:'cheapest'});
 const shared=shareVariantEAN([...job.results.values()],job.variant,validEAN(job.query));
 if(job.useEAN&&shared.ean&&!equivalentEANs(shared.ean,job.query)){
  await Promise.all(shops.filter(shop=>(job.counts.get(shop.id)||0)>1).map(async shop=>{
   const previous=job.results.get(shop.id);
   await searchPlatform.runtime.sendMessage({...previous,type:'status',message:'Mehrere Treffer: Suche wird mit EAN '+shared.ean+' eingegrenzt.'}).catch(()=>{});
   await run(job,shop,shared.ean);
   const next=job.results.get(shop.id);
   if(!next?.offers?.length&&previous?.offers?.length)job.results.set(shop.id,{...previous,message:'EAN-Suche ohne bestätigten Treffer. Angebote der Namenssuche bleiben erhalten.'});
  }));
 }
 if(!jobActive(job))return;
 const final=shareVariantEAN([...job.results.values()],job.variant,shared.ean);
 for(const result of filterConflictingEANs(final.shops,job.useEAN?final.ean:''))await searchPlatform.runtime.sendMessage({...result,offers:job.useEAN&&final.ean?narrowEANResults(result.offers||[],job.nameQuery):result.offers}).catch(()=>{});
}
async function run(job,shop,searchQuery=job.query){
 const task={...job,root:job.root||job,cancelled:false};
 const timeout=searchQuery===job.query?60000:30000;
 try{await boundedOperation(runShop(task,shop,searchQuery),timeout);}
 catch{
  if(jobActive(job)){
   const previous=job.results.get(shop.id);
   job.results.set(shop.id,{...previous,type:'result',target:job.source,id:job.id,query:searchQuery,shop:shop.name,url:shop.search(searchQuery),offers:previous?.offers||[],suggestions:previous?.suggestions||[],message:'Zeitlimit oder Shopfehler · bisherige Ergebnisse'});
  }
 }finally{task.cancelled=true;}
 if(jobActive(job)&&!job.results.has(shop.id))job.results.set(shop.id,{type:'result',target:job.source,id:job.id,query:searchQuery,shop:shop.name,url:shop.search(searchQuery),offers:[],message:'Shopprüfung nicht abgeschlossen.'});
}
async function runShop(job,shop,searchQuery=job.query){
 let tab,resolvedQuery=searchQuery;
 const send=async data=>{if(!jobActive(job))return;const requestedEAN=validEAN(searchQuery);if(requestedEAN){data={...data,offers:narrowEANResults((data.offers||[]).filter(o=>equivalentEANs(o.ean,requestedEAN)),job.nameQuery),suggestions:[]};
  if(data.type==='result'&&!data.offers.length&&tab&&jobActive(job)){
   const known=job.knownShops.find(s=>s.name===shop.name);
   const candidates=(Array.isArray(known?.offers)?known.offers:[]).filter(o=>{try{const u=new URL(o.url);return !job.checkedKnownUrls?.has(cleanShopUrl(o.url))&&!exceedsSearchBudget(o,job)&&equivalentEANs(o.ean,requestedEAN)&&u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===shop.host.replace(/^www\./,'');}catch{return false;}}).slice(0,3);
   for(const offer of candidates){
    if(!jobActive(job))return;
    try{await navigateShop(job,shop,tab.id,offer.url);
     for(let attempt=0;attempt<8&&jobActive(job);attempt++){
      await shopPause(job,shop,750);if(!jobActive(job))return;
      const detail=await shopMessage(job,shop,tab.id,{type:'detail',nameQuery:job.nameQuery,query:requestedEAN,host:shop.host,url:offer.url,shopId:shop.id,fallback:offer,variant:job.variant,followLinked:false},20000);
      if(detail.blocked)break;
      if(detail.ready){const verified=(detail.offers||[]).filter(o=>equivalentEANs(o.ean,requestedEAN)&&variantMatches(o,job.variant));if(verified.length){data.offers.push(...verified);data.message='EAN auf der bekannten Produktseite bestätigt; Shopsuche ohne Treffer.';}break;}
     }
    }catch{}
   }
  }
 }if(!jobActive(job))return;const payload={...data,target:job.source,id:job.id,query:searchQuery,shop:shop.name,url:shop.search(resolvedQuery)};if(data.type==='result'){job.results.set(shop.id,payload);void saveProductHints(job,shop,payload.offers||[]);await searchPlatform.runtime.sendMessage({...payload,type:'partial-result'}).catch(()=>{});return;}await searchPlatform.runtime.sendMessage(payload).catch(()=>{});};
 try{
  const hints=trustedProductHints(job.knownShops.find(s=>s.name===shop.name)?.offers,shop).filter(o=>!validEAN(searchQuery)||!validEAN(o.ean)||equivalentEANs(o.ean,searchQuery));
  tab=await profileStep(job,shop,'navigation',()=>shopTab(job.source,shop,hints[0]?.url||shop.search(searchQuery)));
  if(hints.length){await send({type:'status',message:'Bekannte Produktseiten werden direkt aktualisiert…'});const direct=await readKnownProducts(job,shop,tab,searchQuery);if(!jobActive(job))return;if(direct.length){await send({type:'result',offers:direct,message:''});return;}if(job.refreshKnown){await send({type:'result',offers:[],message:'Gespeicherte Produktseite aktuell nicht bestätigt. Bitte im Shop prüfen.'});return;}await navigateShop(job,shop,tab.id,shop.search(searchQuery));}
  let previous='',stable=0,last,broadened=false,emptyReads=0;
  for(let i=0;i<12&&jobActive(job);i++){
   // Keep the initial/navigation wait and slow/blocked retries. Once cards
   // exist, only their stability check needs a shorter local DOM interval.
   await shopPause(job,shop,last&&!last.blocked&&(last.offers?.length||last.suggestions?.length)?500:2000);if(!jobActive(job))return;
   try{last=await shopMessage(job,shop,tab.id,{type:'extract',query:searchQuery,variant:job.variant,host:shop.host,shopId:shop.id});}catch{try{await searchPlatform.tabs.get(tab.id);}catch{throw Error('Tab geschlossen');}continue;}
   if(last.blocked){emptyReads=0;await send({type:'status',message:'Sicherheitsprüfung: '+shop.name+'-Tab öffnen und Prüfung abschließen.'});continue;}
   last.offers=Array.isArray(last.offers)?last.offers:[];
   emptyReads=!last.offers.length&&!last.suggestions?.length?emptyReads+1:0;
   const signature=JSON.stringify([last.offers,last.suggestions]);stable=signature===previous?stable+1:0;previous=signature;
   if(last.offers.length&&stable>=1){
    job.counts.set(shop.id,last.offers.length);
    const nameMatch=offer=>validEAN(searchQuery)&&job.nameQuery&&typeof matches==='function'&&matches(offer.name||'',job.nameQuery);
    const rows=last.offers.sort((a,b)=>Number(nameMatch(b))-Number(nameMatch(a))||Number(variantMatches(b,job.variant))-Number(variantMatches(a,job.variant))||(Number.isFinite(a.price)?a.price:Infinity)-(Number.isFinite(b.price)?b.price:Infinity));const variants=new Map(),dataSheetEANs=new Set();let limited=false;
    // Inspect general comparisons from cheapest to most expensive in this one tab.
    const compareCandidates=!validEAN(searchQuery)&&hasDifferentProducts(rows);
    // Read missing delivery information on the actual product pages in the same Firefox session.
    const eanCandidate=['bike24','r2-bike'].includes(shop.id)?rows.find(row=>!exceedsSearchBudget(row,job)&&listingOfferComplete(row,job.variant)&&(!compareCandidates||deliverable(row.stock))&&!validEAN(row.ean)):null;
    const inspect=rows.filter(row=>!exceedsSearchBudget(row,job)&&!listingVariantConflict(row,job.variant)&&(row===eanCandidate||!listingOfferComplete(row,job.variant)||(validEAN(searchQuery)&&!equivalentEANs(row.ean,searchQuery))));
    for(const row of inspect.slice(0,compareCandidates?12:3)){
     if(!jobActive(job))return;
     if(compareCandidates){
      const best=rows.flatMap(candidate=>variants.get(candidate)||[candidate]).filter(offer=>listingOfferComplete(offer,job.variant)&&deliverable(offer.stock)&&!exceedsSearchBudget(offer,job)&&offer.price>=(job.minPrice??0)).sort((a,b)=>a.price-b.price)[0];
      if(best&&Number.isFinite(row.price)&&row.price>=best.price&&row!==eanCandidate)continue;
     }
     await send({type:'status',message:'Produktdetails und Lieferangaben werden geprüft…'});
     await navigateShop(job,shop,tab.id,row.url);
     for(let attempt=0;attempt<8;attempt++){
      await shopPause(job,shop,750);if(!jobActive(job))return;
      try{const d=await shopMessage(job,shop,tab.id,{type:'detail',nameQuery:job.nameQuery,query:searchQuery,host:shop.host,url:row.url,shopId:shop.id,fallback:row,variant:job.variant,metadataOnly:['bike24','r2-bike'].includes(shop.id)&&listingOfferComplete(row,job.variant),followLinked:shop.id!=='bike24'||!rows.some(o=>listingOfferComplete(o,job.variant))},20000);if(d.blocked)break;if(d.ready){for(const ean of d.eanCandidates||[])if(validEAN(ean))dataSheetEANs.add(ean);if(shop.id==='bike24'&&d.linkedVariants?.length){const extra=await bike24Linked(tab,shop,job,row,d,searchQuery);d.offers=extra.offers;d.limited ||= extra.limited;}limited ||= !!d.limited;if(d.offers?.length)variants.set(row,d.offers);else row.stock=d.stock;break;}}catch{}
     }
    }
    const expanded=uniqueOffers(rows.flatMap(row=>variants.get(row)||[row])),identity=expanded.filter(o=>!validEAN(searchQuery)||equivalentEANs(o.ean,searchQuery)),matching=identity.filter(o=>variantMatches(o,job.variant));
    if(validEAN(searchQuery)&&!matching.length){
     const otherEANs=[...new Set(expanded.map(o=>validEAN(o.ean)).filter(ean=>ean&&!equivalentEANs(ean,searchQuery)))];
     const message=!identity.length&&[...dataSheetEANs].some(ean=>equivalentEANs(ean,searchQuery))?'EAN '+searchQuery+' im Datenblatt gefunden. Zuordnung zur '+(job.variant?'gewünschten Variante „'+job.variant+'“':'ausgewählten Variante')+' nicht eindeutig.':identity.length?'EAN '+searchQuery+' gefunden. Gewünschte Variante „'+job.variant+'“ nicht bestätigt.':otherEANs.length?'Kein Treffer mit EAN '+searchQuery+'. Gefundene Produkte haben abweichende EAN: '+otherEANs.join(', ')+'.':'EAN '+searchQuery+' in den gefundenen Produkten nicht bestätigt.';
     await send({type:'result',offers:[],message});return;
    }
    if(job.variant&&!matching.length){await send({type:'result',offers:[],suggestions:expanded.slice(0,12),variantAlternatives:true,message:'Variante „'+job.variant+'“ nicht bestätigt.'});return;}
    await send({type:'result',offers:matching,message:limited?'Weitere Varianten im Shop prüfen.':''});return;
   }
   if(!validEAN(searchQuery)&&!last.offers.length&&last.suggestions?.length&&stable>=1){
    const suggestions=await suggestionDetails(tab,shop,job,last.suggestions,send);
    const confirmed=suggestions.filter(o=>o.identityConfirmed);
    await send({type:'result',offers:confirmed,suggestions:confirmed.length?[]:suggestions,message:confirmed.length?'':'Kein genauer Treffer.'});return;
   }
   if(stable>=2&&(last.empty||(emptyReads>=4&&last.ready)||emptyReads>=8)){const broader=validEAN(searchQuery)?alternateEAN(searchQuery):broaderQuery(searchQuery);if(!broadened&&broader){broadened=true;emptyReads=0;previous='';stable=0;await send({type:'status',message:validEAN(searchQuery)?'Kein Treffer · gleichwertige EAN-Schreibweise wird geprüft…':'Keine genauen Treffer. Ähnliche Produkte werden gesucht…'});if(validEAN(searchQuery))resolvedQuery=broader;await navigateShop(job,shop,tab.id,shop.search(broader));continue;}await send({type:'result',offers:[],message:last.message||'Keine passenden Angebote gefunden.'});return;}
  }
  if(jobActive(job))await send({type:'result',offers:last?.offers||[],message:last?.blocked?'Der Shop verlangt weiterhin eine Sicherheitsprüfung. Bitte dort abschließen und erneut suchen.':'Keine Angebote ausgelesen. Bitte Suchbegriff und sichtbare Shop-Ergebnisse prüfen.'});
 }catch{if(jobActive(job))await send({type:'result',offers:[],message:'Shop-Tab wurde geschlossen oder konnte nicht gelesen werden. Bitte erneut suchen.'});}
}

async function suggestionDetails(tab,shop,job,rows,send){
 const enriched=new Map();
 for(const row of rows.filter(o=>!exceedsSearchBudget(o,job)&&(!job.knownEAN||!validEAN(o.ean)||equivalentEANs(o.ean,job.knownEAN))&&!listingVariantConflict(o,job.variant)).slice(0,3)){
  if(!jobActive(job))break;
  await send({type:'status',message:'EAN und Ausführungen ähnlicher Produkte werden geprüft…'});
  await navigateShop(job,shop,tab.id,row.url);
  for(let attempt=0;attempt<8&&jobActive(job);attempt++){
   await shopPause(job,shop,750);if(!jobActive(job))return;
   try{
    const detail=await shopMessage(job,shop,tab.id,{type:'detail',nameQuery:job.nameQuery,query:row.name,host:shop.host,url:row.url,shopId:shop.id,fallback:row,variant:job.variant,followLinked:false},20000);
    if(detail.blocked)break;
    if(detail.ready){
     const offers=detail.offers||[],matching=offers.filter(o=>variantMatches(o,job.variant));
     if(offers.length)enriched.set(row,(matching.length?matching:offers).map(o=>({...o,identityConfirmed:!!job.knownEAN&&equivalentEANs(o.ean,job.knownEAN)&&o.priceKind==='exact'&&variantMatches(o,job.variant)})));
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
  if(!jobActive(job))break;
  if(offers.some(o=>new URL(o.url).pathname===new URL(v.url).pathname))continue;
  await navigateShop(job,shop,tab.id,v.url);
  for(let i=0;i<10;i++){
   await shopPause(job,shop,1000);if(!jobActive(job))break;
   let d;try{d=await shopMessage(job,shop,tab.id,{type:'detail',nameQuery:job.nameQuery,query:searchQuery,host:shop.host,shopId:shop.id,url:v.url,followLinked:false,fallback:{...fallback,url:v.url,baseVariant:v.variant}});}catch{continue;}
   if(d.blocked)break;
   if(d.ready){offers.push(...(d.offers||[]));limited ||= !!d.limited;break;}
  }
 }
 return {offers:offers.slice(0,24),limited:limited||offers.length>24||initial.linkedVariants.length>24};
}
