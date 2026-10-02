import { launchSession } from './browser-session.mjs';
import { SHOPS, safeUrl, euro, stockText, matches, structuredOffers, dedupe, readCards, readBikeDiscountCards } from './extract.mjs';
import { bcProducts, bcOffers, jsonData } from '../lib/shop-search.ts';
let contextPromise;
const verificationPages=new Map();
export async function closeBrowser(){const c=await contextPromise?.catch(()=>null);contextPromise=undefined;await c?.close();}
async function context(){
 if(!contextPromise)contextPromise=launchSession({visible:process.env.TEILEFINDER_SHOW_BROWSER!=='0'}).then(c=>{c.setDefaultTimeout(12000);c.once('close',()=>{contextPromise=undefined;});return c;}).catch(e=>{contextPromise=undefined;throw e;});
 return contextPromise;
}
async function load(page,url,host){
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 if(!safeUrl(page.url(),host))throw Error('Unerwartete Shop-Weiterleitung.');
 const challenge=/Access Denied|Just a moment\.\.\.|Verifying you are human|Verify you are human|Sicherheitsüberprüfung|Checking your browser|Bestätigen Sie.{0,40}(?:Mensch|human)/i;
 let text=await page.locator('body').innerText();
 if(challenge.test(text.slice(0,4000))){
  // Allow the shop's normal page load to finish; interactive checks stay with the user.
  await page.waitForFunction(()=>! /Access Denied|Just a moment\.\.\.|Verifying you are human|Verify you are human|Sicherheitsüberprüfung|Checking your browser|Bestätigen Sie.{0,40}(?:Mensch|human)/i.test(document.body.innerText.slice(0,4000)),{},{timeout:12000}).catch(()=>{});
  text=await page.locator('body').innerText();
  if(challenge.test(text.slice(0,4000)))throw Error('Der Shop verlangt eine Sicherheitsprüfung.');
 }else if(response?.status()>=400)throw Error('Der Shop verlangt eine Sicherheitsprüfung.');
 for(const label of ['Ablehnen','Alle ablehnen','Alles ablehnen','Nur notwendige Cookies','Nur erforderliche Cookies','Nur essenzielle Cookies','Reject all']){
  const b=page.getByRole('button',{name:label,exact:true});
  if(await b.count()&&await b.first().isVisible()){await b.first().click();break;}
 }
 return page;
}
async function structured(page,shop,q){const json=await page.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.flatMap(n=>{try{return [JSON.parse(n.textContent)];}catch{return [];}}));return structuredOffers(json,shop.host,page.url(),q);}
async function bc(page,shop,q){await page.waitForFunction(()=>document.body.innerText.includes('Such')&&document.querySelectorAll('[data-props]').length>0,{},{timeout:15000}).catch(()=>{});const products=bcProducts(await page.content()).filter(p=>/^\d{8,14}$/.test(q)||matches(p.productName,q)).slice(0,3);const rows=[];for(const p of products){const url=safeUrl(p.link,shop.host);if(!url)continue;try{await load(page,url,shop.host);const offers=bcOffers(await page.content(),shop.host,p.productId);rows.push(...offers.map(o=>({...o,priceKind:'exact',source:'Produktseite'})));if(!offers.length)rows.push({name:p.productName,variant:'Ausführung im Shop prüfen',price:euro(p.priceRaw),priceKind:'from',stock:'Lagerstatus nicht auslesbar',url,source:'Suchseite'});}catch{rows.push({name:p.productName,variant:'Ausführung im Shop prüfen',price:euro(p.priceRaw),priceKind:'from',stock:'Lagerstatus nicht auslesbar',url,source:'Suchseite'});}}return rows;}
async function discount(page,shop,q,cards){
 const rows=[];
 for(const card of cards.slice(0,4)){
  const initialCount=rows.length;
  try{
  await load(page,card.url,shop.host);
  const picker=page.locator('#productDetailConfiguratorOptions');
  if(await picker.count()){
   await picker.first().click();
   const variants=await page.locator('.nele-product-detail-configurator-option input[type="radio"]').evaluateAll(nodes=>nodes.map(n=>({id:n.id,text:n.parentElement.querySelector('label')?.innerText.trim()||''})).filter(o=>o.id&&o.text));
   if(variants.length){
    for(const variant of variants.slice(0,5)){
     try{
     if(await picker.getAttribute('aria-expanded')!=='true')await picker.click();
     await page.locator('label[for='+JSON.stringify(variant.id)+']').click();
     await page.waitForFunction(text=>document.querySelector('#productDetailConfiguratorOptions')?.innerText.includes(text)&&!document.querySelector('.product-detail-price')?.innerText.trim().startsWith('ab '),variant.text,{timeout:15000});
     const current=await page.evaluate(()=>({name:document.querySelector('h1')?.innerText.trim(),price:document.querySelector('.product-detail-price')?.innerText.trim(),stock:document.querySelector('.nele-product-availability-info')?.innerText.trim(),selected:document.querySelector('#productDetailConfiguratorOptions')?.innerText.trim()}));
     const amount=euro(current.price?.replace(/€/g,''));
     rows.push({name:current.name||card.name,variant:current.selected||variant.text,price:amount,priceKind:'exact',stock:stockText(current.stock||''),url:page.url(),source:'Ausgewählte Produktvariante'});
     }catch(e){console.error('Bike-Discount Variante: '+String(e.message).split('\n')[0]);}
    }
    if(rows.length===initialCount)rows.push(listingOffer(card));
    continue;
   }
  }
  const data=await structured(page,shop,q);
  if(data.length)rows.push(...data);else rows.push(await detailFallback(page,card,'Ausführung im Shop prüfen'));
  }catch(e){console.error('Bike-Discount Produkt: '+String(e.message).split('\n')[0]);if(rows.length===initialCount)rows.push(listingOffer(card));}
 }
 return rows;
}
function listingOffer(card){return {name:card.name,variant:'Ausführung im Shop prüfen',price:card.price,priceKind:card.priceKind,stock:'Lagerstatus nicht auslesbar',url:card.url,source:'Suchseite · Produktdetails nicht abrufbar'};}
async function detailFallback(page,card,variant){const data=await page.evaluate(()=>{const h=document.querySelector('h1');const main=document.querySelector('[itemtype$="/Product"]')||document.querySelector('main')||document.querySelector('.content-main')||document.body;return {name:h?.innerText?.trim()||'',text:main.innerText||''};});return {name:data.name||card.name,variant,price:card.price,priceKind:card.priceKind,stock:stockText(data.text.split(/Beschreibung|Wird oft zusammen gekauft|Zuletzt angesehen/)[0]),url:page.url(),source:'Suchpreis · Lieferangabe der Produktseite'};}
export async function searchOne(shop,q){const url=shop.search(q);const result={name:shop.name,url,offers:[],message:'',checkedAt:new Date().toISOString()};let page,keepOpen=false;try{const saved=verificationPages.get(shop.id);verificationPages.delete(shop.id);page=saved&&!saved.isClosed()?saved:await(await context()).newPage();await load(page,url,shop.host);if(shop.id==='bike-components')result.offers=await bc(page,shop,q);else{
 await page.waitForFunction(()=>document.body.innerText.includes('€')||/keine (?:Treffer|Ergebnisse)|0 Treffer|no results/i.test(document.body.innerText),{},{timeout:18000}).catch(()=>{});
 if(shop.id==='bike-discount')await page.locator('.product-title a[href]').first().waitFor({state:'visible',timeout:18000}).catch(()=>{});
 const cards=await page.evaluate(shop.id==='bike-discount'?readBikeDiscountCards:readCards,{host:shop.host,q});
 if(shop.id==='bike-discount')result.offers=await discount(page,shop,q,cards);else result.offers=cards.map(c=>({name:c.name,variant:c.priceKind==='from'?'Ausführung im Shop prüfen':'Ausführung laut Produktname',price:c.price,priceKind:c.priceKind,stock:stockText(c.text),url:c.url,source:'Suchseite'}));
 if(!result.offers.length)result.offers=await structured(page,shop,q);
 }
 if(/^\d{8,14}$/.test(q))result.offers=result.offers.map(o=>({...o,variant:'EAN im Shop prüfen · '+o.variant}));
 result.offers=dedupe(result.offers).sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));if(!result.offers.length)result.message='Keine passenden Angebote ausgelesen. Bitte eine genaue Modellbezeichnung verwenden.';
 }catch(e){console.error(shop.name+': '+String(e.message).split('\n')[0]);if(/Sicherheitsprüfung/.test(e.message)&&page&&!page.isClosed()&&process.env.TEILEFINDER_SHOW_BROWSER!=='0'){keepOpen=true;verificationPages.set(shop.id,page);await page.bringToFront().catch(()=>{});}result.message=/Sicherheitsprüfung/.test(e.message)?(keepOpen?'Sicherheitsprüfung im geöffneten Shop-Browser. Bitte dort selbst abschließen und anschließend erneut suchen.':'Der Shop verlangt eine Sicherheitsprüfung. Bitte den Shop direkt öffnen.'):/browserType|Executable|Target page/.test(e.message)?'Der lokale Browser konnte nicht starten. Bitte Teilefinder über die Startdatei öffnen.':'Die Shop-Abfrage ist fehlgeschlagen. Bitte direkt im Shop prüfen.';}finally{if(!keepOpen)await page?.close().catch(()=>{});result.checkedAt=new Date().toISOString();}return result;}
let current;
export async function searchAll(q,{firefoxR2=false}={}){if(current)throw Error('BUSY');current=true;try{const results=[];const selected=firefoxR2?SHOPS.filter(s=>s.id!=='r2-bike'):SHOPS;for(let i=0;i<selected.length;i+=2){results.push(...await Promise.all(selected.slice(i,i+2).map(s=>searchOne(s,q))));}if(firefoxR2)results.push({name:'r2-bike',url:SHOPS[3].search(q),offers:[],message:'Warte auf Ergebnisse aus der Firefox-Erweiterung…',checkedAt:new Date().toISOString()});return {query:q,shops:results,mode:'local-browser'};}finally{current=false;}}
