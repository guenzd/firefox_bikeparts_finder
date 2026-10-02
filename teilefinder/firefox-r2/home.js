let currentTab;browser.tabs.getCurrent().then(tab=>{currentTab=tab.id;});
const names=['BIKE24','Bike-Discount','bike-components','r2-bike'];
const state=new Map();let id='',query='',searchedVariant='',wishlist=[],checkingList=false,finishSearch=null;
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const saveList=()=>browser.storage.local.set({wishlist});
browser.storage.local.get('wishlist').then(d=>{wishlist=Array.isArray(d.wishlist)?d.wishlist:[];renderWishlist();}).catch(()=>{document.querySelector('#status').textContent='Wunschliste konnte nicht geladen werden.';});
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function render(){
 const root=document.querySelector('#results');root.replaceChildren();const raw=document.querySelector('#max').value;const limit=raw===''?Infinity:Number(raw);
 for(const name of names){const s=state.get(name);if(!s)continue;const a=el('article'),heading=el('div');heading.className='shop-heading';heading.append(el('h3',name));if(s.url){const link=el('a','Im Shop suchen ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';const links=el('span');links.className='shop-links';links.append(link,copyButton(s.url));heading.append(links);}a.append(heading);
 const rows=s.offers.filter(o=>typeof o.price==='number'&&o.price<=limit&&variantMatches(o,document.querySelector('#search-variant').value));
 if(rows.length){const wrap=el('div');wrap.className='table-wrap';const t=el('table'),head=el('tr');['Produkt / Ausführung','Preis','Lagerstatus','Link'].forEach(v=>head.append(el('th',v)));t.append(head);
 for(const o of rows){const tr=el('tr'),product=el('td');product.append(el('strong',o.name),el('small',o.variant));const price=el('td',(o.priceKind==='from'?'ab ':'')+new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(o.price));price.className='price';const cell=el('td'),link=el('a','Öffnen ↗');link.href=o.url;link.target='_blank';link.rel='noopener noreferrer';cell.append(link,copyButton(o.url));tr.append(product,price,el('td',o.stock),cell);t.append(tr);}wrap.append(t);a.append(wrap);
 }else a.append(el('p',s.offers.length?'Keine Angebote innerhalb des Maximalpreises.':s.message));
 if(!s.offers.length&&s.suggestions?.length){a.append(el('h4','Ähnliche gefundene Produkte'));for(const suggestion of s.suggestions)a.append(suggestionRow(suggestion));}
 if(s.offers.length>rows.length)a.append(el('small',(s.offers.length-rows.length)+' Angebote durch Preisfilter ausgeblendet.'));
 if(rows.length&&s.message)a.append(el('p',s.message));
 if(s.checkedAt)a.append(el('p','Abfrage: '+new Date(s.checkedAt).toLocaleString('de-DE')));root.append(a);
 }
}
browser.runtime.onMessage.addListener(d=>{
 if(d.target!==currentTab||d.id!==id||!names.includes(d.shop))return;
 const previous=state.get(d.shop);if(d.type==='status')state.set(d.shop,{...previous,message:d.message});
 if(d.type==='result'){
  const offers=(d.offers||[]).filter(o=>{try{const u=new URL(o.url),search=new URL(d.url);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===search.hostname.replace(/^www\./,'')&&typeof o.name==='string'&&Number.isFinite(o.price)&&o.price>0;}catch{return false;}});
  const suggestions=(d.suggestions||[]).filter(o=>{try{return new URL(o.url).protocol==='https:'&&new URL(o.url).hostname.replace(/^www\./,'')===new URL(d.url).hostname.replace(/^www\./,'')&&typeof o.name==='string';}catch{return false;}});
  state.set(d.shop,{offers,suggestions,url:d.url,message:d.message,checkedAt:new Date().toISOString(),done:true});
 }
 render();const done=[...state.values()].filter(s=>s.done).length;document.querySelector('#status').textContent=done===4?'Suche abgeschlossen.':done+' von 4 Shops fertig.';if(done===4&&finishSearch){const finish=finishSearch;finishSearch=null;finish([...state.entries()].map(([name,s])=>({name,...s})));}
});
document.querySelector('#max').addEventListener('input',render);
document.querySelector('#search-variant').addEventListener('input',render);
async function startSearch(q,requested=document.querySelector('#search-variant').value.trim()){
 query=q;searchedVariant=requested;id=crypto.randomUUID();state.clear();names.forEach(name=>state.set(name,{offers:[],message:'Shopsuche wird geöffnet…'}));render();document.querySelector('#status').textContent='Die vier Shops werden in Firefox durchsucht…';
 try{await browser.runtime.sendMessage({type:'search',query,variant:searchedVariant,id});}catch{document.querySelector('#status').textContent='Erweiterung wurde beendet. Bitte neu laden.';if(finishSearch){finishSearch([]);finishSearch=null;}}
}
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();if(checkingList)return;const q=document.querySelector('#query').value.trim();if(q)void startSearch(q);});
function renderWishlist(){
 const root=document.querySelector('#wishlist-items');root.replaceChildren();
 if(!wishlist.length)root.append(el('p','Noch keine Artikel gespeichert.'));
 for(const item of wishlist){
  const row=el('div');row.className='wish-row';row.append(el('strong',item.query));
  const priceLabel=el('label','Max. €'),input=el('input');input.type='number';input.min='0';input.step='0.01';input.placeholder='Ohne Grenze';input.value=item.maxPrice??'';input.disabled=checkingList;
  input.addEventListener('change',()=>{item.maxPrice=input.value===''?null:Number(input.value);void saveList();renderTotal();});priceLabel.append(input);row.append(priceLabel);
  const variantLabel=el('label','Ausführung'),variant=el('input');variant.className='variant-input';variant.placeholder='Alle Varianten';variant.value=item.variant||'';variant.disabled=checkingList;variant.addEventListener('change',()=>{item.variant=variant.value.trim();void saveList();renderTotal();});variantLabel.append(variant);row.append(variantLabel);
  const remove=el('button','Entfernen');remove.disabled=checkingList;remove.addEventListener('click',()=>{wishlist=wishlist.filter(i=>i.id!==item.id);void saveList();renderWishlist();});row.append(remove);root.append(row);
 }
 document.querySelector('#check-wishlist').disabled=checkingList||!wishlist.length;document.querySelector('#add-wish').disabled=checkingList;document.querySelector('#search-submit').disabled=checkingList;
 document.querySelector('#export-wishlist').disabled=checkingList||!wishlist.length;document.querySelector('#import-wishlist').disabled=checkingList;
 renderTotal();
}
function suggestionRow(suggestion,item){
 const row=el('div');row.className='suggestion-row';row.append(el('strong',suggestion.name));
 if(Number.isFinite(suggestion.price))row.append(el('small',(suggestion.priceKind==='from'?'ab ':'')+money(suggestion.price)));
 const link=el('a','Im Shop prüfen ↗');link.href=suggestion.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link,copyButton(suggestion.url));
 const choose=el('button',item?'Für diesen Artikel übernehmen':'Mit diesem Namen suchen');choose.disabled=checkingList;
 choose.addEventListener('click',async()=>{
  if(item){item.query=suggestion.name.slice(0,160);item.shops=[];item.checkedAt=null;await saveList();renderWishlist();document.querySelector('#status').textContent='Suchbegriff übernommen. Wunschliste erneut prüfen; Ausführung und Preisgrenze bleiben erhalten.';}
  else{document.querySelector('#query').value=suggestion.name.slice(0,160);void startSearch(suggestion.name.slice(0,160));}
 });row.append(choose);return row;
}
function renderTotal(){
 const root=document.querySelector('#wishlist-total');root.replaceChildren();if(!wishlist.length)return;
 const summary=cheapestWishlist(wishlist),box=el('div');box.className='total';box.append(el('strong',(summary.complete?'Günstigster Gesamtpreis: ':'Teilsumme: ')+money(summary.total)));
 if(!summary.complete)box.append(el('p',summary.missing+' Artikel ohne passendes Angebot.'));
 for(const {item,best} of summary.rows){
  const row=el('p');row.append(el('b',item.query+': '));
  if(best){row.append(document.createTextNode(best.shop+' · '+best.variant+' · '+money(best.price)+' · '+best.stock+' '));const link=el('a','Im Shop öffnen ↗');link.href=best.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link,copyButton(best.url));}else row.append(document.createTextNode(item.checkedAt?'Kein bestätigtes Angebot innerhalb der Vorgaben.':'Noch nicht geprüft.'));
  if(item.checkedAt)row.append(el('small',' · Stand: '+new Date(item.checkedAt).toLocaleString('de-DE')));if(item.cart?.message)row.append(el('small',' · Warenkorb: '+item.cart.message));box.append(row);
  if(!best){const suggestions=[...new Map((item.shops||[]).flatMap(s=>s.suggestions||[]).map(s=>[s.url,s])).values()].slice(0,5);if(suggestions.length){box.append(el('p','Ähnliche Produkte:'));suggestions.forEach(s=>box.append(suggestionRow(s,item)));}}
 }
 root.append(box);
}
document.querySelector('#add-wish').addEventListener('click',async()=>{
 const q=document.querySelector('#query').value.trim(),raw=document.querySelector('#max').value;
 if(!q){document.querySelector('#query').reportValidity();return;}
 if(!document.querySelector('#max').reportValidity())return;
 const requested=document.querySelector('#search-variant').value.trim();
 const shops=q===query&&requested===searchedVariant?[...state.entries()].filter(([,s])=>s.done).map(([name,s])=>({name,...s})):[];
 wishlist.push({id:crypto.randomUUID(),query:q,maxPrice:raw===''?null:Number(raw),variant:requested,shops,checkedAt:shops.length?new Date().toISOString():null});
 try{await saveList();renderWishlist();document.querySelector('#status').textContent='Artikel lokal zur Wunschliste hinzugefügt.';}catch{document.querySelector('#status').textContent='Wunschliste konnte nicht gespeichert werden.';}
});
document.querySelector('#check-wishlist').addEventListener('click',async()=>{
 if(checkingList)return;checkingList=true;renderWishlist();
 try{
  for(let i=0;i<wishlist.length;i++){
   const item=wishlist[i];document.querySelector('#query').value=item.query;document.querySelector('#max').value=item.maxPrice??'';document.querySelector('#search-variant').value=item.variant||'';
   document.querySelector('#check-wishlist').textContent='Prüfe '+(i+1)+' / '+wishlist.length+'…';
   const pending=new Promise(resolve=>{finishSearch=resolve;});await startSearch(item.query,item.variant||'');item.shops=await pending;item.checkedAt=new Date().toISOString();await saveList();renderTotal();
  }
  await fillWishlistCarts();
  document.querySelector('#status').textContent='Wunschliste geprüft. Warenkorb-Ergebnisse stehen bei den Artikeln.';
 }catch{document.querySelector('#status').textContent='Wunschlistenprüfung konnte nicht abgeschlossen werden.';}finally{checkingList=false;finishSearch=null;document.querySelector('#check-wishlist').textContent='Prüfen & Shop-Warenkörbe befüllen';renderWishlist();}
});

function copyButton(url){
 const button=el('button');button.type='button';button.className='copy-button';button.title='Link kopieren';button.setAttribute('aria-label','Shoplink in die Zwischenablage kopieren');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('aria-hidden','true');
 const back=document.createElementNS(svg.namespaceURI,'path');back.setAttribute('d','M9 5V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2');
 const front=document.createElementNS(svg.namespaceURI,'rect');front.setAttribute('x','3');front.setAttribute('y','7');front.setAttribute('width','14');front.setAttribute('height','14');front.setAttribute('rx','1.5');svg.append(back,front);button.append(svg);
 button.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(url);button.classList.add('copied');button.title='Link kopiert';button.setAttribute('aria-label','Link kopiert');document.querySelector('#status').textContent='Shoplink in die Zwischenablage kopiert.';setTimeout(()=>{button.classList.remove('copied');button.title='Link kopieren';button.setAttribute('aria-label','Shoplink in die Zwischenablage kopieren');},1800);}catch{document.querySelector('#status').textContent='Link konnte nicht kopiert werden. Bitte über das Kontextmenü des Links kopieren.';}
 });return button;
}

// Downloads remain available independently of Firefox add-on storage.
document.querySelector('#export-wishlist').addEventListener('click',()=>{
 if(checkingList||!wishlist.length)return;
 const blob=new Blob([wishlistFile(wishlist)],{type:'application/json'}),url=URL.createObjectURL(blob);
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
  await browser.storage.local.set({wishlist:updated});wishlist=updated;renderWishlist();
  document.querySelector('#status').textContent=added+' Artikel aus Datei ergänzt. Bereits vorhandene Artikel bleiben erhalten.';
 }catch(error){document.querySelector('#status').textContent='Import fehlgeschlagen: '+(error instanceof SyntaxError?'Ungültige JSON-Datei.':error.message);}
});

async function fillWishlistCarts(){
 const summary=cheapestWishlist(wishlist);
 for(const {item,best} of summary.rows){
  if(!best)continue;
  const key=best.shop+'|'+best.url+'|'+best.variant;
  if(item.cart?.key===key&&(item.cart.clicked||item.cart.pending))continue;
  // Persist before dispatch so an interrupted page cannot silently repeat an add.
  item.cart={key,pending:true,message:'Hinzufügen wird geprüft…'};await saveList();renderTotal();
  document.querySelector('#check-wishlist').textContent='Warenkörbe werden befüllt…';
  try{
   const result=await browser.runtime.sendMessage({type:'cart',shop:best.shop,offer:best});
   item.cart={key,clicked:!!result?.clicked,pending:!!result?.uncertain,message:result?.message||'Keine Bestätigung. Bitte im Shop prüfen.'};
  }catch{item.cart={key,pending:true,message:'Keine Bestätigung erhalten. Bitte im Shop prüfen; wird nicht automatisch wiederholt.'};}
  await saveList();renderTotal();
 }
}

