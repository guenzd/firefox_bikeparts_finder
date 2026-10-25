// Search jobs live with the full extension page, never in the MV3 worker.
function createPagePlatforms(nativePlatform){
 const listeners=new Set();
 const current=nativePlatform.tabs.getCurrent().then(tab=>{if(!Number.isInteger(tab?.id))throw Error('Erweiterungs-Tab nicht gefunden.');return tab;});
 const runtime={...nativePlatform.runtime,onMessage:{addListener:listener=>listeners.add(listener),removeListener:listener=>listeners.delete(listener)},async sendMessage(data){
  const owner=await current,sender={id:nativePlatform.runtime.id,url:nativePlatform.runtime.getURL('ui/home.html'),tab:{id:owner.id}};
  let response;for(const listener of [...listeners]){const result=listener(data,sender);if(result!==undefined&&response===undefined)response=await result;}
  if(data?.type==='close-shop-tabs'){
   const stored=await nativePlatform.runtime.sendMessage({type:'close-owned-shop-tabs',owner:owner.id});
   return {closed:(response?.closed||0)+(stored?.closed||0)};
  }
  return response;
 }};
 const ui={...nativePlatform,runtime};
 const search={...ui,tabs:{...ui.tabs,async create(options){
  const owner=await current,host=new URL(options.url).hostname;
  const existing=await nativePlatform.runtime.sendMessage({type:'find-shop-tab',owner:owner.id,host});
  if(existing?.tab)return nativePlatform.tabs.update(existing.tab.id,options);
  const tab=await nativePlatform.tabs.create(options);
  try{const result=await nativePlatform.runtime.sendMessage({type:'register-shop-tab',owner:owner.id,tabId:tab.id});if(!result?.registered)throw Error('Shop-Tab konnte nicht zugeordnet werden.');}
  catch(error){await nativePlatform.tabs.remove(tab.id).catch(()=>{});throw error;}
  return tab;
 }}};
 return {ui,search};
}
var pagePlatforms=createPagePlatforms(installedPlatform());
var platform=pagePlatforms.ui;
var searchPlatform=pagePlatforms.search;
