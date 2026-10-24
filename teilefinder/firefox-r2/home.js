let currentTab;browser.tabs.getCurrent().then(tab=>{currentTab=tab.id;});
const names=['BIKE24','Bike-Discount','bike-components','r2-bike'];
let searchDeadline;
const state=new Map();let id='',query='',searchedVariant='',wishlist=[],checkingList=false,finishSearch=null,stopRequested=false,activeWishlistId='',wishlistDetails=false;
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const saveList=()=>browser.storage.local.set({wishlist:cleanSavedUrls(wishlist)});
browser.storage.local.get('wishlist').then(d=>{wishlist=Array.isArray(d.wishlist)?cleanSavedUrls(d.wishlist).map(({cart,...item})=>item):[];wishlistDetails=wishlist.some(item=>item.shops?.length);renderWishlist();render();if(d.wishlist)void saveList();}).catch(()=>{document.querySelector('#status').textContent='Wunschliste konnte nicht geladen werden.';});
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function render(){
 const root=document.querySelector('#results');root.replaceChildren();
 if(wishlistDetails){renderWishlistDetails(root);return;}
 for(const name of names){
 const entries=wishlistDetails?wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state):[{item:null,shop:state.get(name)}].filter(e=>e.shop);
 if(!entries.length)continue;const a=el('article'),heading=el('div');heading.className='shop-heading';heading.append(el('h3',name));const search=wishlistDetails?null:entries[0].shop;if(search?.url){const link=el('a','Im Shop suchen ↗');link.href=search.url;link.target='_blank';link.rel='noopener noreferrer';const links=el('span');links.className='shop-links';links.append(link,copyButton(search.url));heading.append(links);}a.append(heading);
 for(const {item,shop:s} of entries){
 const section=el('section');if(item){section.append(el('h4',item.query),el('small',item.variant||'Alle Varianten'));if(s.url){const link=el('a','Im Shop suchen ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';section.append(link,copyButton(s.url));}}
 const range=item||inputPriceRange(document.querySelector('#max')),requested=item?item.variant:document.querySelector('#search-variant').value;
 const rows=uniqueOffers(s.offers||[]).filter(o=>typeof o.price==='number'&&withinPriceRange(o.price,range||{minPrice:Infinity,maxPrice:0})&&variantMatches(o,requested));
 heading.append(copyListButton(s.stale?[]:rows,name));
 if(rows.length){const wrap=el('div');wrap.className='table-wrap';const t=el('table'),head=el('tr');['Produkt / Ausführung','Preis','Lagerstatus','Link'].forEach(v=>head.append(el('th',v)));t.append(head);
 for(const o of rows){const tr=el('tr'),product=el('td');product.append(el('strong',o.name),el('small',o.variant));if(validEAN(o.ean))product.append(eanRow(o.ean,item?.id));const price=el('td',(o.priceKind==='from'?'ab ':'')+new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(o.price));price.className='price';const cell=el('td'),link=el('a','Öffnen ↗');link.href=o.url;link.target='_blank';link.rel='noopener noreferrer';cell.append(link,copyButton(o.url));tr.append(product,price,el('td',o.stock),cell);t.append(tr);}wrap.append(t);section.append(wrap);
 }else section.append(el('p',(s.offers||[]).length?'Keine Angebote innerhalb des Preisbereichs.':s.message));
 if(!(s.offers||[]).length&&s.suggestions?.length)appendSuggestions(section,s.suggestions,range||{minPrice:Infinity,maxPrice:0},item,s.variantAlternatives);
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
  const article=el('article'),heading=el('div');heading.className='shop-heading';heading.append(el('h3',name),el('small',entries.length+' Artikel'),copyListButton(entries.flatMap(({item,shop})=>shop.stale?[]:uniqueOffers(shop.offers||[]).filter(o=>Number.isFinite(o.price)&&withinPriceRange(o.price,item)&&variantMatches(o,item.variant))),name));article.append(heading);
  const wrap=el('div');wrap.className='table-wrap';const table=el('table');table.className='wishlist-results';
  const head=el('tr');['Wunschlistenartikel / Treffer','Preis','Lagerstatus','Links'].forEach(text=>head.append(el('th',text)));table.append(head);
  for(const {item,shop} of entries){
   const offers=uniqueOffers(shop.offers||[]).filter(o=>Number.isFinite(o.price)&&withinPriceRange(o.price,item)&&variantMatches(o,item.variant));
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
    }else{price.textContent='—';stock.append(el('span',(shop.offers||[]).length?'Außerhalb des Preisbereichs':shop.message||'Kein Treffer'));if(validEAN(item.ean))product.append(eanRow(item.ean,item.id));}
    if(index===0){
     if(shop.stale)stock.append(el('small','Vorheriges Ergebnis · nicht bestätigt'));
     if(shop.checkedAt)stock.append(el('small',new Date(shop.checkedAt).toLocaleString('de-DE')));
     if(shop.url){const search=el('a','Suchen ↗');search.href=shop.url;search.target='_blank';search.rel='noopener noreferrer';const line=el('div');line.append(search,copyButton(shop.url));links.append(line);}
    }
    row.append(product,price,stock,links);group.append(row);
   }
   if(!offers.length&&shop.suggestions?.length){const row=el('tr'),cell=el('td');cell.colSpan=4;appendSuggestions(cell,shop.suggestions,item,item,shop.variantAlternatives);row.append(cell);group.append(row);}
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
  const activeItem=wishlist.find(item=>item.id===activeWishlistId);
  const shared=shareVariantEAN([...state.entries()].map(([name,s])=>({name,...s})),searchedVariant,activeItem?.useEAN===false?'':document.querySelector('#search-ean').value);
  document.querySelector('#search-ean').value=activeItem?.useEAN===false?(activeItem.ean||shared.ean):shared.ean;shared.shops.forEach(s=>state.set(s.name,s));
  wishlist=wishlist.map(item=>item.query===query&&(item.variant||'')===searchedVariant?{...item,ean:item.useEAN===false?(item.ean||shared.ean||''):(shared.ean||item.ean||'')}:item);for(const input of document.querySelectorAll('[data-ean-item]')){const item=wishlist.find(row=>row.id===input.dataset.eanItem);if(item&&input!==document.activeElement)input.value=item.ean||'';}void saveList();
 }
 document.querySelector('#export-wishlist').disabled=checkingList||(!wishlist.length&&!state.size);render();const done=[...state.values()].filter(s=>s.done).length;document.querySelector('#status').textContent=done===4?'Suche abgeschlossen.':done+' von 4 Shops fertig · Warte auf '+names.filter(name=>!state.get(name)?.done).join(', ');if(done===4){clearTimeout(searchDeadline);document.querySelector('#stop-search').hidden=true;void recordPriceHistory();}if(done===4&&finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,s])=>({name,...s})));}
});
document.querySelector('#max').addEventListener('input',()=>{inputPriceRange(document.querySelector('#max'));render();});
document.querySelector('#search-variant').addEventListener('input',render);
async function startSearch(q,requested=document.querySelector('#search-variant').value.trim(),savedShops){
 clearTimeout(searchDeadline);searchDeadline=setTimeout(finishTimedOutSearch,105000);
 wishlistDetails=checkingList;
 const same=q===query&&requested===searchedVariant;query=q;searchedVariant=requested;id=crypto.randomUUID();if(!same)state.clear();if(savedShops){state.clear();savedShops.forEach(shop=>state.set(shop.name,shop));}names.forEach(name=>state.set(name,{...state.get(name),offers:state.get(name)?.offers||[],done:false,message:'Shopsuche wird geöffnet…'}));document.querySelector('#stop-search').hidden=false;render();document.querySelector('#status').textContent='Die vier Shops werden in Firefox durchsucht…';
 const useEAN=wishlist.find(item=>item.id===activeWishlistId)?.useEAN!==false;
 try{await browser.runtime.sendMessage({type:'search',query,useEAN,...(inputPriceRange(document.querySelector('#max'))||{}),ean:validEAN(document.querySelector('#search-ean').value),variant:searchedVariant,id,knownShops:knownSearchShops([...state.entries()].map(([name,s])=>({name,offers:s.offers||[]})),wishlist,validEAN(document.querySelector('#search-ean').value)||validEAN(query))});}catch{document.querySelector('#status').textContent='Erweiterung wurde beendet. Bitte neu laden.';if(finishSearch){finishSearch([]);finishSearch=null;}}
}
document.querySelector('#query').addEventListener('input',()=>{document.querySelector('#search-ean').value='';});
document.querySelector('#search-variant').addEventListener('input',()=>{document.querySelector('#search-ean').value='';});
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();if(checkingList)return;if(!inputPriceRange(document.querySelector('#max'))||!document.querySelector('#max').reportValidity())return;const q=document.querySelector('#query').value.trim();if(q){activeWishlistId='';void startSearch(q);}});
function renderWishlist(){
 const root=document.querySelector('#wishlist-items');root.replaceChildren();
 if(!wishlist.length)root.append(el('p','Noch keine Artikel gespeichert.'));
 for(const item of wishlist){
  const row=el('div');row.className='wish-row';
  const nameCell=el('div');nameCell.className='wish-name';const productButton=el('button',item.query);productButton.type='button';productButton.className='wish-product-button';productButton.title='Preise je Shop anzeigen';productButton.addEventListener('click',()=>showWishlistPrices(item.id,productButton));nameCell.append(productButton);
  const rename=el('button','Bearbeiten');rename.type='button';rename.className='secondary rename-button';rename.title='Name korrigieren';rename.setAttribute('aria-label','Name korrigieren: '+item.query);rename.disabled=checkingList;
  rename.addEventListener('click',()=>{
   const form=el('form');form.className='wish-name-editor';const name=el('input');name.value=item.query;name.maxLength=160;name.required=true;name.setAttribute('aria-label','Produktname korrigieren');
   const save=el('button','Speichern');save.type='submit';const cancel=el('button','Abbrechen');cancel.type='button';cancel.className='secondary';
   cancel.addEventListener('click',renderWishlist);
   form.addEventListener('submit',async event=>{
    event.preventDefault();const corrected=name.value.trim();if(checkingList||!corrected)return;
    save.disabled=true;cancel.disabled=true;
    try{const updated=renameWishlistItem(wishlist,item.id,corrected);await browser.storage.local.set({wishlist:cleanSavedUrls(updated)});wishlist=updated;renderWishlist();document.querySelector('#status').textContent='Name gespeichert. Artikel erneut prüfen.';}
    catch{save.disabled=false;cancel.disabled=false;document.querySelector('#status').textContent='Name konnte nicht gespeichert werden.';}
   });
   form.append(name,save,cancel);nameCell.replaceChildren(form);name.focus();name.select();
  });nameCell.append(rename);const history=el('button','Preisverlauf');history.type='button';history.className='history-button';history.addEventListener('click',()=>showPriceHistory(item));nameCell.append(history);const eanLabel=el('label','EAN'),eanInput=el('input');eanInput.value=item.ean||'';eanInput.dataset.eanItem=item.id;eanInput.placeholder='Wird automatisch ergänzt';eanInput.inputMode='numeric';eanInput.pattern='[0-9]{8,14}';eanInput.maxLength=14;eanInput.disabled=checkingList;eanInput.addEventListener('change',()=>{if(eanInput.value&&!validEAN(eanInput.value)){eanInput.reportValidity();return;}item.ean=validEAN(eanInput.value);void saveList();});eanInput.id='ean-'+item.id;eanLabel.htmlFor=eanInput.id;const eanToggle=el('input');eanToggle.type='checkbox';eanToggle.className='ean-toggle';eanToggle.checked=item.useEAN!==false;eanToggle.disabled=checkingList;eanToggle.title='EAN für die Suche verwenden';eanToggle.setAttribute('aria-label','EAN für '+item.query+' verwenden');eanToggle.addEventListener('change',()=>{item.useEAN=eanToggle.checked;void saveList();});const eanHeading=el('span');eanHeading.className='ean-heading';eanHeading.append(document.createTextNode('EAN '),eanToggle);eanLabel.replaceChildren(eanHeading,eanInput);eanLabel.className='wish-ean';row.append(nameCell,eanLabel);
  const recheck=el('button','↻');recheck.type='button';recheck.title='Artikel erneut prüfen';recheck.setAttribute('aria-label','Artikel erneut prüfen: '+item.query);recheck.className='secondary recheck-button';recheck.disabled=checkingList;recheck.addEventListener('click',()=>void recheckWishlistItem(item.id));row.append(recheck);
  const priceLabel=el('label','Preis €'),input=el('input');priceLabel.className='wish-price';input.type='text';input.inputMode='text';input.placeholder='10 / 5-10';input.value=priceRangeText(item);input.disabled=checkingList;
  input.addEventListener('input',()=>inputPriceRange(input));
  input.addEventListener('change',()=>{const range=inputPriceRange(input);if(!range){input.reportValidity();return;}Object.assign(item,range);void saveList();renderTotal();if(wishlistDetails)render();});priceLabel.append(input);row.append(priceLabel);
  const variantLabel=el('label','Ausführung'),variant=el('input');variantLabel.className='wish-variant';variant.className='variant-input';variant.placeholder='Alle Varianten';variant.value=item.variant||'';variant.disabled=checkingList;variant.addEventListener('change',()=>{item.variant=variant.value.trim();item.ean='';eanInput.value='';void saveList();renderTotal();if(wishlistDetails)render();});variantLabel.append(variant);row.append(variantLabel);
  const remove=el('button','×');remove.type='button';remove.className='remove-button';remove.title='Artikel entfernen';remove.setAttribute('aria-label','Artikel entfernen: '+item.query);remove.disabled=checkingList;remove.addEventListener('click',()=>{wishlist=wishlist.filter(i=>i.id!==item.id);void saveList();renderWishlist();});row.append(remove);root.append(row);
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
  if(checkingList||choose.disabled)return;choose.disabled=true;
  try{
  if(variantAlternative){document.querySelector('#search-variant').value='';void startSearch(query,'');}
  else if(item){item.query=suggestion.name.slice(0,160);item.shops=[];item.checkedAt=null;await saveList();await recheckWishlistItem(item.id);}
  else{document.querySelector('#search-ean').value='';document.querySelector('#query').value=suggestion.name.slice(0,160);await startSearch(suggestion.name.slice(0,160));}
  }catch{document.querySelector('#status').textContent='Vorschlag konnte nicht übernommen oder gesucht werden.';}finally{choose.disabled=checkingList;}
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
 const heading=el('div');heading.className='total-heading';heading.append(el('strong',(summary.complete?'Günstigster Gesamtpreis: ':'Teilsumme: ')+money(summary.total)),el('small',summary.complete?wishlist.length+' Artikel lieferbar':summary.missing+' Artikel ohne lieferbares Angebot im Preisbereich'));heading.append(copyListButton(summary.rows.flatMap(({best})=>best?[best]:[])));box.append(heading);
 const wrap=el('div');wrap.className='table-wrap';const table=el('table');table.className='total-results';
 const head=el('tr');['Artikel / Variante','Günstigster Shop','Preis','Lagerstatus / Stand','Link'].forEach(text=>head.append(el('th',text)));table.append(head);
 const previous=[];
 for(const {item,best,missingMessage} of summary.rows){
  const row=el('tr'),product=el('td'),shop=el('td'),price=el('td'),stock=el('td'),links=el('td');price.className='price';links.className='result-links';const productButton=el('button',item.query);productButton.type='button';productButton.className='wish-product-button';productButton.title='Preise und Lieferstatus je Shop anzeigen';productButton.addEventListener('click',()=>showWishlistPrices(item.id,productButton));product.append(productButton);
  const variant=item.variant||best?.variant||'';if(variant&&variant!==best?.name)product.append(el('small',variant));
  const ean=validEAN(best?.ean)||validEAN(item.ean);if(ean)product.append(eanRow(ean,item.id));
  if(best){shop.textContent=best.shop;price.textContent=money(best.price);const badge=el('span','Lieferbar');badge.className='stock-available';stock.append(badge);const link=el('a','Öffnen ↗');link.href=best.url;link.target='_blank';link.rel='noopener noreferrer';links.append(link,copyButton(best.url));}
  else{shop.textContent='—';price.textContent='—';stock.append(el('span',missingMessage));}
  if(item.checkedAt)stock.append(el('small',new Date(item.checkedAt).toLocaleString('de-DE')));
  row.append(product,shop,price,stock,links);table.append(row);
  for(const oldShop of (item.shops||[]).filter(s=>s.stale))for(const offer of oldShop.offers||[])previous.push({item,shop:oldShop,offer});
  if(!best){const suggestions=priceFilteredSuggestions([...new Map((item.shops||[]).flatMap(s=>s.suggestions||[]).map(s=>[s.url,s])).values()],item).slice(0,5);if(suggestions.length){const extra=el('tr'),cell=el('td'),details=el('details');cell.colSpan=5;details.append(el('summary','Ähnliche Produkte ('+suggestions.length+')'));suggestions.forEach(s=>details.append(suggestionRow(s,item)));cell.append(details);extra.append(cell);table.append(extra);}}
 }
 wrap.append(table);box.append(wrap);
 if(previous.length){const details=el('details');details.className='previous-offers';details.append(el('summary','Frühere Angebote · nicht bestätigt ('+previous.length+')'));for(const {item,shop,offer} of previous){const line=el('p');line.append(el('b',item.query),document.createTextNode(' · '+shop.name+' · '+money(offer.price)+' '));const link=el('a','Öffnen ↗');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';line.append(link,copyButton(offer.url));if(shop.checkedAt)line.append(el('small',' · '+new Date(shop.checkedAt).toLocaleString('de-DE')));details.append(line);}box.append(details);}
 root.append(box);
}
document.querySelector('#add-wish').addEventListener('click',async()=>{
 if(checkingList||document.querySelector('#add-wish').disabled)return;
 const q=document.querySelector('#query').value.trim(),raw=document.querySelector('#max').value;
 if(!q){document.querySelector('#query').reportValidity();return;}
 if(!inputPriceRange(document.querySelector('#max'))||!document.querySelector('#max').reportValidity()||!document.querySelector('#search-ean').reportValidity())return;
 const requested=document.querySelector('#search-variant').value.trim();
 const shops=q===query&&requested===searchedVariant?[...state.entries()].filter(([,s])=>s.done).map(([name,s])=>({name,...s})):[];
 const itemId=crypto.randomUUID();
 wishlist.push({id:itemId,query:q,ean:validEAN(document.querySelector('#search-ean').value),...parsePriceRange(raw),variant:requested,shops,checkedAt:shops.length?new Date().toISOString():null});
 document.querySelector('#add-wish').disabled=true;
 try{await saveList();await recheckWishlistItem(itemId);}catch{document.querySelector('#status').textContent='Wunschliste konnte nicht gespeichert werden.';}finally{document.querySelector('#add-wish').disabled=checkingList;}
});
async function recheckWishlistItem(itemId){
 if(checkingList)return;const item=wishlist.find(row=>row.id===itemId);if(!item)return;
 checkingList=true;stopRequested=false;activeWishlistId=itemId;renderWishlist();
 try{
  document.querySelector('#search-ean').value=item.ean||'';document.querySelector('#query').value=item.query;document.querySelector('#max').value=priceRangeText(item);document.querySelector('#search-variant').value=item.variant||'';
  const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'',item.shops);
  const shops=await pending;
  const updated=applyWishlistSearch(wishlist,itemId,shops,new Date().toISOString());
  await browser.storage.local.set({wishlist:cleanSavedUrls(updated)});wishlist=updated;renderTotal();
  document.querySelector('#status').textContent='„'+item.query+'“ erneut geprüft.';
 }catch{document.querySelector('#status').textContent='Artikel konnte nicht erneut geprüft werden.';}
 finally{checkingList=false;finishSearch=null;renderWishlist();render();}
}

document.querySelector('#check-wishlist').addEventListener('click',async()=>{
 if(checkingList)return;checkingList=true;stopRequested=false;renderWishlist();
 try{
  for(let i=0;i<wishlist.length&&!stopRequested;i++){
   const item=wishlist[i];activeWishlistId=item.id;document.querySelector('#search-ean').value=item.ean||'';document.querySelector('#query').value=item.query;document.querySelector('#max').value=priceRangeText(item);document.querySelector('#search-variant').value=item.variant||'';
   document.querySelector('#check-wishlist').textContent='Prüfe '+(i+1)+' / '+wishlist.length+'…';
   const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'',item.shops);const found=await pending;wishlist=applyWishlistSearch(wishlist,item.id,found,new Date().toISOString());await saveList();renderTotal();
  }
  document.querySelector('#status').textContent=stopRequested?'Suche gestoppt. Ergebnisse bleiben erhalten.':'Wunschliste geprüft.';
 }catch{document.querySelector('#status').textContent='Wunschlistenprüfung konnte nicht abgeschlossen werden.';}finally{checkingList=false;finishSearch=null;document.querySelector('#check-wishlist').textContent='Wunschliste prüfen';renderWishlist();render();}
});

function copyListButton(offers,shopName=''){
 const rows=[...new Map(offers.filter(o=>o.url&&deliverable(o.stock)).map(o=>{
  const row={name:String(o.name||'').replace(/\s+/g,' ').trim(),url:cleanShopUrl(o.url),shop:shopName||o.shop||''};return [row.shop+' '+row.name+' '+row.url,row];
 })).values()];
 const button=copyButton('',async()=>{
  try{
   const groups=new Map();for(const row of rows){if(!groups.has(row.shop))groups.set(row.shop,[]);groups.get(row.shop).push(row);}
   const text=[...groups].map(([shop,offers])=>(shop?shop+'\n':'')+offers.map(o=>o.name+' '+o.url).join('\n')).join('\n\n');
   const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
   const html=[...groups].map(([shop,offers])=>'<div>'+(shop?'<strong>'+escape(shop)+'</strong><br>':'')+offers.map(o=>'<a href="'+escape(o.url)+'">'+escape(o.name)+'</a>').join('<br>')+'</div>').join('<br>');
   if(typeof ClipboardItem==='function'&&navigator.clipboard.write){
    await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);
   }else await navigator.clipboard.writeText(text);
   document.querySelector('#status').textContent=rows.length+' lieferbare Artikel mit Name und URL kopiert.';
  }catch{document.querySelector('#status').textContent='Artikel konnten nicht in die Zwischenablage kopiert werden.';}
 });
 button.classList.add('copy-list-button');button.append(document.createTextNode('Lieferbare kopieren'));button.title=rows.length+' lieferbare Artikel mit Name und URL kopieren';button.setAttribute('aria-label',button.title);button.disabled=!rows.length;return button;
}
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
document.querySelector('#export-wishlist').addEventListener('click',async()=>{
 if(checkingList||(!wishlist.length&&!state.size))return;
 const raw=document.querySelector('#max').value;if(!inputPriceRange(document.querySelector('#max'))){document.querySelector('#max').reportValidity();return;}
 const screen={wishlistDetails,query:document.querySelector('#query').value,variant:document.querySelector('#search-variant').value,ean:document.querySelector('#search-ean').value,...parsePriceRange(raw),searchedQuery:query,searchedVariant,shops:[...state.entries()].map(([name,s])=>({name,...s}))};
 let history;try{await historyWrites;history=await priceHistoryDB.all();}catch{document.querySelector('#status').textContent='Preishistorie konnte nicht exportiert werden.';return;}
 const blob=new Blob([wishlistFile(wishlist,screen,history)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const link=el('a');link.href=url;link.download='teilefinder-wunschliste-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 document.querySelector('#status').textContent='Wunschliste als JSON-Datei zum Download bereitgestellt.';
});
document.querySelector('#import-wishlist').addEventListener('click',()=>{if(!checkingList)document.querySelector('#wishlist-file').click();});
document.querySelector('#wishlist-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file||checkingList)return;
 try{
  if(file.size>20_000_000)throw Error('Die Datei ist zu groß.');
  const incoming=parseWishlistFile(await file.text());if(checkingList)return;
  await priceHistoryDB.put(incoming.history||[]);
  const updated=mergeWishlistFile(wishlist,incoming),added=updated.length-wishlist.length;
  await browser.storage.local.set({wishlist:cleanSavedUrls(updated)});wishlist=updated;
  if(incoming.screen){const screen=incoming.screen;wishlistDetails=!!screen.wishlistDetails;void browser.runtime.sendMessage({type:'cancel'});id='';activeWishlistId='';query=screen.searchedQuery;searchedVariant=screen.searchedVariant;document.querySelector('#query').value=screen.query;document.querySelector('#search-variant').value=screen.variant;document.querySelector('#search-ean').value=screen.ean;document.querySelector('#max').value=priceRangeText(screen);state.clear();screen.shops.forEach(s=>state.set(s.name,s));document.querySelector('#stop-search').hidden=true;render();}
  renderWishlist();
  document.querySelector('#status').textContent=added+' Artikel aus Datei ergänzt. Gespeicherte Ergebnisse wiederhergestellt.';
 }catch(error){document.querySelector('#status').textContent='Import fehlgeschlagen: '+(error instanceof SyntaxError?'Ungültige JSON-Datei.':error.message);}
});


document.querySelector('#stop-search').addEventListener('click',()=>{
 clearTimeout(searchDeadline);stopRequested=true;void browser.runtime.sendMessage({type:'cancel'});id='';document.querySelector('#stop-search').hidden=true;
 if(finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,shop])=>({name,...shop})));}
 document.querySelector('#status').textContent='Suche gestoppt. Ergebnisse bleiben erhalten.';
});

let historyWrites=Promise.resolve();
function recordPriceHistory(){
 const rows=priceObservations([...state.entries()].map(([name,s])=>({name,...s})),id,new Date().toISOString());
 historyWrites=historyWrites.then(()=>priceHistoryDB.put(rows)).catch(()=>{document.querySelector('#status').textContent='Preishistorie konnte nicht gespeichert werden.';});return historyWrites;
}
async function showPriceHistory(item){
 if(!validEAN(item.ean)){document.querySelector('#status').textContent='Für den Preisverlauf wird eine bestätigte EAN benötigt.';return;}
 const dialog=el('dialog');dialog.className='price-history-dialog';const heading=el('div');heading.className='shop-heading';heading.append(el('h2',item.query));const close=el('button','Schließen');close.className='secondary';close.addEventListener('click',()=>dialog.close());heading.append(close);dialog.append(heading);
 const controls=el('div');controls.className='history-controls';const range=el('select');for(const [value,label] of [['30','30 Tage'],['90','90 Tage'],['365','1 Jahr'],['0','Gesamter Verlauf']]){const option=el('option',label);option.value=value;range.append(option);}range.value='0';range.setAttribute('aria-label','Zeitraum');controls.append(range);const content=el('div');dialog.append(controls,content);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();content.textContent='Preisverlauf wird geladen…';
 try{await historyWrites;const all=await priceHistoryDB.all(item.ean);const draw=()=>{content.replaceChildren();const cutoff=range.value==='0'?0:Date.now()-Number(range.value)*86400000;const rows=all.filter(r=>Date.parse(r.at)>=cutoff&&r.offers.length);if(!rows.length){content.append(el('p','Noch keine Preise in diesem Zeitraum. Bestätigte, lieferbare Angebote werden bei zukünftigen Suchen gespeichert.'));return;}
 const points=priceHistoryPoints(rows);const low=Math.min(...points.map(p=>p.price)),high=Math.max(...points.map(p=>p.price)),start=points[0].at,end=points.at(-1).at;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 640 220');svg.setAttribute('role','img');svg.setAttribute('aria-label','Günstigster lieferbarer Preis über die Zeit');const node=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
 const x=p=>55+(end===start?260:(p.at-start)/(end-start)*550),y=p=>180-(high===low?65:(p.price-low)/(high-low)*135);node('line',{x1:55,y1:180,x2:605,y2:180,stroke:'var(--line)'});node('text',{x:5,y:48,fill:'var(--muted)','font-size':12},money(high));node('text',{x:5,y:180,fill:'var(--muted)','font-size':12},money(low));node('polyline',{points:points.map(p=>x(p)+','+y(p)).join(' '),fill:'none',stroke:'var(--chart-line)','stroke-width':2});for(const p of points){const dot=node('circle',{cx:x(p),cy:y(p),r:4,fill:'var(--chart-line)'});const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=new Date(p.at).toLocaleString('de-DE')+' · '+money(p.price);dot.append(title);}node('text',{x:55,y:210,fill:'var(--muted)','font-size':12},new Date(start).toLocaleDateString('de-DE'));node('text',{x:605,y:210,'text-anchor':'end',fill:'var(--muted)','font-size':12},new Date(end).toLocaleDateString('de-DE'));content.append(svg);
 content.append(el('p','Tiefstpreis '+money(low)+' · Aktuell '+money(points.at(-1).price)));const table=el('table');const head=el('tr');for(const label of ['Abfrage','Shop','Preis'])head.append(el('th',label));table.append(head);for(const point of points.slice(-100).reverse()){const best=point.row.offers.reduce((a,b)=>a.price<=b.price?a:b);const row=el('tr');row.append(el('td',new Date(point.at).toLocaleString('de-DE')),el('td',best.shop),el('td',money(best.price)));table.append(row);}content.append(table);};range.addEventListener('change',draw);draw();}catch{content.textContent='Preisverlauf konnte nicht geladen werden.';}
}

function appendSuggestions(root,all,range,item,variantAlternatives){
 const suggestions=priceFilteredSuggestions(all,range);
 if(suggestions.length){root.append(el('small',variantAlternatives?'Passendes Produkt · andere Ausführungen':'Ähnliche Produkte'));suggestions.forEach(o=>root.append(suggestionRow(o,item,variantAlternatives)));}
 const hidden=all.length-suggestions.length;
 if(hidden)root.append(el('small',suggestions.length?hidden+' Vorschläge außerhalb des Preisbereichs oder ohne Preis ausgeblendet.':'Keine Vorschläge mit bestätigtem Preis innerhalb des Preisbereichs.'));
}

function showWishlistPrices(itemId,trigger){
 const item=wishlist.find(row=>row.id===itemId);if(!item)return;
 const dialog=el('dialog');dialog.className='price-history-dialog item-prices-dialog';
 const heading=el('div');heading.className='shop-heading';const title=el('h2',item.query);title.id='item-prices-title';dialog.setAttribute('aria-labelledby',title.id);
 const close=el('button','Schließen');close.type='button';close.className='secondary';close.addEventListener('click',()=>dialog.close());heading.append(title,close);dialog.append(heading);
 const meta=[item.variant?'Gewünscht: '+item.variant:'Alle Varianten',item.ean?'EAN: '+item.ean:'',priceRangeText(item)?'Preis €: '+priceRangeText(item):''].filter(Boolean);dialog.append(el('p',meta.join(' · ')));
 const table=el('table'),head=el('tr');['Shop / Variante','Preis','Lagerstatus / Stand','Link'].forEach(label=>head.append(el('th',label)));table.append(head);
 const entries=names.flatMap(name=>wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state).filter(entry=>entry.item.id===itemId));
 const offers=wishlistPriceRows(entries,item);
 for(const {shop,offer} of offers){
   const row=el('tr'),product=el('td');product.append(el('strong',shop.name),el('small',offer.variant||offer.name));
   const price=el('td',(offer.priceKind==='from'?'ab ':'')+money(offer.price));price.className='price';
   const stock=el('td',offer.stock||'Lagerstatus nicht auslesbar');if(shop.stale)stock.append(el('small','Vorheriges Ergebnis · nicht bestätigt'));if(shop.checkedAt)stock.append(el('small',new Date(shop.checkedAt).toLocaleString('de-DE')));
   const links=el('td');if(offer.url){const link=el('a','Öffnen ↗');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';link.addEventListener('click',event=>{event.preventDefault();void browser.tabs.create({url:offer.url}).catch(()=>{document.querySelector('#status').textContent='Shoplink konnte nicht geöffnet werden.';});});links.append(link,copyButton(offer.url));}
   row.append(product,price,stock,links);table.append(row);
 }
 if(!offers.length)dialog.append(el('p','Keine Ergebnisse für die gewünschte Variante innerhalb des Preisbereichs.'));
 const wrap=el('div');wrap.className='table-wrap';wrap.append(table);dialog.append(wrap);document.body.append(dialog);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});dialog.showModal();close.focus();
}

function finishTimedOutSearch(){
 const unfinished=names.filter(name=>!state.get(name)?.done);if(!unfinished.length)return;
 void browser.runtime.sendMessage({type:'cancel'}).catch(()=>{});id='';
 for(const name of unfinished){const previous=state.get(name)||{};state.set(name,{...previous,done:true,stale:!!previous.offers?.length,message:'Zeitlimit überschritten. Vorherige Ergebnisse bleiben erhalten; dieser Shop wurde übersprungen.'});}
 document.querySelector('#stop-search').hidden=true;document.querySelector('#status').textContent='Zeitlimit überschritten. Die Liste wird mit dem nächsten Artikel fortgesetzt.';
 render();
 if(finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,s])=>({name,...s})));}
}
