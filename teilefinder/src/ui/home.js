let currentTab;platform.tabs.getCurrent().then(tab=>{currentTab=tab.id;});
const names=['BIKE24','Bike-Discount','bike-components','r2-bike'];
let searchDeadline;
let searchRunning=false;
let wishlistProgress=null;
let wishlistEditor=null;
const state=new Map();let id='',query='',searchedVariant='',searchedEAN='',wishlist=[],checkingList=false,finishSearch=null,stopRequested=false,activeWishlistId='',wishlistDetails=false;
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const saveList=()=>platform.storage.local.set({wishlist:cleanSavedUrls(wishlist)});
platform.storage.local.get('wishlist').then(d=>{wishlist=Array.isArray(d.wishlist)?cleanSavedUrls(d.wishlist).map(({cart,...item})=>item):[];wishlistDetails=wishlist.some(item=>item.shops?.length);renderWishlist();render();if(d.wishlist)void saveList();}).catch(()=>{document.querySelector('#status').textContent='Wunschliste konnte nicht geladen werden.';});
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(tag==='th'){n.scope='col';if(text==='Preis')n.className='price-heading';}return n;};
function appendTableHead(table,row){const head=el('thead');head.append(row);table.append(head);}
function resultMessage(message){
 // Older saved results can still contain these redundant success notices.
 return ['Preise und Lagerstatus direkt auf den gespeicherten Produktseiten aktualisiert.','Produkt anhand der EAN und gewünschten Variante bestätigt.'].includes(message)?'':message||'';
}
function resultLinkActions(label,url){
 const row=el('div');row.className='result-link-actions';
 const link=el('a',label);link.className='result-link-button';link.href=url;link.target='_blank';link.rel='noopener noreferrer';
 const copy=copyButton(url);copy.title=label==='Suchen'?'Suchlink kopieren':'Produktlink kopieren';copy.setAttribute('aria-label',copy.title);
 row.append(link,copy);return row;
}
function render(){
 const savedRoot=document.querySelector('#wishlist-shop-results');savedRoot.replaceChildren();renderWishlistDetails(savedRoot);
 const root=document.querySelector('#results');root.replaceChildren();document.querySelector('#search-results-heading').hidden=wishlistDetails;
 if(wishlistDetails)return;
 for(const name of names){
 const entries=wishlistDetails?wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state):[{item:null,shop:state.get(name)}].filter(e=>e.shop);
 if(!entries.length)continue;const a=el('article'),heading=el('div');a.className='shop-results';heading.className='shop-heading';heading.append(el('h3',name));const search=wishlistDetails?null:entries[0].shop;if(search?.url){const link=el('a','Im Shop suchen');link.href=search.url;link.target='_blank';link.rel='noopener noreferrer';const links=el('span');links.className='shop-links';links.append(link,copyButton(search.url));heading.append(links);}a.append(heading);
 for(const {item,shop:s} of entries){
 const section=el('section'),message=resultMessage(s.message);if(item){section.append(el('h4',item.query),el('small',item.variant||'Alle Varianten'));if(s.url){const link=el('a','Im Shop suchen');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';section.append(link,copyButton(s.url));}}
 const range=item||inputPriceRange(document.querySelector('#max')),requested=item?item.variant:document.querySelector('#search-variant').value;
 const rows=displayedShopOffers(s,{...(range||{minPrice:Infinity,maxPrice:0}),variant:requested});
 const hideEAN=allShopsHaveDisplayedOffers([...state.entries()].map(([name,shop])=>({name,...shop})),{...(range||{minPrice:Infinity,maxPrice:0}),variant:requested});
 if(rows.length){const wrap=el('div');wrap.className='table-wrap';const t=el('table'),head=el('tr');['Produkt / Ausführung','Preis','Lagerstatus','Link'].forEach(v=>head.append(el('th',v)));appendTableHead(t,head);t.setAttribute('aria-label',name+' · Suchergebnisse');
 for(const o of rows){const tr=el('tr'),product=el('td');product.append(el('strong',o.name));if(o.variant&&o.variant!==o.name)product.append(el('small',o.variant));if(validEAN(o.ean)&&!hideEAN)product.append(eanRow(o.ean,item?.id));const price=el('td',(o.priceKind==='from'?'ab ':'')+new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(o.price));price.className='price';const cell=el('td');cell.className='result-links';cell.append(resultLinkActions('Öffnen',o.url));tr.append(product,price,el('td',o.stock),cell);t.append(tr);}wrap.append(t);section.append(wrap);
 }else section.append(el('p',(s.offers||[]).length?'Keine Angebote innerhalb des Preisbereichs.':message));
 if(!(s.offers||[]).length&&s.suggestions?.length)appendSuggestions(section,s.suggestions,range||{minPrice:Infinity,maxPrice:0},item,s.variantAlternatives);
 if(s.comparisonMode!=='cheapest'&&(s.offers||[]).length>rows.length)section.append(el('small',((s.offers||[]).length-rows.length)+' Angebote durch Preisfilter ausgeblendet.'));
 if(rows.length&&message)section.append(el('p',message));
 a.append(section);
 }root.append(a);
 }
}
function renderWishlistDetails(root){
 const displayedItems=wishlist.map(item=>({...item,shops:names.map(name=>({name,...((checkingList&&item.id===activeWishlistId?state.get(name):null)||(item.shops||[]).find(shop=>shop.name===name)||{})}))}));
 const hideEANs=new Map(displayedItems.map(item=>[item.id,allShopsHaveDisplayedOffers(item.shops,item)]));
 const bestOffers=new Map(cheapestWishlist(displayedItems).rows.map(row=>[row.item.id,row.best]));
 for(const name of names){
  const entries=wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state);
  if(!entries.length)continue;
  const article=el('article'),heading=el('div');article.className='shop-results';heading.className='shop-heading';const summary=shopWishlistSummary(entries),meta=el('span',money(summary.total)+' · '+summary.available+'/'+summary.count+' Produkte');meta.className='shop-summary';meta.title='Lieferbare Wunschlistenartikel im Preisbereich';heading.append(el('h3',name),meta,copyListButton(entries.flatMap(({item,shop})=>shop.stale?[]:displayedShopOffers(shop,item)),name));article.append(heading);
  const wrap=el('div');wrap.className='table-wrap';const table=el('table');table.className='wishlist-results';table.setAttribute('aria-label',name+' · Wunschliste');
  const head=el('tr');['Produkt / Ausführung','Preis','Lagerstatus','Links'].forEach(text=>head.append(el('th',text)));appendTableHead(table,head);
  for(const {item,shop} of entries){
   const offers=displayedShopOffers(shop,item);
   const group=el('tbody');
   for(const [index,offer] of (offers.length?offers:[null]).entries()){
    const row=el('tr'),product=el('td'),price=el('td'),stock=el('td'),links=el('td');price.className='price';links.className='result-links';
    if(offer){
     product.append(el('strong',offer.name));
     if(offer.variant&&offer.variant!==offer.name&&!variantMatches({name:offer.name,variant:''},offer.variant))product.append(el('small',offer.variant));

     if(validEAN(offer.ean)&&!hideEANs.get(item.id))product.append(eanRow(offer.ean,item.id));
     price.textContent=(offer.priceKind==='from'?'ab ':'')+money(offer.price);
     const best=bestOffers.get(item.id),difference=best?Math.round((offer.price-best.price)*100)/100:0;
     if(best&&difference!==0&&!shop.stale&&offer.priceKind==='exact'){
      const comparison=el('small');comparison.className='price-comparison';comparison.title='Bestpreis '+money(best.price)+' bei '+best.shop;
      comparison.append(el('span',(difference>0?'+':'−')+money(Math.abs(difference))));
      comparison.setAttribute('aria-label','Bestpreis '+money(best.price)+' · dieses Angebot '+money(Math.abs(difference))+(difference>0?' teurer':' günstiger'));price.append(comparison);
     }
     const availability=el('span',offer.stock);availability.className=deliverable(offer.stock)?'stock-available':(!offer.stock||/nicht auslesbar|unbekannt/i.test(offer.stock)?'stock-unknown':'stock-unavailable');stock.append(availability);
     links.append(resultLinkActions('Öffnen',offer.url));
    }else{product.append(el('strong',item.query));if(item.variant)product.append(el('small',item.variant));price.textContent='—';stock.append(el('span',(shop.offers||[]).length?'Außerhalb des Preisbereichs':resultMessage(shop.message)||'Kein Treffer'));if(validEAN(item.ean)&&!hideEANs.get(item.id))product.append(eanRow(item.ean,item.id));}
    if(index===0){
     if(shop.stale)stock.append(el('small','Vorheriges Ergebnis · nicht bestätigt'));
     if(shop.checkedAt)stock.append(el('small',new Date(shop.checkedAt).toLocaleString('de-DE')));
     if(shop.url)links.append(resultLinkActions('Suchen',shop.url));
    }
    row.append(product,price,stock,links);group.append(row);
   }
   if(!offers.length&&shop.suggestions?.length){const row=el('tr'),cell=el('td');cell.colSpan=4;appendSuggestions(cell,shop.suggestions,item,item,shop.variantAlternatives);row.append(cell);group.append(row);}
   table.append(group);
  }
  wrap.append(table);article.append(wrap);root.append(article);
 }
}
platform.runtime.onMessage.addListener(d=>{
 if(d.target!==currentTab||d.id!==id||!names.includes(d.shop))return;
 const previous=state.get(d.shop);if(d.type==='status')state.set(d.shop,{...previous,message:d.message});
 if(['result','partial-result'].includes(d.type)){
  const offers=(d.offers||[]).filter(o=>{try{const u=new URL(o.url),search=new URL(d.url);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===search.hostname.replace(/^www\./,'')&&typeof o.name==='string'&&Number.isFinite(o.price)&&o.price>0;}catch{return false;}});
  const suggestions=(d.suggestions||[]).filter(o=>{try{return new URL(o.url).protocol==='https:'&&new URL(o.url).hostname.replace(/^www\./,'')===new URL(d.url).hostname.replace(/^www\./,'')&&typeof o.name==='string';}catch{return false;}});
  const requestedEAN=validEAN(d.query);const previousOffers=(previous?.offers||[]).filter(o=>!requestedEAN||equivalentEANs(o.ean,requestedEAN));
  const kept=!offers.length&&previousOffers.length;
  state.set(d.shop,{comparisonMode:d.comparisonMode==='cheapest'||kept&&previous?.comparisonMode==='cheapest'?'cheapest':'',queriedEAN:validEAN(d.query),offers:uniqueOffers(kept?previousOffers:offers),stale:!!kept,suggestions,variantAlternatives:!!d.variantAlternatives,url:d.url,message:kept?'Vorherige Ergebnisse · aktuell nicht bestätigt. '+(d.message||''):d.message,checkedAt:kept?previous.checkedAt:new Date().toISOString(),checked:true,done:d.type==='result'});
 }
 if(d.type==='result'){
  const activeItem=wishlist.find(item=>item.id===activeWishlistId);
  const useEAN=activeItem?activeItem.useEAN!==false:document.querySelector('#search-use-ean').checked!==false;
  const currentEAN=activeItem?activeItem.ean||'':document.querySelector('#search-ean').value;
  const shared=shareVariantEAN([...state.entries()].map(([name,s])=>({name,...s})),searchedVariant,useEAN?currentEAN:'');
  if(!activeItem)document.querySelector('#search-ean').value=!useEAN?(currentEAN||shared.ean):shared.ean;filterConflictingEANs(shared.shops,useEAN?shared.ean:'').forEach(s=>state.set(s.name,s));
  wishlist=wishlist.map(item=>item.query===query&&(item.variant||'')===searchedVariant?{...item,ean:item.useEAN===false?(item.ean||shared.ean||''):(shared.ean||item.ean||'')}:item);for(const input of document.querySelectorAll('[data-ean-item]')){const item=wishlist.find(row=>row.id===input.dataset.eanItem);if(item&&input!==document.activeElement)input.value=item.ean||'';}void saveList();
 }
 document.querySelector('#export-wishlist').disabled=checkingList||(!wishlist.length&&!state.size);render();const done=[...state.values()].filter(s=>s.done).length;updateWishlistProgress([...state.values()].filter(s=>s.checked||s.done).length);document.querySelector('#status').textContent=done===4?'Suche abgeschlossen.':done+' von 4 Shops fertig · Warte auf '+names.filter(name=>!state.get(name)?.done).join(', ');if(done===4){clearTimeout(searchDeadline);setSearchRunning(false);void recordPriceHistory();}if(done===4&&finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,s])=>({name,...s})));}
});
document.querySelector('#max').addEventListener('input',()=>{inputPriceRange(document.querySelector('#max'));render();});
document.querySelector('#search-variant').addEventListener('input',render);
function setWishlistCollapsed(collapsed){
 const toggle=document.querySelector('#wishlist-toggle');
 toggle.setAttribute('aria-expanded',String(!collapsed));toggle.title=collapsed?'Wunschliste aufklappen':'Wunschliste zuklappen';
 document.querySelector('#wishlist-content').hidden=collapsed;
 document.querySelector('.wishlist-files').hidden=collapsed;
 document.querySelector('#check-wishlist').hidden=collapsed;
}
document.querySelector('#wishlist-toggle').addEventListener('click',()=>setWishlistCollapsed(document.querySelector('#wishlist-toggle').getAttribute('aria-expanded')==='true'));
function setSearchRunning(running){
 searchRunning=running;const busy=running||checkingList;
 for(const control of document.querySelectorAll?.('#search input, #search button, #add-wish, #import-wishlist, [data-shop-action], .wishlist-editor input, .wishlist-editor button')||[])control.disabled=busy;
 document.querySelector('#check-wishlist').disabled=!wishlist.length||(running&&!checkingList);
 document.querySelector('#stop-search').hidden=!running;
 const progress=document.querySelector('#status');progress.disabled=!running;progress.title=running?'Suche stoppen':'';
}
async function startSearch(q,requested=document.querySelector('#search-variant').value.trim(),savedShops){
 if(searchRunning)return;
 clearTimeout(searchDeadline);searchDeadline=setTimeout(finishTimedOutSearch,105000);
 wishlistDetails=checkingList;setWishlistCollapsed(!checkingList);
 const same=q===query&&requested===searchedVariant;query=q;searchedVariant=requested;id=crypto.randomUUID();if(!same)state.clear();if(savedShops){state.clear();savedShops.forEach(shop=>state.set(shop.name,shop));}names.forEach(name=>state.set(name,{...state.get(name),offers:state.get(name)?.offers||[],done:false,checked:false,message:'Shopsuche wird geöffnet…'}));setSearchRunning(true);render();document.querySelector('#status').textContent='Suche läuft…';
 const item=checkingList?wishlist.find(row=>row.id===activeWishlistId):null;
 const ean=validEAN(item?item.ean:document.querySelector('#search-ean').value);
 const range=item?{minPrice:item.minPrice,maxPrice:item.maxPrice}:inputPriceRange(document.querySelector('#max'));
 searchedEAN=ean;
 const useEAN=item?item.useEAN!==false:document.querySelector('#search-use-ean').checked!==false;
 try{await platform.runtime.sendMessage({type:'search',query,useEAN,refreshKnown:checkingList,nameFallback:!checkingList&&useEAN,...range,ean,variant:searchedVariant,id,knownShops:knownSearchShops([...state.entries()].map(([name,s])=>({name,comparisonMode:s.comparisonMode,offers:s.offers||[]})),wishlist,ean||validEAN(query))});}catch{setSearchRunning(false);document.querySelector('#status').textContent='Erweiterung wurde beendet. Bitte neu laden.';if(finishSearch){finishSearch([]);finishSearch=null;}}
}
document.querySelector('#query').addEventListener('input',()=>{document.querySelector('#search-ean').value='';});
document.querySelector('#search-variant').addEventListener('input',()=>{document.querySelector('#search-ean').value='';});
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();if(checkingList||searchRunning)return;if(!inputPriceRange(document.querySelector('#max'))||!document.querySelector('#max').reportValidity())return;const q=document.querySelector('#query').value.trim();if(q){activeWishlistId='';void startSearch(q);}});
function enableDirectEditing(input,savedValue){
 let selectOnClick=false;
 input.addEventListener('pointerdown',()=>{selectOnClick=document.activeElement!==input;});
 input.addEventListener('focus',()=>input.select());
 input.addEventListener('click',()=>{if(selectOnClick)input.select();selectOnClick=false;});
 input.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();input.blur();}
  if(event.key==='Escape'){event.preventDefault();input.value=savedValue();input.setCustomValidity('');input.blur();}
 });
}
function wishlistActionIcon(path){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [name,value] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(name,value);
 const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);return svg;
}
function wishlistRowActions(item){
 const actions=el('div');actions.className='wishlist-row-actions';
 const edit=el('button','Bearbeiten');edit.type='button';edit.className='secondary';edit.disabled=checkingList||searchRunning;edit.dataset.shopAction='';
 edit.dataset.editItem=item.id;edit.setAttribute('aria-label','Artikel bearbeiten: '+item.query);edit.setAttribute('aria-expanded',String(wishlistEditor?.id===item.id));if(wishlistEditor?.id===item.id)edit.setAttribute('aria-controls','wish-editor-'+item.id);
 edit.addEventListener('click',()=>{
  if(wishlistEditor?.id===item.id){wishlistEditor=null;renderTotal();return;}
  wishlistEditor={id:item.id,query:item.query,ean:item.ean||'',variant:item.variant||'',price:priceRangeText(item),useEAN:item.useEAN!==false};
  renderTotal();document.querySelector('#wish-editor-'+item.id+' input')?.focus();
 });actions.append(edit);
 const recheck=el('button');recheck.type='button';recheck.className='secondary recheck-button';recheck.title='Artikel erneut prüfen';recheck.setAttribute('aria-label','Artikel erneut prüfen: '+item.query);recheck.disabled=checkingList||searchRunning;recheck.dataset.shopAction='';
 recheck.append(wishlistActionIcon('M20 7v5h-5 M20 12a8 8 0 1 0-2.3 5.7'));recheck.addEventListener('click',()=>{wishlistEditor=null;void recheckWishlistItem(item.id);});
 const remove=el('button');remove.type='button';remove.className='secondary remove-button';remove.title='Artikel entfernen';remove.setAttribute('aria-label','Artikel entfernen: '+item.query);remove.disabled=checkingList||searchRunning;remove.dataset.shopAction='';
 remove.append(wishlistActionIcon('m6 6 12 12 M18 6 6 18'));remove.addEventListener('click',()=>{wishlist=wishlist.filter(row=>row.id!==item.id);if(wishlistEditor?.id===item.id)wishlistEditor=null;void saveList();renderWishlist();});
 actions.append(recheck,remove);return actions;
}
function appendWishlistEditor(table,item){
 if(wishlistEditor?.id!==item.id)return;
 const draft=wishlistEditor,row=el('tr'),cell=el('td'),form=el('form');row.className='wishlist-editor-row';cell.colSpan=6;form.className='wishlist-editor';form.id='wish-editor-'+item.id;form.setAttribute('aria-label','Artikel bearbeiten: '+item.query);
 const field=(text,key)=>{const label=el('label',text),input=el('input');input.value=draft[key];input.disabled=checkingList;input.addEventListener('input',()=>{draft[key]=input.value;});label.append(input);if(key==='ean'){const group=el('div');group.className='editor-ean';group.append(label);form.append(group);}else form.append(label);return input;};
 const name=field('Produktname','query');name.required=true;name.maxLength=160;
 const ean=field('EAN','ean');ean.inputMode='numeric';ean.pattern='[0-9]{8,14}';ean.maxLength=14;ean.placeholder='Wird automatisch ergänzt';ean.dataset.eanItem=item.id;
 const toggleLabel=el('label','EAN verwenden'),toggle=el('input');toggle.type='checkbox';toggle.checked=draft.useEAN;toggle.disabled=checkingList;toggle.addEventListener('change',()=>{draft.useEAN=toggle.checked;});toggleLabel.className='editor-ean-toggle';toggleLabel.append(toggle);ean.parentElement.parentElement.append(toggleLabel);
 const variant=field('Ausführung','variant');variant.maxLength=100;variant.placeholder='Alle Varianten';
 const price=field('Preis €','price');price.placeholder='10 / 5–10';price.addEventListener('input',()=>inputPriceRange(price));
 const buttons=el('div');buttons.className='wishlist-editor-actions';
 const save=el('button','Speichern');save.type='submit';save.disabled=checkingList;
 const cancel=el('button','Abbrechen');cancel.type='button';cancel.className='secondary';cancel.disabled=checkingList;cancel.addEventListener('click',()=>{wishlistEditor=null;renderTotal();document.querySelector('[data-edit-item="'+item.id+'"]')?.focus();});
 buttons.append(save,cancel);form.append(buttons);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(checkingList)return;
  const range=inputPriceRange(price);if(!range){price.reportValidity();return;}if(!form.reportValidity())return;
  const corrected=name.value.trim();if(!corrected)return;
  save.disabled=true;cancel.disabled=true;
  try{
   const renamed=renameWishlistItem(wishlist,item.id,corrected),newVariant=variant.value.trim(),newEAN=validEAN(ean.value);
   const updated=renamed.map(value=>value.id===item.id?{...value,...range,variant:newVariant,ean:newVariant!==(item.variant||'')&&newEAN===(item.ean||'')?'':newEAN,useEAN:toggle.checked}:value);
   await platform.storage.local.set({wishlist:cleanSavedUrls(updated)});wishlist=updated;wishlistEditor=null;renderWishlist();document.querySelector('[data-edit-item="'+item.id+'"]')?.focus();document.querySelector('#status').textContent='Artikel gespeichert.';
  }catch{save.disabled=false;cancel.disabled=false;document.querySelector('#status').textContent='Artikel konnte nicht gespeichert werden.';}
 });
 form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(!cancel.disabled)cancel.click();}});
 cell.append(form);row.append(cell);table.append(row);
}
function renderWishlist(){
 document.querySelector('#check-wishlist').disabled=!wishlist.length;document.querySelector('#check-wishlist').title=checkingList?'Suche stoppen':'';document.querySelector('#add-wish').disabled=checkingList;document.querySelector('#search-submit').disabled=checkingList;
 document.querySelector('#export-wishlist').disabled=checkingList||(!wishlist.length&&!state.size);document.querySelector('#import-wishlist').disabled=checkingList;
 setSearchRunning(searchRunning);renderTotal();render();
}
function suggestionRow(suggestion,item,variantAlternative=false){
 const row=el('div');row.className='suggestion-row';row.append(el('strong',suggestion.name));
 if(validEAN(suggestion.ean))row.append(eanRow(suggestion.ean,item?.id||activeWishlistId));
 if(suggestion.variant)row.append(el('small',suggestion.variant));
 if(Number.isFinite(suggestion.price))row.append(el('small',(suggestion.priceKind==='from'?'ab ':'')+money(suggestion.price)));
 const link=el('a','Im Shop prüfen');link.href=suggestion.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link,copyButton(suggestion.url));
 const choose=el('button',variantAlternative?'Ohne Variantenfilter suchen':item?'Für diesen Artikel übernehmen':'Mit diesem Namen suchen');choose.disabled=checkingList||searchRunning;choose.dataset.shopAction='';
 choose.addEventListener('click',async()=>{
  if(checkingList||searchRunning||choose.disabled)return;choose.disabled=true;
  try{
  if(variantAlternative){document.querySelector('#search-variant').value='';void startSearch(query,'');}
  else if(item){item.query=suggestion.name.slice(0,160);item.shops=[];item.checkedAt=null;await saveList();await recheckWishlistItem(item.id);}
  else{document.querySelector('#search-ean').value='';document.querySelector('#query').value=suggestion.name.slice(0,160);await startSearch(suggestion.name.slice(0,160));}
  }catch{document.querySelector('#status').textContent='Vorschlag konnte nicht übernommen oder gesucht werden.';}finally{choose.disabled=checkingList||searchRunning;}
 });row.append(choose);return row;
}
function eanRow(value,itemId=activeWishlistId){
 const row=el('small');row.className='ean-row';row.append(document.createTextNode('EAN: '+value));
 const button=copyButton(value,async()=>{
  document.querySelector('#search-ean').value=value;
  let copied=false;try{await navigator.clipboard.writeText(value);copied=true;}catch{}
  const item=wishlist.find(item=>item.id===itemId);
  if(item){item.ean=value;await saveList();for(const input of document.querySelectorAll('[data-ean-item]'))if(input.dataset.eanItem===itemId)input.value=value;}
  document.querySelector('#search-ean').focus();document.querySelector('#status').textContent=copied?'EAN übernommen und kopiert.':'EAN übernommen. Kopieren fehlgeschlagen.';
 });button.title='EAN übernehmen und kopieren';button.setAttribute('aria-label','EAN '+value+' übernehmen und kopieren');row.append(button);return row;
}
function renderTotal(){
 const root=document.querySelector('#wishlist-total');root.replaceChildren();if(!wishlist.length){root.append(el('p','Noch keine Artikel gespeichert.'));return;}
 const summary=cheapestWishlist(wishlist),box=el('div');box.className='total';
 const heading=el('div');heading.className='total-heading';heading.append(el('strong',(summary.complete?'Günstigster Gesamtpreis: ':'Teilsumme: ')+money(summary.total)),el('small',summary.complete?wishlist.length+' Artikel lieferbar':summary.missing+' Artikel ohne lieferbares Angebot im Preisbereich'));heading.append(copyListButton(summary.rows.flatMap(({best})=>best?[best]:[])));box.append(heading);
 const wrap=el('div');wrap.className='table-wrap';const table=el('table');table.className='total-results';table.setAttribute('aria-label','Günstigste lieferbare Angebote');
 const head=el('tr');['Artikel / Variante','Günstigster Shop','Preis','Lagerstatus / Stand','Link','Aktionen'].forEach(text=>head.append(el('th',text)));appendTableHead(table,head);
 const previous=[];
 for(const {item,best,availableShops,missingMessage} of summary.rows){
  const row=el('tr'),product=el('td'),shop=el('td'),price=el('td'),stock=el('td'),links=el('td');price.className='price';links.className='result-links';const productButton=el('button',item.query);productButton.type='button';productButton.className='wish-product-button';productButton.title='Preise und Lieferstatus je Shop anzeigen';productButton.addEventListener('click',()=>showWishlistPrices(item.id,productButton));product.append(productButton);
  const variant=item.variant||best?.variant||'';if(variant&&variant!==best?.name)product.append(el('small',variant));


  if(best){shop.textContent=best.shop;price.textContent=money(best.price);const badge=el('span','Lieferbar '+availableShops+'/4');badge.className='stock-available';stock.append(badge);links.append(resultLinkActions('Öffnen',best.url));}
  else{shop.textContent='—';price.textContent='—';stock.append(el('span',missingMessage));}
  const history=el('button',price.textContent);history.type='button';history.className='price-history-trigger';history.title='Preisverlauf';history.setAttribute('aria-label','Preisverlauf für '+item.query);history.addEventListener('click',()=>showPriceHistory(item));price.replaceChildren(history);
  if(item.checkedAt)stock.append(el('small',new Date(item.checkedAt).toLocaleString('de-DE')));
  const actions=el('td');actions.className='wishlist-actions-cell';actions.append(wishlistRowActions(item));row.append(product,shop,price,stock,links,actions);table.append(row);appendWishlistEditor(table,item);
  for(const oldShop of (item.shops||[]).filter(s=>s.stale))for(const offer of oldShop.offers||[])previous.push({item,shop:oldShop,offer});
  if(!best){const suggestions=priceFilteredSuggestions([...new Map((item.shops||[]).flatMap(s=>s.suggestions||[]).map(s=>[s.url,s])).values()],item).slice(0,5);if(suggestions.length){const extra=el('tr'),cell=el('td'),details=el('details');cell.colSpan=6;details.append(el('summary','Ähnliche Produkte ('+suggestions.length+')'));suggestions.forEach(s=>details.append(suggestionRow(s,item)));cell.append(details);extra.append(cell);table.append(extra);}}
 }
 wrap.append(table);box.append(wrap);
 if(previous.length){const details=el('details');details.className='previous-offers';details.append(el('summary','Frühere Angebote · nicht bestätigt ('+previous.length+')'));for(const {item,shop,offer} of previous){const line=el('p');line.append(el('b',item.query),document.createTextNode(' · '+shop.name+' · '+money(offer.price)+' '));const link=el('a','Öffnen');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';line.append(link,copyButton(offer.url));if(shop.checkedAt)line.append(el('small',' · '+new Date(shop.checkedAt).toLocaleString('de-DE')));details.append(line);}box.append(details);}
 root.append(box);
}
document.querySelector('#add-wish').addEventListener('click',async()=>{
 if(checkingList||searchRunning||document.querySelector('#add-wish').disabled)return;
 const q=document.querySelector('#query').value.trim(),raw=document.querySelector('#max').value;
 if(!q){document.querySelector('#query').reportValidity();return;}
 if(!inputPriceRange(document.querySelector('#max'))||!document.querySelector('#max').reportValidity()||!document.querySelector('#search-ean').reportValidity())return;
 const requested=document.querySelector('#search-variant').value.trim(),ean=validEAN(document.querySelector('#search-ean').value);
 const sameEAN=!ean||equivalentEANs(ean,searchedEAN)||[...state.values()].some(shop=>(shop.offers||[]).some(offer=>equivalentEANs(offer.ean,ean)));
 const reuseResults=!wishlistDetails&&q===query&&requested===searchedVariant&&sameEAN&&names.every(name=>state.get(name)?.done);
 const shops=q===query&&requested===searchedVariant?[...state.entries()].filter(([,s])=>s.done).map(([name,s])=>({name,...s})):[];
 const itemId=crypto.randomUUID();
 wishlist.push({id:itemId,query:q,ean,useEAN:document.querySelector('#search-use-ean').checked!==false,...parsePriceRange(raw),variant:requested,shops,checkedAt:shops.reduce((at,shop)=>shop.checkedAt&&(!at||shop.checkedAt>at)?shop.checkedAt:at,null)});
 document.querySelector('#add-wish').disabled=true;
 try{await saveList();if(reuseResults){wishlistDetails=true;setWishlistCollapsed(false);renderWishlist();document.querySelector('#status').textContent='Artikel mit Ergebnissen übernommen.';}else await recheckWishlistItem(itemId);}catch{document.querySelector('#status').textContent='Wunschliste konnte nicht gespeichert werden.';}finally{document.querySelector('#add-wish').disabled=checkingList||searchRunning;}
});
async function recheckWishlistItem(itemId){
 if(checkingList||searchRunning)return;const item=wishlist.find(row=>row.id===itemId);if(!item)return;
 checkingList=true;stopRequested=false;activeWishlistId=itemId;wishlistProgress={completed:0,total:1,percent:0,single:true};updateWishlistProgress();renderWishlist();
 try{
  const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'',item.shops);
  const shops=await pending;
  const updated=applyWishlistSearch(wishlist,itemId,shops,new Date().toISOString());
  await platform.storage.local.set({wishlist:cleanSavedUrls(updated)});wishlist=updated;renderTotal();
  document.querySelector('#status').textContent='„'+item.query+'“ erneut geprüft.';
 }catch{document.querySelector('#status').textContent='Artikel konnte nicht erneut geprüft werden.';}
 finally{checkingList=false;finishSearch=null;wishlistProgress=null;updateWishlistProgress();renderWishlist();render();}
}

function updateWishlistProgress(shopsDone=0){
 const button=document.querySelector('#check-wishlist');
 button.classList.toggle('is-checking',!!wishlistProgress);
 if(!wishlistProgress){button.style.removeProperty('--wishlist-progress');button.removeAttribute('aria-label');button.textContent='Wunschliste prüfen';return;}
 const {completed,total}=wishlistProgress;
 const fraction=(completed+Math.min(4,Math.max(0,shopsDone))/4)/total;
 wishlistProgress.percent=Math.max(wishlistProgress.percent,Math.min(100,Math.round(fraction*100)));
 button.style.setProperty('--wishlist-progress',wishlistProgress.percent+'%');
 button.textContent=wishlistProgress.single?Math.min(4,Math.max(0,shopsDone))+' / 4 Shops…':'Prüfe '+Math.min(completed+1,total)+' / '+total+'…';
 button.setAttribute('aria-label','Wunschliste prüfen: '+wishlistProgress.percent+' Prozent abgeschlossen. Klicken zum Stoppen.');
}
document.querySelector('#check-wishlist').addEventListener('click',async()=>{
 if(checkingList){stopCurrentSearch();return;}if(searchRunning||!wishlist.length)return;checkingList=true;stopRequested=false;wishlistProgress={completed:0,total:wishlist.length,percent:0};updateWishlistProgress();renderWishlist();
 try{
  for(let i=0;i<wishlist.length&&!stopRequested;i++){
   const item=wishlist[i];activeWishlistId=item.id;
   wishlistProgress.completed=i;updateWishlistProgress();
   const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'',item.shops);const found=await pending;if(!stopRequested){wishlistProgress.completed=i+1;updateWishlistProgress();}wishlist=applyWishlistSearch(wishlist,item.id,found,new Date().toISOString());await saveList();renderTotal();
  }
  document.querySelector('#status').textContent=stopRequested?'Suche gestoppt.':'Wunschliste geprüft.';
 }catch{document.querySelector('#status').textContent='Wunschlistenprüfung konnte nicht abgeschlossen werden.';}finally{checkingList=false;finishSearch=null;wishlistProgress=null;updateWishlistProgress();renderWishlist();render();}
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
   document.querySelector('#status').textContent=rows.length+' lieferbare Artikel kopiert.';
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
  try{await navigator.clipboard.writeText(url);button.classList.add('copied');button.title='Link kopiert';button.setAttribute('aria-label','Link kopiert');document.querySelector('#status').textContent='Link kopiert.';setTimeout(()=>{button.classList.remove('copied');button.title='Link kopieren';button.setAttribute('aria-label','Shoplink in die Zwischenablage kopieren');},1800);}catch{document.querySelector('#status').textContent='Link konnte nicht kopiert werden. Bitte über das Kontextmenü des Links kopieren.';}
 });return button;
}

// Downloads remain available independently of Firefox add-on storage.
document.querySelector('#export-wishlist').addEventListener('click',async()=>{
 if(checkingList||(!wishlist.length&&!state.size))return;
 const raw=document.querySelector('#max').value;if(!inputPriceRange(document.querySelector('#max'))){document.querySelector('#max').reportValidity();return;}
 const screen={wishlistDetails,query:document.querySelector('#query').value,variant:document.querySelector('#search-variant').value,ean:document.querySelector('#search-ean').value,useEAN:document.querySelector('#search-use-ean').checked!==false,...parsePriceRange(raw),searchedQuery:query,searchedVariant,shops:[...state.entries()].map(([name,s])=>({name,...s}))};
 let history;try{await historyWrites;history=await priceHistoryDB.all();}catch{document.querySelector('#status').textContent='Preishistorie konnte nicht exportiert werden.';return;}
 const blob=new Blob([wishlistFile(wishlist,screen,history)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const link=el('a');link.href=url;link.download='teilefinder-wunschliste-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 document.querySelector('#status').textContent='Datei gespeichert.';
});
document.querySelector('#import-wishlist').addEventListener('click',()=>{if(!checkingList&&!searchRunning)document.querySelector('#wishlist-file').click();});
document.querySelector('#wishlist-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file||checkingList||searchRunning)return;
 try{
  if(file.size>20_000_000)throw Error('Die Datei ist zu groß.');
  const incoming=parseWishlistFile(await file.text());if(checkingList||searchRunning)return;
  await priceHistoryDB.put(incoming.history||[]);
  const updated=mergeWishlistFile(wishlist,incoming),added=updated.length-wishlist.length;
  await platform.storage.local.set({wishlist:cleanSavedUrls(updated)});wishlist=updated;
  if(incoming.screen){const screen=incoming.screen;wishlistDetails=!!screen.wishlistDetails;void platform.runtime.sendMessage({type:'cancel'});id='';activeWishlistId='';query=screen.searchedQuery;searchedVariant=screen.searchedVariant;searchedEAN=validEAN(screen.ean);document.querySelector('#search-use-ean').checked=screen.useEAN!==false;document.querySelector('#query').value=screen.query;document.querySelector('#search-variant').value=screen.variant;document.querySelector('#search-ean').value=screen.ean;document.querySelector('#max').value=priceRangeText(screen);state.clear();screen.shops.forEach(s=>state.set(s.name,s));setSearchRunning(false);render();}
  renderWishlist();
  document.querySelector('#status').textContent=added+' Artikel importiert · Ergebnisse wiederhergestellt.';
 }catch(error){document.querySelector('#status').textContent='Import fehlgeschlagen: '+(error instanceof SyntaxError?'Ungültige JSON-Datei.':error.message);}
});


function stopCurrentSearch(){
 clearTimeout(searchDeadline);stopRequested=true;void platform.runtime.sendMessage({type:'cancel'});id='';setSearchRunning(false);
 if(finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,shop])=>({name,...shop})));}
 document.querySelector('#status').textContent='Suche gestoppt.';
}
document.querySelector('#stop-search').addEventListener('click',stopCurrentSearch);
document.querySelector('#status').addEventListener('click',()=>{if(!document.querySelector('#status').disabled)stopCurrentSearch();});
document.querySelector('#close-shop-tabs').addEventListener('click',async()=>{
 const button=document.querySelector('#close-shop-tabs');if(button.disabled)return;button.disabled=true;
 stopCurrentSearch();
 try{await platform.runtime.sendMessage({type:'close-shop-tabs'});document.querySelector('#status').textContent='Shop-Tabs geschlossen.';}
 catch{document.querySelector('#status').textContent='Shop-Tabs konnten nicht geschlossen werden.';}
 finally{button.disabled=false;}
});

let historyWrites=Promise.resolve();
function recordPriceHistory(){
 const rows=priceObservations([...state.entries()].map(([name,s])=>({name,...s})),id,new Date().toISOString());
 historyWrites=historyWrites.then(()=>priceHistoryDB.put(rows)).catch(()=>{document.querySelector('#status').textContent='Preishistorie konnte nicht gespeichert werden.';});return historyWrites;
}
function dialogCloseButton(dialog){
 const button=el('button'),icon=el('span','×');button.type='button';button.className='secondary dialog-close';button.title='Schließen';button.setAttribute('aria-label','Schließen');icon.setAttribute('aria-hidden','true');button.append(icon);button.addEventListener('click',()=>dialog.close());return button;
}
function priceResultsTimes(offers,fallback){
 const times=[...new Set(offers.map(({shop})=>Date.parse(shop.checkedAt)).filter(Number.isFinite).map(time=>Math.floor(time/1000)*1000))].sort((a,b)=>a-b);
 if(times.length)return times.length===1?times:[times[0],times.at(-1)];
 const time=Date.parse(fallback);return Number.isFinite(time)?[time]:[];
}
async function showPriceHistory(item){
 if(!validEAN(item.ean)){document.querySelector('#status').textContent='Für den Preisverlauf wird eine bestätigte EAN benötigt.';return;}
 const trigger=document.activeElement,dialog=el('dialog');dialog.className='price-history-dialog';const heading=el('div'),title=el('h2',item.query);title.id='price-history-title';dialog.setAttribute('aria-labelledby',title.id);heading.className='shop-heading';heading.append(title);const close=dialogCloseButton(dialog);heading.append(close);dialog.append(heading);
 const controls=el('div');controls.className='history-controls';const range=el('select');for(const [value,label] of [['30','30 Tage'],['90','90 Tage'],['365','1 Jahr'],['0','Gesamter Verlauf']]){const option=el('option',label);option.value=value;range.append(option);}range.value='0';range.setAttribute('aria-label','Zeitraum');controls.append(range);const content=el('div');dialog.append(controls,content);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});dialog.showModal();close.focus();content.textContent='Preisverlauf wird geladen…';
 try{await historyWrites;const all=await priceHistoryDB.all(item.ean);const draw=()=>{content.replaceChildren();const cutoff=range.value==='0'?0:Date.now()-Number(range.value)*86400000;const rows=all.filter(r=>Date.parse(r.at)>=cutoff&&r.offers.length);if(!rows.length){content.append(el('p','Keine Preise in diesem Zeitraum.'));return;}
 const points=priceHistoryPoints(rows);const low=Math.min(...points.map(p=>p.price)),high=Math.max(...points.map(p=>p.price)),start=points[0].at,end=points.at(-1).at;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','history-chart');svg.setAttribute('viewBox','0 0 640 220');svg.setAttribute('role','img');svg.setAttribute('aria-label','Günstigster lieferbarer Preis über die Zeit');const node=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
 const x=p=>55+(end===start?260:(p.at-start)/(end-start)*550),y=p=>180-(high===low?65:(p.price-low)/(high-low)*135);node('line',{x1:55,y1:180,x2:605,y2:180,stroke:'var(--line)'});node('text',{x:5,y:high===low?115:48,fill:'var(--muted)','font-size':12},money(high));if(high!==low)node('text',{x:5,y:180,fill:'var(--muted)','font-size':12},money(low));node('polyline',{points:points.map(p=>x(p)+','+y(p)).join(' '),fill:'none',stroke:'var(--chart-line)','stroke-width':2});for(const p of points){const dot=node('circle',{cx:x(p),cy:y(p),r:4,fill:'var(--chart-line)'});const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=new Date(p.at).toLocaleString('de-DE')+' · '+money(p.price);dot.append(title);}node('text',{x:55,y:210,fill:'var(--muted)','font-size':12},new Date(start).toLocaleDateString('de-DE'));node('text',{x:605,y:210,'text-anchor':'end',fill:'var(--muted)','font-size':12},new Date(end).toLocaleDateString('de-DE'));content.append(svg);
 const latest=rows.reduce((a,b)=>Date.parse(a.at)>Date.parse(b.at)?a:b);content.append(el('p','Tiefstpreis '+money(low)+' · Aktuell '+money(Math.min(...latest.offers.map(o=>o.price)))));const table=el('table');table.setAttribute('aria-label','Preisverlauf für '+item.query);const head=el('tr');for(const label of ['Abfrage','Shop','Preis'])head.append(el('th',label));appendTableHead(table,head);for(const point of points.slice(-100).reverse()){const best=point.row.offers.reduce((a,b)=>a.price<=b.price?a:b);const row=el('tr'),price=el('td',money(best.price));price.className='price';row.append(el('td',new Date(point.at).toLocaleString('de-DE')),el('td',best.shop),price);table.append(row);}content.append(table);};range.addEventListener('change',draw);draw();}catch{content.textContent='Preisverlauf konnte nicht geladen werden.';}
}

function appendSuggestions(root,all,range,item,variantAlternatives){
 const suggestions=priceFilteredSuggestions(all,range);
 if(suggestions.length){root.append(el('small',variantAlternatives?'Andere Varianten':'Ähnliche Produkte'));suggestions.forEach(o=>root.append(suggestionRow(o,item,variantAlternatives)));}
 const hidden=all.length-suggestions.length;
 if(hidden)root.append(el('small',suggestions.length?hidden+' Vorschläge außerhalb des Preisbereichs oder ohne Preis ausgeblendet.':'Keine Vorschläge mit bestätigtem Preis innerhalb des Preisbereichs.'));
}

function showWishlistPrices(itemId,trigger){
 const item=wishlist.find(row=>row.id===itemId);if(!item)return;
 const dialog=el('dialog');dialog.className='price-history-dialog item-prices-dialog';
 const heading=el('div');heading.className='shop-heading';const title=el('h2',item.query);title.id='item-prices-title';dialog.setAttribute('aria-labelledby',title.id);
 const close=dialogCloseButton(dialog);heading.append(title,close);dialog.append(heading);
 const meta=[item.variant?'Gewünscht: '+item.variant:'Alle Varianten',item.ean?'EAN: '+item.ean:'',priceRangeText(item)?'Preis €: '+priceRangeText(item):''].filter(Boolean),info=el('div');info.className='item-prices-info';info.append(el('span',meta.join(' · ')));dialog.append(info);
 const table=el('table'),head=el('tr');table.setAttribute('aria-label','Shoppreise für '+item.query);['Shop / Variante','Preis','Lagerstatus','Aktionen'].forEach(label=>head.append(el('th',label)));appendTableHead(table,head);
 const entries=names.flatMap(name=>wishlistShopEntries(wishlist,name,checkingList?activeWishlistId:'',state).filter(entry=>entry.item.id===itemId));
 const offers=wishlistPriceRows(entries,item),times=priceResultsTimes(offers,item.checkedAt);
 if(times.length){const updated=el('span','Stand: '+times.map(time=>new Date(time).toLocaleString('de-DE')).join(' – '));updated.className='item-prices-updated';info.append(updated);}
 for(const {shop,offer} of offers){
   const row=el('tr'),product=el('td');product.append(el('strong',shop.name),el('small',offer.variant||offer.name));
   const price=el('td',(offer.priceKind==='from'?'ab ':'')+money(offer.price));price.className='price';
   const stock=el('td',offer.stock||'Lagerstatus nicht auslesbar');if(shop.stale)stock.append(el('small','Vorheriges Ergebnis · nicht bestätigt'));
   const links=el('td');links.className='shop-actions-cell';if(offer.url){const actions=el('div');actions.className='shop-actions';const link=el('a','Zum Shop');link.className='shop-link-button';link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Zum Shop: '+shop.name+' · '+offer.name);link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();void platform.tabs.create({url:offer.url}).catch(()=>{document.querySelector('#status').textContent='Shoplink konnte nicht geöffnet werden.';});});const copy=copyButton(offer.url);copy.title='Produktlink kopieren';copy.setAttribute('aria-label','Produktlink von '+shop.name+' kopieren');actions.append(link,copy);links.append(actions);}
   row.append(product,price,stock,links);table.append(row);
 }
 if(!offers.length)dialog.append(el('p','Keine Ergebnisse für die gewünschte Variante innerhalb des Preisbereichs.'));
 const wrap=el('div');wrap.className='table-wrap';wrap.append(table);dialog.append(wrap);document.body.append(dialog);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});dialog.showModal();close.focus();
}

function finishTimedOutSearch(){
 const unfinished=names.filter(name=>!state.get(name)?.done);if(!unfinished.length)return;
 void platform.runtime.sendMessage({type:'cancel'}).catch(()=>{});id='';
 for(const name of unfinished){const previous=state.get(name)||{};state.set(name,{...previous,done:true,stale:!!previous.offers?.length,message:'Zeitlimit überschritten · vorherige Ergebnisse'});}
 setSearchRunning(false);document.querySelector('#status').textContent='Zeitlimit überschritten · nächster Artikel';
 render();
 if(finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,s])=>({name,...s})));}
}
