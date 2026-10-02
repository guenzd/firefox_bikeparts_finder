// Runs on the product page; no cart or checkout actions.
async function bikeDiscountVariants(fallback){
 const picker=document.querySelector('#productDetailConfiguratorOptions');
 if(!picker)return [];
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(picker.getAttribute('aria-expanded')!=='true')picker.click();
 const deadline=Date.now()+3000;
 while(!document.querySelector('.nele-product-detail-configurator-option input[type="radio"]')&&Date.now()<deadline)await pause(150);
 const variants=[...document.querySelectorAll('.nele-product-detail-configurator-option input[type="radio"]')].map(input=>({id:input.id,text:input.parentElement.querySelector('label')?.innerText.trim(),disabled:input.disabled})).filter(v=>v.id&&v.text);
 const rows=[];
 for(const variant of variants.slice(0,8)){
  if(variant.disabled)continue;
  if(picker.getAttribute('aria-expanded')!=='true')picker.click();
  const input=document.getElementById(variant.id);
  const label=input?.parentElement.querySelector('label');
  if(!label)continue;
  label.click();
  // Selection and price update asynchronously. Require a settled selected variant.
  await pause(700);
  let previous='',stable=0,current;
  const until=Date.now()+6000;
  while(Date.now()<until){
   const selected=picker.innerText.trim();
   const price=document.querySelector('.product-detail-price')?.innerText.trim()||'';
   const stock=document.querySelector('.nele-product-availability-info')?.innerText.trim()||'';
   const signature=JSON.stringify([selected,price,stock]);
   const chosen=selected.includes(variant.text)&&input.checked;
   stable=chosen&&signature===previous?stable+1:0;previous=signature;
   const amount=euro(price.replace(/€/g,''));
   if(stable>=2&&amount!==null&&!/^ab\s/i.test(price)&&stock){current={price:amount,stock:stockText(stock)};break;}
   await pause(250);
  }
  if(current)rows.push({...fallback,name:document.querySelector('h1')?.innerText.trim()||fallback.name,variant:/^EAN/.test(fallback.variant)?'EAN im Shop prüfen · '+variant.text:variant.text,price:current.price,priceKind:'exact',stock:current.stock,url:location.href,source:'Firefox · ausgewählte Produktvariante'});
 }
 return rows;
}

// Native product selectors, including dependent size / color / capacity dropdowns.
function productDropdowns(){
 return [...document.querySelectorAll('select')].filter(select=>{
  if(select.id==='variant'&&select.closest('#add-to-cart'))return false;
  if(select.disabled||select.multiple||!select.getClientRects().length)return false;
  const label=[...(select.labels||[])].map(l=>l.textContent).join(' ');
  const identity=[select.name,select.id,label,select.getAttribute?.('aria-label')||''].join(' ');
  if(/quantity|menge|sort|filter|country|land|shipping/i.test(identity)||/^anzahl$/i.test(label.trim()))return false;
  return select.matches?.('[data-testid^="option-dropdown"]')||/größe|groesse|size|farbe|color|colour|volumen|volume|capacity|inhalt|länge|laenge|length|breite|width|ausführung|ausfuehrung|variant|variation|eigenschaft/i.test(identity)||!!select.closest('.variations, .variation, .product-detail-configurator, [data-variation]');
 });
}
async function dropdownVariants(fallback){
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const rows=[];let attempted=0;
 const options=select=>[...select.options].filter(o=>!o.disabled&&o.value&&!/bitte|wählen|waehlen|choose|select|auswahl/i.test(o.textContent)).map(o=>({value:o.value,text:o.textContent.trim()}));
 async function visit(depth,labels){
  if(attempted>=24)return;
  const selects=productDropdowns();
  if(depth<selects.length){
   const choices=options(selects[depth]);
   for(const choice of choices){
    if(attempted>=24)break;
    const select=productDropdowns()[depth];
    if(!select||![...select.options].some(o=>o.value===choice.value&&!o.disabled))continue;
    select.value=choice.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
    await pause(700);
    const refreshed=productDropdowns()[depth];if(!refreshed||refreshed.value!==choice.value)continue;
    const label=[...(select.labels||[])].map(l=>l.textContent.trim()).join(' ')||select.getAttribute?.('aria-label')||'';
    await visit(depth+1,[...labels,(label?label+': ':'')+choice.text.replace(/\s*-\s*zzgl\..*$/i,'')]);
   }
   return;
  }
  if(!labels.length)return;
  attempted++;
  let previous='',stable=0;
  for(let i=0;i<20;i++){
   const priceNode=document.querySelector('#add-to-cart .price__value, .product-detail-price, [itemprop="offers"] [itemprop="price"], .product-info .price, #buy_form .price, #product-offer [itemprop="price"], .product-price');
   const priceText=priceNode?.innerText?.trim()||priceNode?.getAttribute('content')||'';
   const stockNode=document.querySelector('#add-to-cart .product-availability, .nele-product-availability-info, .delivery-status, .availability, .delivery-time, .delivery');
   const stock=stockText(stockNode?.innerText||'');
   const signature=JSON.stringify([priceText,stock]);stable=signature===previous?stable+1:0;previous=signature;
   const match=priceText.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
   const price=match?euro(match[1]):priceNode?.getAttribute('content')?euro(priceNode.getAttribute('content')):null;
   if(stable>=2&&price!==null&&!/^ab\s/i.test(priceText)&&!document.querySelector('[aria-busy="true"]')){
    rows.push({...fallback,variant:(/^EAN/.test(fallback.variant)?'EAN im Shop prüfen · ':'')+labels.join(' · '),price,priceKind:'exact',stock,url:location.href,source:'Firefox · ausgewählte Produktvariante',selection:productDropdowns().map(select=>({id:select.id,value:select.value}))});break;
   }
   await pause(250);
  }
 }
 await visit(0,[]);
 return {offers:dedupe(rows),limited:attempted>=24};
}

async function bikeComponentsVariants(fallback){
 const picker=document.querySelector('.pdp-variant-button[role="combobox"][aria-controls="options-list"]');
 if(!picker)return {offers:[],limited:false};
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(picker.getAttribute('aria-expanded')!=='true')picker.click();
 const deadline=Date.now()+3000;
 while(!document.querySelector('#options-list [role="option"]')&&Date.now()<deadline)await pause(150);
 const choices=[...document.querySelectorAll('#options-list [role="option"]')].map(n=>({id:n.id,label:n.getAttribute('data-label')||n.innerText.trim(),disabled:n.getAttribute('aria-disabled')==='true'})).filter(v=>v.id&&v.label);
 const rows=[];
 for(const choice of choices.slice(0,24)){
  if(choice.disabled)continue;
  if(picker.getAttribute('aria-expanded')!=='true')picker.click();
  const option=document.getElementById(choice.id);if(!option)continue;option.click();
  await pause(700);
  let previous='',stable=0;
  for(let i=0;i<24;i++){
   const price=document.querySelector('[data-test="auto-product-price"]')?.innerText.trim()||'';
   const stock=document.querySelector('.stock-status')?.innerText.trim()||'';
   const selected=picker.getAttribute('aria-activedescendant')===choice.id&&document.getElementById(choice.id)?.getAttribute('aria-selected')==='true';
   const signature=JSON.stringify([price,stock]);stable=selected&&signature===previous?stable+1:0;previous=signature;
   const match=price.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/),amount=match?euro(match[1]):null;
   if(stable>=2&&amount!==null&&stock&&!/^ab\s/i.test(price)){
    rows.push({...fallback,name:document.querySelector('h1')?.innerText.trim()||fallback.name,variant:(/^EAN/.test(fallback.variant)?'EAN im Shop prüfen · ':'')+choice.label,price:amount,priceKind:'exact',stock:stockText(stock),url:location.href,source:'Firefox · ausgewählte Produktvariante'});break;
   }
   await pause(250);
  }
 }
 return {offers:dedupe(rows),limited:choices.length>24};
}
