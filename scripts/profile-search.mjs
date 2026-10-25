// Deterministic controller profiling. No network requests or real shop timings.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../teilefinder/src/',import.meta.url);
export async function profileSearch({cached=false,loadMs=0,detailMs=0,blockedReads=0,runs=1,controllerSource}={}){
 let now=0,next=0,listener,created=0,reads=0,details=0,navigations=0,maxInFlight=0;
 const timers=new Map(),tabs=new Map(),results=[],inFlight=new Map(),tabReads=new Map(),blockedAt=new Map();let minBlockedRetryMs=null;
 const schedule=(fn,ms)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;};
 const offers=host=>[{name:'Example Model 123',ean:'1234567890128',variant:'black',price:25,priceKind:'exact',stock:'Auf Lager',url:'https://'+host+'/product'}];
 const api={runtime:{getURL:p=>'extension://unit/'+p,onMessage:{addListener(fn){listener=fn;}},async sendMessage(data){if(data.type==='result')results.push(data);}},tabs:{onRemoved:{addListener(){}},async create(options){const tab={id:++created,...options,loadedAt:now+loadMs};tabs.set(tab.id,tab);navigations++;return tab;},async get(id){return tabs.get(id);},async update(id,options){Object.assign(tabs.get(id),options,{loadedAt:now+loadMs});navigations++;return tabs.get(id);},async sendMessage(id,data){const active=(inFlight.get(id)||0)+1;inFlight.set(id,active);maxInFlight=Math.max(maxInFlight,active);try{if(data.type==='extract'){reads++;const count=(tabReads.get(id)||0)+1;tabReads.set(id,count);if(blockedAt.has(id))minBlockedRetryMs=Math.min(minBlockedRetryMs??Infinity,now-blockedAt.get(id));if(count<=blockedReads){blockedAt.set(id,now);return {blocked:true,offers:[]};}blockedAt.delete(id);return {ready:now>=tabs.get(id).loadedAt,offers:now>=tabs.get(id).loadedAt?offers(data.host):[]};}details++;if(detailMs)await new Promise(resolve=>schedule(resolve,detailMs));return {ready:now>=tabs.get(id).loadedAt,productName:'Example Model 123',offers:now>=tabs.get(id).loadedAt?offers(data.host):[]};}finally{inFlight.set(id,active-1);}}}};
 const ctx=vm.createContext({searchPlatform:api,URL,Date:{now:()=>now},performance:{now:()=>now},setTimeout:schedule,clearTimeout:id=>timers.delete(id)});
 for(const file of ['core/products.js','core/variant-match.js','core/catalog.js','core/wishlist.js'])vm.runInContext(readFileSync(new URL(file,root),'utf8'),ctx);
 vm.runInContext(controllerSource||readFileSync(new URL('core/search-controller.js',root),'utf8'),ctx);
 const catalog=vm.runInContext('shops',ctx);
 for(let run=0;run<runs;run++){
 await listener({type:'search',id:'profile-'+run,query:'Example Model 123',useEAN:false,knownShops:cached?catalog.map(shop=>({name:shop.name,offers:offers(shop.host)})):[]},{url:'extension://unit/ui/home.html',tab:{id:99}});
 for(let step=0;step<5000;step++){
  await new Promise(setImmediate);
  if(results.length===(run+1)*4)break;
  const nextTimer=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
  if(!nextTimer)throw Error('No pending work before completion');
  timers.delete(nextTimer[0]);now=nextTimer[1].at;nextTimer[1].fn();
 }
 }
 if(results.length!==4*runs||results.some(result=>!result.offers.length))throw Error('Profiling scenario did not return four offers');
 return {elapsedMs:now,createdTabs:created,navigations,listingReads:reads,detailReads:details,maxInFlightPerTab:maxInFlight,minBlockedRetryMs,phases:typeof ctx.getSearchProfiles==='function'?ctx.getSearchProfiles():undefined};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const scenarios={readyListing:{},loadingListing:{loadMs:2500},savedProduct:{cached:true},reusedShopTabs:{cached:true,runs:3},loadingSavedProduct:{cached:true,loadMs:1500,detailMs:600}};
 const argument=process.argv.indexOf('--controller');
 const controllerSource=argument>=0?readFileSync(process.argv[argument+1],'utf8'):undefined;
 const result={kind:'simulated-controller-profile',scenarios:{}};
 for(const [name,options] of Object.entries(scenarios))result.scenarios[name]=await profileSearch({...options,controllerSource});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
