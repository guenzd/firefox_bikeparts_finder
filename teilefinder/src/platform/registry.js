// Persist only tab ownership. Search jobs, timers and results stay in the UI page.
function createTabRegistry(api){
 if(!api.storage.session)throw Error('Sitzungsspeicher für Shop-Tabs fehlt.');
 const key='ownedShopTabs',home=api.runtime.getURL('ui/home.html');
 const hosts=new Set(['bike24.de','bike-discount.de','bike-components.de','r2-bike.com']);
 let writes=Promise.resolve();
 const serial=work=>{const result=writes.then(work);writes=result.catch(()=>{});return result;};
 const read=async()=>{const data=await api.storage.session.get(key);return data[key]&&typeof data[key]==='object'?data[key]:{};};
 const write=registry=>api.storage.session.set({[key]:registry});
 const shopURL=url=>{try{const parsed=new URL(url);return parsed.protocol==='https:'&&hosts.has(parsed.hostname.replace(/^www\./,''));}catch{return false;}};
 const trusted=sender=>sender?.id===api.runtime.id&&sender.url===home;
 return {
  lookup(data,sender){
   if(!['find-shop-tab','close-owned-shop-tabs'].includes(data?.type)||!trusted(sender)||!Number.isInteger(data.owner)||sender.tab&&sender.tab.id!==data.owner)return undefined;
   if(data.type==='find-shop-tab'&&!hosts.has(data.host?.replace(/^www\./,'')))return undefined;
   return serial(async()=>{
    const owner=await api.tabs.get(data.owner).catch(()=>null);if(owner?.url!==home)return {closed:0};
    const registry=await read(),ids=Array.isArray(registry[data.owner])?registry[data.owner]:[];
    if(data.type==='find-shop-tab'){
     for(const id of ids){const tab=await api.tabs.get(id).catch(()=>null);if(tab&&shopURL(tab.pendingUrl||tab.url)&&new URL(tab.pendingUrl||tab.url).hostname.replace(/^www\./,'')===data.host.replace(/^www\./,''))return {tab};}
     return {};
    }
    delete registry[data.owner];await write(registry);let closed=0;
    for(const id of ids){const tab=await api.tabs.get(id).catch(()=>null);if(tab&&shopURL(tab.pendingUrl||tab.url)){try{await api.tabs.remove(id);closed++;}catch{}}}
    return {closed};
   });
  },
  register(data,sender){
   if(data?.type!=='register-shop-tab'||!trusted(sender)||!Number.isInteger(data.owner)||!Number.isInteger(data.tabId)||data.owner===data.tabId||sender.tab&&sender.tab.id!==data.owner)return undefined;
   return serial(async()=>{
    const [owner,child]=await Promise.all([api.tabs.get(data.owner),api.tabs.get(data.tabId)]);
    if(owner.url!==home||!shopURL(child.pendingUrl||child.url))return {registered:false};
    const registry=await read();
    if(Object.entries(registry).some(([id,children])=>Number(id)!==data.owner&&Array.isArray(children)&&children.includes(data.tabId)))return {registered:false};
    registry[data.owner]=[...new Set([...(registry[data.owner]||[]),data.tabId])];await write(registry);
    // Close the race between parent validation and the storage write.
    const live=await api.tabs.get(data.owner).catch(()=>null);
    if(!live||live.url!==home){const orphaned=registry[data.owner];delete registry[data.owner];await write(registry);await Promise.allSettled(orphaned.map(async id=>{const child=await api.tabs.get(id).catch(()=>null);if(child&&shopURL(child.pendingUrl||child.url))await api.tabs.remove(id);}));return {registered:false};}
    return {registered:true};
   });
  },
  removed(tabId){return serial(async()=>{
   const registry=await read(),children=Array.isArray(registry[tabId])?registry[tabId]:[];delete registry[tabId];
   for(const owner of Object.keys(registry))registry[owner]=registry[owner].filter(id=>id!==tabId);
   await write(registry);
   await Promise.allSettled(children.map(async id=>{const tab=await api.tabs.get(id).catch(()=>null);if(tab&&shopURL(tab.pendingUrl||tab.url))await api.tabs.remove(id);}));
  });}
 };
}
