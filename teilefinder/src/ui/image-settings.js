// The background owns both image rules and their persistent preference.
async function bindShopImageSetting(platform,control,status){
 try{const data=await platform.runtime.sendMessage({type:'shop-image-settings'});if(typeof data?.loadImages!=='boolean')throw Error('Einstellung nicht verfügbar');control.checked=data.loadImages;control.disabled=false;}
 catch{control.title='Bildeinstellung konnte nicht geladen werden';return;}
 control.addEventListener('change',async()=>{
  const previous=!control.checked;control.disabled=true;
  try{const data=await platform.runtime.sendMessage({type:'shop-image-settings',loadImages:control.checked});if(typeof data?.loadImages!=='boolean')throw Error('Einstellung nicht verfügbar');control.checked=data.loadImages;}
  catch{control.checked=previous;status.textContent='Bildeinstellung konnte nicht geändert werden.';}
  finally{control.disabled=false;}
 });
}
if(typeof document!=='undefined')void bindShopImageSetting(platform,document.getElementById('load-shop-images'),document.getElementById('status'));
