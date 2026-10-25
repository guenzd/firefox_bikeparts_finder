// Only fixed error types, identifier-shaped signatures and shipped source
// locations enter profiling. Never transport a raw stack into timing records.
function platformErrorInfo(error){
 const name=['Error','TypeError','ReferenceError','SyntaxError','RangeError'].includes(error?.name)?error.name:'Error';
 const site=String(error?.stack||'').match(/\/((?:shops|core|platform)\/[A-Za-z0-9_.-]+\.js):(\d+):(\d+)/);
 const message=String(error?.message||''),identifier='[A-Za-z_$][A-Za-z0-9_$]*(?:\\.[A-Za-z_$][A-Za-z0-9_$]*)*';
 const signatures=[new RegExp('^'+identifier+' is (?:not defined|not a function|undefined|null)$'),/^Cannot read properties of (?:null|undefined) \(reading '[A-Za-z_$][A-Za-z0-9_$]*'\)$/,/^can't access property "[A-Za-z_$][A-Za-z0-9_$]*", [A-Za-z_$][A-Za-z0-9_$]* is (?:null|undefined)$/];
 return {name,site:site?site[1]+':'+site[2]+':'+site[3]:'',signature:message.length<=160&&signatures.some(pattern=>pattern.test(message))?message:''};
}
// The only boundary to native extension APIs. Shared code receives this facade.
function createNativePlatform(native){
 if(!native?.runtime)throw Error('Erweiterungs-APIs nicht verfügbar.');
 const failure=error=>({__teilefinderPlatformError:String(error?.message||'Skriptfehler'),errorInfo:platformErrorInfo(error)});
 const unwrap=value=>{if(typeof value?.__teilefinderPlatformError==='string'){const error=Error(value.__teilefinderPlatformError);error.code='REMOTE_SCRIPT_ERROR';error.info=value.errorInfo;throw error;}return value;};
 const call=(object,method,...args)=>Promise.resolve().then(()=>object[method](...args)).then(unwrap);
 const messageListeners=new Map();
 return {
  tabs:{get:id=>call(native.tabs,'get',id),getCurrent:()=>call(native.tabs,'getCurrent'),query:query=>call(native.tabs,'query',query),create:options=>call(native.tabs,'create',options),update:(id,options)=>call(native.tabs,'update',id,options),remove:id=>call(native.tabs,'remove',id),sendMessage:(id,data)=>call(native.tabs,'sendMessage',id,data),onRemoved:native.tabs?.onRemoved,onUpdated:native.tabs?.onUpdated},
  storage:{local:{get:key=>call(native.storage.local,'get',key),set:data=>call(native.storage.local,'set',data)},session:native.storage.session?{get:key=>call(native.storage.session,'get',key),set:data=>call(native.storage.session,'set',data)}:null},
  images:native.declarativeNetRequest?{setTabIds:ids=>{
   const tabIds=[...new Set(ids)].sort((a,b)=>a-b),shops=['bike24.de','bike-discount.de','bike-components.de','r2-bike.com'];
   const addRules=tabIds.length?[
    {id:840001,priority:1,action:{type:'block'},condition:{tabIds,resourceTypes:['image'],initiatorDomains:shops,excludedRequestDomains:['challenges.cloudflare.com']}},
    // Enforce img-src on the document itself too, independently of the image
    // request initiator. Append preserves the shop's existing CSP restrictions.
    {id:840002,priority:1,action:{type:'modifyHeaders',responseHeaders:[{header:'content-security-policy',operation:'append',value:'img-src https://challenges.cloudflare.com https://*.challenges.cloudflare.com'}]},condition:{tabIds,resourceTypes:['main_frame'],requestDomains:shops}}
   ]:[];
   return call(native.declarativeNetRequest,'updateSessionRules',{removeRuleIds:[840001,840002],addRules});
  }}:null,
  action:native.action||native.browserAction,
  runtime:{id:native.runtime.id,getURL:path=>native.runtime.getURL(path),sendMessage:data=>call(native.runtime,'sendMessage',data),onMessage:{
   addListener(listener){
    const wrapped=(data,sender,sendResponse)=>{
     let result;try{result=listener(data,sender);}catch(error){sendResponse(failure(error));return false;}
     if(result===undefined)return false;
     if(result&&typeof result.then==='function'){
      Promise.resolve(result).then(sendResponse,error=>sendResponse(failure(error)));return true;
     }
     sendResponse(result);return false;
    };
    messageListeners.set(listener,wrapped);native.runtime.onMessage.addListener(wrapped);
   },
   removeListener(listener){const wrapped=messageListeners.get(listener);if(wrapped){native.runtime.onMessage.removeListener(wrapped);messageListeners.delete(listener);}}
  }}
 };
}
function installedPlatform(){return createNativePlatform(globalThis.browser||globalThis.chrome);}
