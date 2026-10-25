// Small restartable entry point shared by Firefox and Chrome.
const backgroundPlatform=installedPlatform();
const tabRegistry=createTabRegistry(backgroundPlatform);
void tabRegistry.restore().catch(()=>{});
backgroundPlatform.action.onClicked.addListener(()=>backgroundPlatform.tabs.create({url:backgroundPlatform.runtime.getURL('ui/home.html')}));
backgroundPlatform.runtime.onMessage.addListener((data,sender)=>tabRegistry.lookup(data,sender)??tabRegistry.register(data,sender));
backgroundPlatform.tabs.onRemoved.addListener(tabId=>{void tabRegistry.removed(tabId).catch(()=>{});});
