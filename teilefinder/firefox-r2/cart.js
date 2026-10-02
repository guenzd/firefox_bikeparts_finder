async function cartAction(data){
 const offer=data.offer,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(data.shopId==='bike-discount'){
  const picker=document.querySelector('#productDetailConfiguratorOptions');
  if(picker){
   if(picker.getAttribute('aria-expanded')!=='true')picker.click();await pause(300);
   const input=[...document.querySelectorAll('.nele-product-detail-configurator-option input[type="radio"]')].find(n=>n.parentElement.querySelector('label')?.innerText.trim()===offer.variant);
   if(!input||input.disabled)return {message:'Bitte die gewünschte Ausführung im Shop selbst auswählen.'};
   input.parentElement.querySelector('label').click();await pause(1500);
   if(!input.checked)return {message:'Die Ausführung konnte nicht bestätigt werden. Bitte im Shop hinzufügen.'};
  }else if(/prüfen|laut Produktname/i.test(offer.variant))return {message:'Bitte die Ausführung im Shop prüfen und selbst hinzufügen.'};
 }else if(data.shopId==='bike-components'){
  const picker=document.querySelector('.pdp-variant-button[aria-controls="options-list"]');
  if(!picker)return {message:'Bitte die Ausführung im Shop prüfen und selbst hinzufügen.'};
  const selected=document.getElementById(picker.getAttribute('aria-activedescendant'))?.getAttribute('data-label');
  if(selected!==offer.variant)return {message:'Die ausgewählte Ausführung stimmt nicht überein. Bitte im Shop selbst hinzufügen.'};
 }else if(data.shopId==='bike24'){
  for(const choice of offer.selection||[]){const select=document.getElementById(choice.id);if(!select||select.tagName!=='SELECT'||![...select.options].some(o=>o.value===choice.value&&!o.disabled))return {message:'Option nicht mehr verfügbar. Bitte im Shop auswählen.'};select.value=choice.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));await pause(700);}
  const unselected=[...document.querySelectorAll('#add-to-cart select')].some(s=>!s.value);if(unselected)return {message:'Bitte alle Optionen im BIKE24-Tab auswählen.'};
  if(!(offer.selection?.length)&&/prüfen|laut Produktname/i.test(offer.variant))return {message:'Bitte die Ausführung im BIKE24-Tab prüfen und selbst hinzufügen.'};
  await pause(700);
 }else return {message:'Produkt im Shop geöffnet. Bitte dort Ausführung prüfen und in den Warenkorb legen.'};
 const priceText=document.querySelector('[data-test="auto-product-price"], .product-detail-price, #add-to-cart .price__value')?.innerText||'';
 const match=priceText.match(/(\d{1,5}(?:\.\d{3})*,\d{2})\s*€/);
 if(!match||euro(match[1])!==offer.price)return {message:'Preis ist geändert oder unklar. Bitte im Shop prüfen und selbst hinzufügen.'};
 const quantity=document.querySelector('[aria-controls="quantity-list"]');
 const quantityInput=document.querySelector('input[name="quantity"], input[name="amount"], #add-to-cart-quantity');
 if((quantity&&quantity.innerText.trim()!=='1')||(quantityInput&&Number(quantityInput.value)!==1))return {message:'Bitte Menge im Shop prüfen; automatisch wird nur ein Stück hinzugefügt.'};
 const stock=document.querySelector('.stock-status, .nele-product-availability-info, #add-to-cart .product-availability')?.innerText||'';
 if(!deliverable(stock))return {message:'Lieferbarkeit konnte nicht bestätigt werden. Bitte im Shop prüfen.'};
 const buttons=[...document.querySelectorAll('button, input[type="submit"]')].filter(n=>/^in den warenkorb$/i.test((n.innerText||n.value||'').trim())&&!n.disabled&&n.getClientRects().length);
 if(buttons.length!==1)return {message:'Warenkorb-Schaltfläche nicht eindeutig. Bitte im Shop selbst hinzufügen.'};
 buttons[0].click();await pause(1500);
 const confirmed=/zum Warenkorb hinzugefügt|in (?:den|deinen) Warenkorb (?:gelegt|hinzugefügt)|erfolgreich.{0,40}Warenkorb/i.test(document.body.innerText);
 return {clicked:true,message:confirmed?'Artikel zum Warenkorb hinzugefügt.':'Hinzufügen wurde einmal ausgelöst. Bitte die Bestätigung im geöffneten Shop-Warenkorb prüfen.'};
}
