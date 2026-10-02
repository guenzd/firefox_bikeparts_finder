const shops=[{id:'bike24',name:'BIKE24',host:'www.bike24.de',search:q=>'https://www.bike24.de/suchergebnis?searchTerm='+encodeURIComponent(q)},{id:'bike-discount',name:'Bike-Discount',host:'www.bike-discount.de',search:q=>'https://www.bike-discount.de/de/search?search='+encodeURIComponent(q)},{id:'bike-components',name:'bike-components',host:'www.bike-components.de',search:q=>'https://www.bike-components.de/de/s/?keywords='+encodeURIComponent(q)},{id:'r2-bike',name:'r2-bike',host:'r2-bike.com',search:q=>'https://r2-bike.com/?qs='+encodeURIComponent(q)}];
const jobs=new Map(),shopTabs=new Map(),cartBusy=new Set();
async function shopTab(source,shop,url,active=false){
 const key=source+":"+shop.id,existing=shopTabs.get(key);
 if(existing!==undefined){try{const tab=await browser.tabs.get(existing);const host=new URL(tab.url).hostname.replace(/^www\./,"");if(host===shop.host.replace(/^www\./,""))return await browser.tabs.update(existing,{url,active});}catch{}shopTabs.delete(key);}
 const tab=await browser.tabs.create({url,active});shopTabs.set(key,tab.id);return tab;
}
browser.browserAction.onClicked.addListener(()=>browser.tabs.create({url:browser.runtime.getURL('home.html')}));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
browser.runtime.onMessage.addListener((data,sender)=>{
 if(!sender.tab||sender.url!==browser.runtime.getURL('home.html'))return;
 if(data?.type==='cart')return addToCart(data,sender.tab.id);
 if(data?.type!=='search'||cartBusy.has(sender.tab.id)||typeof data.query!=='string'||!data.query.trim()||data.query.length>160||typeof data.id!=='string')return;
 if(data.variant!==undefined&&(typeof data.variant!=='string'||data.variant.length>100))return;
 const job={id:data.id,query:productSearchQuery(data.query,(data.variant||'')),variant:(data.variant||'').trim(),source:sender.tab.id};jobs.set(job.source,job);
 void Promise.all(shops.map(shop=>run(job,shop))).finally(()=>{if(jobs.get(job.source)===job)jobs.delete(job.source);});
 return Promise.resolve({accepted:true});
});
async function run(job,shop){
 const send=data=>browser.runtime.sendMessage({...data,target:job.source,id:job.id,query:job.query,shop:shop.name,url:shop.search(job.query)}).catch(()=>{});
 try{
  const tab=await shopTab(job.source,shop,shop.search(shop.id==='r2-bike'&&job.variant?job.query+' '+job.variant:job.query));
  let previous='',stable=0,last,broadened=false,variantFallback=false;
  for(let i=0;i<120&&jobs.get(job.source)===job;i++){
   await pause(2000);
   try{last=await browser.tabs.sendMessage(tab.id,{type:'extract',query:job.query,variant:job.variant,host:shop.host,shopId:shop.id});}catch{try{await browser.tabs.get(tab.id);}catch{throw Error('Tab geschlossen');}continue;}
   if(last.blocked){await send({type:'status',message:'Sicherheitsprüfung: Bitte den '+shop.name+'-Tab öffnen und dort selbst abschließen. Ergebnisse werden danach automatisch übernommen.'});continue;}
   const signature=JSON.stringify([last.offers,last.suggestions]);stable=signature===previous?stable+1:0;previous=signature;
   if(last.offers.length&&stable>=1){
    const rows=last.offers.sort((a,b)=>Number(variantMatches(b,job.variant))-Number(variantMatches(a,job.variant)));const variants=new Map();let limited=false;
    // Read missing delivery information on the actual product pages in the same Firefox session.
    for(const row of rows.slice(0,3)){
     if(jobs.get(job.source)!==job)return;
     await send({type:'status',message:'Produktdetails und Lieferangaben werden geprüft…'});
     await browser.tabs.update(tab.id,{url:row.url});
     for(let attempt=0;attempt<8;attempt++){
      await pause(1500);
      try{const d=await browser.tabs.sendMessage(tab.id,{type:'detail',query:job.query,host:shop.host,url:row.url,shopId:shop.id,fallback:row});if(d.blocked)break;if(d.ready){if(shop.id==='bike24'&&d.linkedVariants?.length){const extra=await bike24Linked(tab,shop,job,row,d);d.offers=extra.offers;d.limited ||= extra.limited;}limited ||= !!d.limited;if(d.offers?.length)variants.set(row,d.offers);else row.stock=d.stock;break;}}catch{}
     }
    }
    const expanded=[...new Map(rows.flatMap(row=>variants.get(row)||[row]).map(o=>[o.url+'|'+o.variant,o])).values()],matching=expanded.filter(o=>variantMatches(o,job.variant));
    if(job.variant&&!matching.length){await send({type:'result',offers:[],suggestions:expanded.slice(0,5),message:'Produkt gefunden, aber die gewünschte Variante nicht bestätigt. Andere gefundene Ausführungen:'});return;}
    await send({type:'result',offers:matching,message:limited?'Bis zu 24 Variantenkombinationen pro Produkt geprüft. Weitere Ausführungen bitte im Shop prüfen.':''});return;
   }
   if(!last.offers.length&&last.suggestions?.length&&stable>=1){await send({type:'result',offers:[],suggestions:last.suggestions,message:'Kein genauer Treffer. Diese ähnlichen Produkte bitte prüfen.'});return;}
   if(last.empty&&stable>=2){if(shop.id==='r2-bike'&&job.variant&&!variantFallback){variantFallback=true;previous='';stable=0;await browser.tabs.update(tab.id,{url:shop.search(job.query)});continue;}const broader=broaderQuery(job.query);if(!broadened&&broader){broadened=true;previous='';stable=0;await send({type:'status',message:'Keine genauen Treffer. Ähnliche Produkte werden gesucht…'});await browser.tabs.update(tab.id,{url:shop.search(broader)});continue;}await send({type:'result',offers:[],message:'Keine passenden Angebote in der Shopsuche gefunden.'});return;}
  }
  if(jobs.get(job.source)===job)await send({type:'result',offers:last?.offers||[],message:last?.blocked?'Der Shop verlangt weiterhin eine Sicherheitsprüfung. Bitte dort abschließen und erneut suchen.':'Keine Angebote ausgelesen. Bitte Suchbegriff und sichtbare Shop-Ergebnisse prüfen.'});
 }catch{if(jobs.get(job.source)===job)await send({type:'result',offers:[],message:'Shop-Tab wurde geschlossen oder konnte nicht gelesen werden. Bitte erneut suchen.'});}
}

async function addToCart(data,source){
 for(let i=0;i<20&&jobs.has(source);i++)await pause(100);
 if(jobs.has(source)||cartBusy.has(source))return {message:'Bitte die laufende Suche oder Warenkorb-Aktion abwarten.'};
 const shop=shops.find(s=>s.name===data.shop),offer=data.offer;
 if(!shop||!offer||typeof offer.url!=='string'||!Number.isFinite(offer.price)||offer.priceKind!=='exact')return {message:'Bitte die Ausführung direkt im Shop wählen.'};
 try{const u=new URL(offer.url);if(u.protocol!=='https:'||u.hostname.replace(/^www\./,'')!==shop.host.replace(/^www\./,''))return {message:'Ungültiger Produktlink.'};}catch{return {message:'Ungültiger Produktlink.'};}
 cartBusy.add(source);
 try{
  const tab=await shopTab(source,shop,offer.url,true);
  for(let i=0;i<12;i++){
   await pause(1000);
   let ready;try{ready=await browser.tabs.sendMessage(tab.id,{type:'cart-ready',host:shop.host,url:offer.url});}catch{continue;}
   if(ready.blocked)return {message:'Bitte die Sicherheitsprüfung im geöffneten Shop-Tab abschließen.'};
   if(ready.ready){
    // Exactly one dispatch: never repeat an ambiguous add-to-cart action.
    try{return await browser.tabs.sendMessage(tab.id,{type:'cart-add',host:shop.host,url:offer.url,offer,shopId:shop.id});}catch{return {uncertain:true,message:'Keine Bestätigung erhalten. Bitte den Warenkorb im Shop prüfen, bevor du erneut hinzufügst.'};}
   }
  }
  return {message:'Produkt im Shop geöffnet. Bitte dort die Ausführung wählen und hinzufügen.'};
 }catch{return {message:'Shop-Tab konnte nicht geöffnet werden.'};}finally{cartBusy.delete(source);}
}

async function bike24Linked(tab,shop,job,fallback,initial){
 const offers=[...(initial.offers||[])];let limited=!!initial.limited;
 for(const v of initial.linkedVariants.slice(0,24)){
  if(offers.length>=24){limited=true;break;}
  if(jobs.get(job.source)!==job)break;
  if(offers.some(o=>new URL(o.url).pathname===new URL(v.url).pathname))continue;
  await browser.tabs.update(tab.id,{url:v.url});
  for(let i=0;i<10;i++){
   await pause(1000);
   let d;try{d=await browser.tabs.sendMessage(tab.id,{type:'detail',query:job.query,host:shop.host,shopId:shop.id,url:v.url,followLinked:false,fallback:{...fallback,url:v.url,baseVariant:v.variant}});}catch{continue;}
   if(d.blocked)break;
   if(d.ready){offers.push(...(d.offers||[]));limited ||= !!d.limited;break;}
  }
 }
 return {offers:offers.slice(0,24),limited:limited||offers.length>24||initial.linkedVariants.length>24};
}
