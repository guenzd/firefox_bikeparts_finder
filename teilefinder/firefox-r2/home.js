let currentTab;browser.tabs.getCurrent().then(tab=>{currentTab=tab.id;});
const names=['BIKE24','Bike-Discount','bike-components','r2-bike'];
const state=new Map();let id='',query='',searchedVariant='',wishlist=[],checkingList=false,finishSearch=null,stopRequested=false,activeWishlistId='',wishlistDetails=false;
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const saveList=()=>browser.storage.local.set({wishlist});
browser.storage.local.get('wishlist').then(d=>{wishlist=Array.isArray(d.wishlist)?d.wishlist.map(({cart,...item})=>item):[];wishlistDetails=wishlist.some(item=>item.shops?.length);renderWishlist();render();}).catch(()=>{document.querySelector('#status').textContent='Wunschliste konnte nicht geladen werden.';});
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function render(){
 const root=document.querySelector('#results');root.replaceChildren();
 if(wishlistDetails){renderWishlistDetails(root);return;}
 for(const name of names){
 const entries=wishlistDetails?wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state):[{item:null,shop:state.get(name)}].filter(e=>e.shop);
 if(!entries.length)continue;const a=el('article'),heading=el('div');heading.className='shop-heading';heading.append(el('h3',name));const search=wishlistDetails?null:entries[0].shop;if(search?.url){const link=el('a','Im Shop suchen ↗');link.href=search.url;link.target='_blank';link.rel='noopener noreferrer';const links=el('span');links.className='shop-links';links.append(link,copyButton(search.url));heading.append(links);}a.append(heading);
 for(const {item,shop:s} of entries){
 const section=el('section');if(item){section.append(el('h4',item.query),el('small',item.variant||'Alle Varianten'));if(s.url){const link=el('a','Im Shop suchen ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';section.append(link,copyButton(s.url));}}
 const raw=document.querySelector('#max').value,limit=item?(item.maxPrice??Infinity):(raw===''?Infinity:Number(raw)),requested=item?item.variant:document.querySelector('#search-variant').value;
 const rows=uniqueOffers(s.offers||[]).filter(o=>typeof o.price==='number'&&o.price<=limit&&variantMatches(o,requested));
 if(rows.length){const wrap=el('div');wrap.className='table-wrap';const t=el('table'),head=el('tr');['Produkt / Ausführung','Preis','Lagerstatus','Link'].forEach(v=>head.append(el('th',v)));t.append(head);
 for(const o of rows){const tr=el('tr'),product=el('td');product.append(el('strong',o.name),el('small',o.variant));if(validEAN(o.ean))product.append(eanRow(o.ean,item?.id));const price=el('td',(o.priceKind==='from'?'ab ':'')+new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(o.price));price.className='price';const cell=el('td'),link=el('a','Öffnen ↗');link.href=o.url;link.target='_blank';link.rel='noopener noreferrer';cell.append(link,copyButton(o.url));tr.append(product,price,el('td',o.stock),cell);t.append(tr);}wrap.append(t);section.append(wrap);
 }else section.append(el('p',(s.offers||[]).length?'Keine Angebote innerhalb des Maximalpreises.':s.message));
 if(!(s.offers||[]).length&&s.suggestions?.length){section.append(el('h4',s.variantAlternatives?'Passendes Produkt · andere Ausführungen':'Ähnliche gefundene Produkte'));for(const suggestion of s.suggestions)section.append(suggestionRow(suggestion,item,s.variantAlternatives));}
 if((s.offers||[]).length>rows.length)section.append(el('small',((s.offers||[]).length-rows.length)+' Angebote durch Preisfilter ausgeblendet.'));
 if(rows.length&&s.message)section.append(el('p',s.message));
 if(s.checkedAt)section.append(el('p','Abfrage: '+new Date(s.checkedAt).toLocaleString('de-DE')));a.append(section);
 }root.append(a);
 }
}
function renderWishlistDetails(root){
 for(const name of names){
  const entries=wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state);
  if(!entries.length)continue;
  const article=el('article'),heading=el('div');heading.className='shop-heading';heading.append(el('h3',name),el('small',entries.length+' Artikel'));article.append(heading);
  const wrap=el('div');wrap.className='table-wrap';const table=el('table');table.className='wishlist-results';
  const head=el('tr');['Wunschlistenartikel / Treffer','Preis','Lagerstatus','Links'].forEach(text=>head.append(el('th',text)));table.append(head);
  for(const {item,shop} of entries){
   const offers=uniqueOffers(shop.offers||[]).filter(o=>Number.isFinite(o.price)&&o.price<=(item.maxPrice??Infinity)&&variantMatches(o,item.variant));
   const group=el('tbody');
   for(const [index,offer] of (offers.length?offers:[null]).entries()){
    const row=el('tr'),product=el('td'),price=el('td'),stock=el('td'),links=el('td');price.className='price';links.className='result-links';
    if(index===0){product.append(el('strong',item.query));if(item.variant)product.append(el('small','Gewünscht: '+item.variant));}
    if(offer){
     if(offer.name!==item.query)product.append(el('span',offer.name));
     if(offer.variant&&offer.variant!==offer.name&&offer.variant!==item.variant)product.append(el('small',offer.variant));
     if(validEAN(offer.ean))product.append(eanRow(offer.ean,item.id));
     price.textContent=(offer.priceKind==='from'?'ab ':'')+money(offer.price);stock.append(el('span',offer.stock));
     const link=el('a','Öffnen ↗');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';links.append(link,copyButton(offer.url));
    }else{price.textContent='—';stock.append(el('span',(shop.offers||[]).length?'Über Maximalpreis':shop.message||'Kein Treffer'));if(validEAN(item.ean))product.append(eanRow(item.ean,item.id));}
    if(index===0){
     if(shop.stale)stock.append(el('small','Vorheriges Ergebnis · nicht bestätigt'));
     if(shop.checkedAt)stock.append(el('small',new Date(shop.checkedAt).toLocaleString('de-DE')));
     if(shop.url){const search=el('a','Suchen ↗');search.href=shop.url;search.target='_blank';search.rel='noopener noreferrer';const line=el('div');line.append(search,copyButton(shop.url));links.append(line);}
    }
    row.append(product,price,stock,links);group.append(row);
   }
   if(!offers.length&&shop.suggestions?.length){const row=el('tr'),cell=el('td');cell.colSpan=4;cell.append(el('small','Ähnliche Produkte'));shop.suggestions.forEach(o=>cell.append(suggestionRow(o,item,shop.variantAlternatives)));row.append(cell);group.append(row);}
   table.append(group);
  }
  wrap.append(table);article.append(wrap);root.append(article);
 }
}
browser.runtime.onMessage.addListener(d=>{
 if(d.target!==currentTab||d.id!==id||!names.includes(d.shop))return;
 const previous=state.get(d.shop);if(d.type==='status')state.set(d.shop,{...previous,message:d.message});
 if(['result','partial-result'].includes(d.type)){
  const offers=(d.offers||[]).filter(o=>{try{const u=new URL(o.url),search=new URL(d.url);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===search.hostname.replace(/^www\./,'')&&typeof o.name==='string'&&Number.isFinite(o.price)&&o.price>0;}catch{return false;}});
  const suggestions=(d.suggestions||[]).filter(o=>{try{return new URL(o.url).protocol==='https:'&&new URL(o.url).hostname.replace(/^www\./,'')===new URL(d.url).hostname.replace(/^www\./,'')&&typeof o.name==='string';}catch{return false;}});
  const requestedEAN=validEAN(d.query);const previousOffers=(previous?.offers||[]).filter(o=>!requestedEAN||validEAN(o.ean)===requestedEAN);
  const kept=!offers.length&&previousOffers.length;
  state.set(d.shop,{offers:uniqueOffers(kept?previousOffers:offers),stale:!!kept,suggestions,variantAlternatives:!!d.variantAlternatives,url:d.url,message:kept?'Vorherige Ergebnisse · aktuell nicht bestätigt. '+(d.message||''):d.message,checkedAt:kept?previous.checkedAt:new Date().toISOString(),done:d.type==='result'});
 }
 if(d.type==='result'){
  const shared=shareVariantEAN([...state.entries()].map(([name,s])=>({name,...s})),searchedVariant,document.querySelector('#search-ean').value);
  document.querySelector('#search-ean').value=shared.ean;shared.shops.forEach(s=>state.set(s.name,s));
  wishlist=wishlist.map(item=>item.query===query&&(item.variant||'')===searchedVariant?{...item,ean:shared.ean||item.ean||''}:item);for(const input of document.querySelectorAll('[data-ean-item]')){const item=wishlist.find(row=>row.id===input.dataset.eanItem);if(item&&input!==document.activeElement)input.value=item.ean||'';}void saveList();
 }
 document.querySelector('#export-wishlist').disabled=checkingList||(!wishlist.length&&!state.size);render();const done=[...state.values()].filter(s=>s.done).length;document.querySelector('#status').textContent=done===4?'Suche abgeschlossen.':done+' von 4 Shops fertig.';if(done===4)document.querySelector('#stop-search').hidden=true;if(done===4&&finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,s])=>({name,...s})));}
});
document.querySelector('#max').addEventListener('input',render);
document.querySelector('#search-variant').addEventListener('input',render);
async function startSearch(q,requested=document.querySelector('#search-variant').value.trim(),savedShops){
 wishlistDetails=checkingList;
 const same=q===query&&requested===searchedVariant;query=q;searchedVariant=requested;id=crypto.randomUUID();if(!same)state.clear();if(savedShops){state.clear();savedShops.forEach(shop=>state.set(shop.name,shop));}names.forEach(name=>state.set(name,{...state.get(name),offers:state.get(name)?.offers||[],done:false,message:'Shopsuche wird geöffnet…'}));document.querySelector('#stop-search').hidden=false;render();document.querySelector('#status').textContent='Die vier Shops werden in Firefox durchsucht…';
 try{await browser.runtime.sendMessage({type:'search',query,ean:validEAN(document.querySelector('#search-ean').value),variant:searchedVariant,id});}catch{document.querySelector('#status').textContent='Erweiterung wurde beendet. Bitte neu laden.';if(finishSearch){finishSearch([]);finishSearch=null;}}
}
document.querySelector('#query').addEventListener('input',()=>{document.querySelector('#search-ean').value='';});
document.querySelector('#search-variant').addEventListener('input',()=>{document.querySelector('#search-ean').value='';});
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();if(checkingList)return;const q=document.querySelector('#query').value.trim();if(q){activeWishlistId='';void startSearch(q);}});
function renderWishlist(){
 const root=document.querySelector('#wishlist-items');root.replaceChildren();
 if(!wishlist.length)root.append(el('p','Noch keine Artikel gespeichert.'));
 for(const item of wishlist){
  const row=el('div');row.className='wish-row';
  const nameCell=el('div');nameCell.className='wish-name';nameCell.append(el('strong',item.query));
  const rename=el('button','Bearbeiten');rename.type='button';rename.className='secondary rename-button';rename.title='Name korrigieren';rename.setAttribute('aria-label','Name korrigieren: '+item.query);rename.disabled=checkingList;
  rename.addEventListener('click',()=>{
   const form=el('form');form.className='wish-name-editor';const name=el('input');name.value=item.query;name.maxLength=160;name.required=true;name.setAttribute('aria-label','Produktname korrigieren');
   const save=el('button','Speichern');save.type='submit';const cancel=el('button','Abbrechen');cancel.type='button';cancel.className='secondary';
   cancel.addEventListener('click',renderWishlist);
   form.addEventListener('submit',async event=>{
    event.preventDefault();const corrected=name.value.trim();if(checkingList||!corrected)return;
    save.disabled=true;cancel.disabled=true;
    try{const updated=renameWishlistItem(wishlist,item.id,corrected);await browser.storage.local.set({wishlist:updated});wishlist=updated;renderWishlist();document.querySelector('#status').textContent='Name gespeichert. Artikel erneut prüfen.';}
    catch{save.disabled=false;cancel.disabled=false;document.querySelector('#status').textContent='Name konnte nicht gespeichert werden.';}
   });
   form.append(name,save,cancel);nameCell.replaceChildren(form);name.focus();name.select();
  });nameCell.append(rename);const eanLabel=el('label','EAN'),eanInput=el('input');eanInput.value=item.ean||'';eanInput.dataset.eanItem=item.id;eanInput.placeholder='Wird automatisch ergänzt';eanInput.inputMode='numeric';eanInput.pattern='[0-9]{8,14}';eanInput.maxLength=14;eanInput.disabled=checkingList;eanInput.addEventListener('change',()=>{if(eanInput.value&&!validEAN(eanInput.value)){eanInput.reportValidity();return;}item.ean=validEAN(eanInput.value);void saveList();});eanLabel.append(eanInput);eanLabel.className='wish-ean';row.append(nameCell,eanLabel);
  const recheck=el('button','Erneut suchen');recheck.type='button';recheck.className='secondary recheck-button';recheck.disabled=checkingList;recheck.addEventListener('click',()=>void recheckWishlistItem(item.id));row.append(recheck);
  const priceLabel=el('label','Max. €'),input=el('input');priceLabel.className='wish-price';input.type='number';input.min='0';input.step='0.01';input.placeholder='Ohne Grenze';input.value=item.maxPrice??'';input.disabled=checkingList;
  input.addEventListener('change',()=>{item.maxPrice=input.value===''?null:Number(input.value);void saveList();renderTotal();if(wishlistDetails)render();});priceLabel.append(input);row.append(priceLabel);
  const variantLabel=el('label','Ausführung'),variant=el('input');variantLabel.className='wish-variant';variant.className='variant-input';variant.placeholder='Alle Varianten';variant.value=item.variant||'';variant.disabled=checkingList;variant.addEventListener('change',()=>{item.variant=variant.value.trim();item.ean='';eanInput.value='';void saveList();renderTotal();if(wishlistDetails)render();});variantLabel.append(variant);row.append(variantLabel);
  const remove=el('button','Entfernen');remove.className='remove-button';remove.disabled=checkingList;remove.addEventListener('click',()=>{wishlist=wishlist.filter(i=>i.id!==item.id);void saveList();renderWishlist();});row.append(remove);root.append(row);
 }
 document.querySelector('#check-wishlist').disabled=checkingList||!wishlist.length;document.querySelector('#add-wish').disabled=checkingList;document.querySelector('#search-submit').disabled=checkingList;
 document.querySelector('#export-wishlist').disabled=checkingList||(!wishlist.length&&!state.size);document.querySelector('#import-wishlist').disabled=checkingList;
 renderTotal();if(wishlistDetails)render();
}
function suggestionRow(suggestion,item,variantAlternative=false){
 const row=el('div');row.className='suggestion-row';row.append(el('strong',suggestion.name));
 if(validEAN(suggestion.ean))row.append(eanRow(suggestion.ean,item?.id||activeWishlistId));
 if(suggestion.variant)row.append(el('small',suggestion.variant));
 if(Number.isFinite(suggestion.price))row.append(el('small',(suggestion.priceKind==='from'?'ab ':'')+money(suggestion.price)));
 const link=el('a','Im Shop prüfen ↗');link.href=suggestion.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link,copyButton(suggestion.url));
 const choose=el('button',variantAlternative?'Ohne Variantenfilter suchen':item?'Für diesen Artikel übernehmen':'Mit diesem Namen suchen');choose.disabled=checkingList;
 choose.addEventListener('click',async()=>{
  if(variantAlternative){document.querySelector('#search-variant').value='';void startSearch(query,'');}
  else if(item){item.query=suggestion.name.slice(0,160);item.shops=[];item.checkedAt=null;await saveList();renderWishlist();document.querySelector('#status').textContent='Suchbegriff übernommen. Wunschliste erneut prüfen; Ausführung und Preisgrenze bleiben erhalten.';}
  else{document.querySelector('#search-ean').value='';document.querySelector('#query').value=suggestion.name.slice(0,160);void startSearch(suggestion.name.slice(0,160));}
 });row.append(choose);return row;
}
function eanRow(value,itemId=activeWishlistId){
 const row=el('small');row.className='ean-row';row.append(document.createTextNode('EAN: '+value));
 const button=copyButton(value,async()=>{
  document.querySelector('#search-ean').value=value;
  const item=wishlist.find(item=>item.id===itemId);
  if(item){item.ean=value;await saveList();for(const input of document.querySelectorAll('[data-ean-item]'))if(input.dataset.eanItem===itemId)input.value=value;}
  document.querySelector('#search-ean').focus();document.querySelector('#status').textContent='EAN '+value+' übernommen. Mit „Suchen“ verwenden.';
 });button.title='EAN ins Suchfeld übernehmen';button.setAttribute('aria-label','EAN '+value+' ins Suchfeld übernehmen');row.append(button);return row;
}
function renderTotal(){
 const root=document.querySelector('#wishlist-total');root.replaceChildren();if(!wishlist.length)return;
 const summary=cheapestWishlist(wishlist),box=el('div');box.className='total';
 const heading=el('div');heading.className='total-heading';heading.append(el('strong',(summary.complete?'Günstigster Gesamtpreis: ':'Teilsumme: ')+money(summary.total)),el('small',summary.complete?wishlist.length+' Artikel lieferbar':summary.missing+' Artikel ohne passendes Angebot'));box.append(heading);
 const wrap=el('div');wrap.className='table-wrap';const table=el('table');table.className='total-results';
 const head=el('tr');['Artikel / Variante','Günstigster Shop','Preis','Lagerstatus / Stand','Link'].forEach(text=>head.append(el('th',text)));table.append(head);
 const previous=[];
 for(const {item,best} of summary.rows){
  const row=el('tr'),product=el('td'),shop=el('td'),price=el('td'),stock=el('td'),links=el('td');price.className='price';links.className='result-links';product.append(el('b',item.query));
  const variant=item.variant||best?.variant||'';if(variant&&variant!==best?.name)product.append(el('small',variant));
  const ean=validEAN(best?.ean)||validEAN(item.ean);if(ean)product.append(eanRow(ean,item.id));
  if(best){shop.textContent=best.shop;price.textContent=money(best.price);const badge=el('span',best.stock);badge.className='stock-available';stock.append(badge);const link=el('a','Öffnen ↗');link.href=best.url;link.target='_blank';link.rel='noopener noreferrer';links.append(link,copyButton(best.url));}
  else{shop.textContent='—';price.textContent='—';stock.append(el('span',item.checkedAt?'Kein passendes Angebot':'Noch nicht geprüft'));}
  if(item.checkedAt)stock.append(el('small',new Date(item.checkedAt).toLocaleString('de-DE')));
  row.append(product,shop,price,stock,links);table.append(row);
  for(const oldShop of (item.shops||[]).filter(s=>s.stale))for(const offer of oldShop.offers||[])previous.push({item,shop:oldShop,offer});
  if(!best){const suggestions=[...new Map((item.shops||[]).flatMap(s=>s.suggestions||[]).map(s=>[s.url,s])).values()].slice(0,5);if(suggestions.length){const extra=el('tr'),cell=el('td'),details=el('details');cell.colSpan=5;details.append(el('summary','Ähnliche Produkte ('+suggestions.length+')'));suggestions.forEach(s=>details.append(suggestionRow(s,item)));cell.append(details);extra.append(cell);table.append(extra);}}
 }
 wrap.append(table);box.append(wrap);
 if(previous.length){const details=el('details');details.className='previous-offers';details.append(el('summary','Frühere Angebote · nicht bestätigt ('+previous.length+')'));for(const {item,shop,offer} of previous){const line=el('p');line.append(el('b',item.query),document.createTextNode(' · '+shop.name+' · '+money(offer.price)+' '));const link=el('a','Öffnen ↗');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';line.append(link,copyButton(offer.url));if(shop.checkedAt)line.append(el('small',' · '+new Date(shop.checkedAt).toLocaleString('de-DE')));details.append(line);}box.append(details);}
 root.append(box);
}
document.querySelector('#add-wish').addEventListener('click',async()=>{
 const q=document.querySelector('#query').value.trim(),raw=document.querySelector('#max').value;
 if(!q){document.querySelector('#query').reportValidity();return;}
 if(!document.querySelector('#max').reportValidity()||!document.querySelector('#search-ean').reportValidity())return;
 const requested=document.querySelector('#search-variant').value.trim();
 const shops=q===query&&requested===searchedVariant?[...state.entries()].filter(([,s])=>s.done).map(([name,s])=>({name,...s})):[];
 wishlist.push({id:crypto.randomUUID(),query:q,ean:validEAN(document.querySelector('#search-ean').value),maxPrice:raw===''?null:Number(raw),variant:requested,shops,checkedAt:shops.length?new Date().toISOString():null});
 try{await saveList();renderWishlist();document.querySelector('#status').textContent='Artikel lokal zur Wunschliste hinzugefügt.';}catch{document.querySelector('#status').textContent='Wunschliste konnte nicht gespeichert werden.';}
});
async function recheckWishlistItem(itemId){
 if(checkingList)return;const item=wishlist.find(row=>row.id===itemId);if(!item)return;
 checkingList=true;stopRequested=false;activeWishlistId=itemId;renderWishlist();
 try{
  document.querySelector('#search-ean').value=item.ean||'';document.querySelector('#query').value=item.query;document.querySelector('#max').value=item.maxPrice??'';document.querySelector('#search-variant').value=item.variant||'';
  const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'',item.shops);
  const shops=await pending;
  const updated=applyWishlistSearch(wishlist,itemId,shops,new Date().toISOString());
  await browser.storage.local.set({wishlist:updated});wishlist=updated;renderTotal();
  document.querySelector('#status').textContent='„'+item.query+'“ erneut geprüft.';
 }catch{document.querySelector('#status').textContent='Artikel konnte nicht erneut geprüft werden.';}
 finally{checkingList=false;finishSearch=null;renderWishlist();render();}
}

document.querySelector('#check-wishlist').addEventListener('click',async()=>{
 if(checkingList)return;checkingList=true;stopRequested=false;renderWishlist();
 try{
  for(let i=0;i<wishlist.length&&!stopRequested;i++){
   const item=wishlist[i];activeWishlistId=item.id;document.querySelector('#search-ean').value=item.ean||'';document.querySelector('#query').value=item.query;document.querySelector('#max').value=item.maxPrice??'';document.querySelector('#search-variant').value=item.variant||'';
   document.querySelector('#check-wishlist').textContent='Prüfe '+(i+1)+' / '+wishlist.length+'…';
   const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'',item.shops);const found=await pending;wishlist=applyWishlistSearch(wishlist,item.id,found,new Date().toISOString());await saveList();renderTotal();
  }
  document.querySelector('#status').textContent=stopRequested?'Suche gestoppt. Ergebnisse bleiben erhalten.':'Wunschliste geprüft.';
 }catch{document.querySelector('#status').textContent='Wunschlistenprüfung konnte nicht abgeschlossen werden.';}finally{checkingList=false;finishSearch=null;document.querySelector('#check-wishlist').textContent='Wunschliste prüfen';renderWishlist();render();}
});

function copyButton(url,onUse){
 const button=el('button');button.type='button';button.className='copy-button';button.title='Link kopieren';button.setAttribute('aria-label','Shoplink in die Zwischenablage kopieren');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('aria-hidden','true');
 const back=document.createElementNS(svg.namespaceURI,'path');back.setAttribute('d','M9 5V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2');
 const front=document.createElementNS(svg.namespaceURI,'rect');front.setAttribute('x','3');front.setAttribute('y','7');front.setAttribute('width','14');front.setAttribute('height','14');front.setAttribute('rx','1.5');svg.append(back,front);button.append(svg);
 button.addEventListener('click',async()=>{
  if(onUse){await onUse();return;}
  try{await navigator.clipboard.writeText(url);button.classList.add('copied');button.title='Link kopiert';button.setAttribute('aria-label','Link kopiert');document.querySelector('#status').textContent='Shoplink in die Zwischenablage kopiert.';setTimeout(()=>{button.classList.remove('copied');button.title='Link kopieren';button.setAttribute('aria-label','Shoplink in die Zwischenablage kopieren');},1800);}catch{document.querySelector('#status').textContent='Link konnte nicht kopiert werden. Bitte über das Kontextmenü des Links kopieren.';}
 });return button;
}

// Downloads remain available independently of Firefox add-on storage.
document.querySelector('#export-wishlist').addEventListener('click',()=>{
 if(checkingList||(!wishlist.length&&!state.size))return;
 const raw=document.querySelector('#max').value;
 const screen={wishlistDetails,query:document.querySelector('#query').value,variant:document.querySelector('#search-variant').value,ean:document.querySelector('#search-ean').value,maxPrice:raw===''?null:Number(raw),searchedQuery:query,searchedVariant,shops:[...state.entries()].map(([name,s])=>({name,...s}))};
 const blob=new Blob([wishlistFile(wishlist,screen)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const link=el('a');link.href=url;link.download='teilefinder-wunschliste-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 document.querySelector('#status').textContent='Wunschliste als JSON-Datei zum Download bereitgestellt.';
});
document.querySelector('#import-wishlist').addEventListener('click',()=>{if(!checkingList)document.querySelector('#wishlist-file').click();});
document.querySelector('#wishlist-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file||checkingList)return;
 try{
  if(file.size>2_000_000)throw Error('Die Datei ist zu groß.');
  const incoming=parseWishlistFile(await file.text());if(checkingList)return;
  const updated=mergeWishlistFile(wishlist,incoming),added=updated.length-wishlist.length;
  await browser.storage.local.set({wishlist:updated});wishlist=updated;
  if(incoming.screen){const screen=incoming.screen;wishlistDetails=!!screen.wishlistDetails;void browser.runtime.sendMessage({type:'cancel'});id='';activeWishlistId='';query=screen.searchedQuery;searchedVariant=screen.searchedVariant;document.querySelector('#query').value=screen.query;document.querySelector('#search-variant').value=screen.variant;document.querySelector('#search-ean').value=screen.ean;document.querySelector('#max').value=screen.maxPrice??'';state.clear();screen.shops.forEach(s=>state.set(s.name,s));document.querySelector('#stop-search').hidden=true;render();}
  renderWishlist();
  document.querySelector('#status').textContent=added+' Artikel aus Datei ergänzt. Gespeicherte Ergebnisse wiederhergestellt.';
 }catch(error){document.querySelector('#status').textContent='Import fehlgeschlagen: '+(error instanceof SyntaxError?'Ungültige JSON-Datei.':error.message);}
});


document.querySelector('#stop-search').addEventListener('click',()=>{
 stopRequested=true;void browser.runtime.sendMessage({type:'cancel'});id='';document.querySelector('#stop-search').hidden=true;
 if(finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,shop])=>({name,...shop})));}
 document.querySelector('#status').textContent='Suche gestoppt. Ergebnisse bleiben erhalten.';
});
