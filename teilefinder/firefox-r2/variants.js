// Runs on the product page; no cart or checkout actions.
async function bikeDiscountVariants(fallback,requested){
 const picker=document.querySelector('#productDetailConfiguratorOptions');
 if(!picker)return [];
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(picker.getAttribute('aria-expanded')!=='true')picker.click();
 const deadline=Date.now()+3000;
 while(!document.querySelector('.nele-product-detail-configurator-option input[type="radio"]')&&Date.now()<deadline)await pause(150);
 const variants=[...document.querySelectorAll('.nele-product-detail-configurator-option input[type="radio"]')].map(input=>({id:input.id,text:input.parentElement.querySelector('label')?.innerText.trim(),disabled:input.disabled})).filter(v=>v.id&&v.text);
 const color=typeof productColor==='function'?productColor():'';
 const rows=[];
 for(const variant of variants.filter(v=>!requested||variantMatches({...fallback,variant:[v.text,color].filter(Boolean).join(' · ')},requested)).slice(0,8)){
  if(variant.disabled)continue;
  const livePicker=document.querySelector('#productDetailConfiguratorOptions');
  if(!livePicker)continue;
  if(livePicker.getAttribute('aria-expanded')!=='true')livePicker.click();
  const input=document.getElementById(variant.id);
  const label=input?.parentElement.querySelector('label');
  if(!label)continue;
  if(!input.checked)label.click();
  // Selection and price update asynchronously. Require a settled selected variant.
  await pause(700);
  let previous='',stable=0,current;
  const until=Date.now()+6000;
  while(Date.now()<until){
   const selected=document.querySelector('#productDetailConfiguratorOptions')?.innerText.trim()||'';
   const price=document.querySelector('.product-detail-price')?.innerText.trim()||'';
   const stock=document.querySelector('.nele-product-availability-info')?.innerText.trim()||'';
   const ean=typeof currentProductEAN==='function'?currentProductEAN():'';
   const signature=JSON.stringify([selected,price,stock,ean]);
   const liveInput=document.getElementById(variant.id);
   const chosen=selected.toLowerCase().includes(variant.text.toLowerCase())&&liveInput?.checked;
   stable=chosen&&signature===previous?stable+1:0;previous=signature;
   const amount=euro(price.replace(/€/g,''));
   if(stable>=2&&amount!==null&&!/^ab\s/i.test(price)&&stock){current={price:amount,stock:stockText(stock),ean};break;}
   await pause(250);
  }
  if(current)rows.push({...fallback,ean:current.ean||'',name:document.querySelector('h1')?.innerText.trim()||fallback.name,variant:/^EAN/.test(fallback.variant)?'EAN im Shop prüfen · '+variant.text:[variant.text,color].filter(Boolean).join(' · '),price:current.price,priceKind:'exact',stock:current.stock,url:location.href,source:'Firefox · ausgewählte Produktvariante'});
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
 const bike24=typeof location.hostname==='string'&&location.hostname.replace(/^www\./,'')==='bike24.de';
 const release=bike24?guardBike24Purchase():()=>{};
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
    select.value=choice.value;if(!bike24)select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
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
 try{await visit(0,[]);return {offers:dedupe(rows),limited:attempted>=24};}finally{release();}
}

async function bikeComponentsVariants(fallback,requested){
 const picker=document.querySelector('.pdp-variant-button[role="combobox"][aria-controls="options-list"]');
 if(!picker)return {offers:[],limited:false};
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const selectedLabel=[...document.querySelectorAll('.pdp-variant-button[aria-controls="options-list"] .pdp-variant-label')].map(n=>String(n.textContent||'').trim()).filter(Boolean).join(' | ');
 const selectedPrice=document.querySelector('[data-test="auto-product-price"]')?.innerText||'';
 const selectedStock=document.querySelector('.stock-status')?.innerText||'';
 const selectedAmount=selectedPrice.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
 if(requested&&selectedLabel&&variantMatches({...fallback,variant:selectedLabel},requested)&&selectedAmount&&selectedStock&&!/^ab\s/i.test(selectedPrice)){
  return {offers:[{...fallback,variant:selectedLabel,price:euro(selectedAmount[1]),priceKind:'exact',stock:stockText(selectedStock),url:location.href,source:'Firefox · ausgewählte Produktvariante'}],limited:false};
 }
 if(picker.getAttribute('aria-expanded')!=='true')picker.click();
 const deadline=Date.now()+3000;
 while(!document.querySelector('#options-list [role="option"]')&&Date.now()<deadline)await pause(150);
 const choices=[...document.querySelectorAll('#options-list [role="option"]')].map(n=>({id:n.id,label:n.getAttribute('data-label')||n.innerText.trim(),disabled:n.getAttribute('aria-disabled')==='true'})).filter(v=>v.id&&v.label);
 const rows=[];
 for(const choice of choices.filter(v=>!requested||variantMatches({...fallback,variant:v.label},requested)).slice(0,24)){
  if(choice.disabled)continue;
  if(picker.getAttribute('aria-expanded')!=='true')picker.click();
  const option=document.getElementById(choice.id);if(!option)continue;if(picker.getAttribute('aria-activedescendant')!==choice.id||option.getAttribute('aria-selected')!=='true')option.click();
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

// Keep purchase events separate from BIKE24 variant change events. Installed
// only while inspecting options and always removed afterwards.
function guardBike24Purchase(){
 const block=event=>{
  const control=event.target?.closest?.('button, input[type="submit"], a');
  const purchase=event.type==='submit'||control&&/warenkorb|add.?to.?cart|basket/i.test([control.textContent,control.value,control.id,control.name,control.getAttribute?.('data-testid'),control.getAttribute?.('href')].join(' '));
  if(purchase){event.preventDefault();event.stopImmediatePropagation();}
 };
 document.addEventListener('submit',block,true);document.addEventListener('click',block,true);
 return ()=>{document.removeEventListener('submit',block,true);document.removeEventListener('click',block,true);};
}
