// The only boundary to native extension APIs. Shared code receives this facade.
function createNativePlatform(native){
 if(!native?.runtime)throw Error('Erweiterungs-APIs nicht verfügbar.');
 const unwrap=value=>{if(value?.__teilefinderPlatformError)throw Error(value.__teilefinderPlatformError);return value;};
 const call=(object,method,...args)=>Promise.resolve().then(()=>object[method](...args)).then(unwrap);
 const messageListeners=new Map();
 return {
  tabs:{get:id=>call(native.tabs,'get',id),getCurrent:()=>call(native.tabs,'getCurrent'),query:query=>call(native.tabs,'query',query),create:options=>call(native.tabs,'create',options),update:(id,options)=>call(native.tabs,'update',id,options),remove:id=>call(native.tabs,'remove',id),sendMessage:(id,data)=>call(native.tabs,'sendMessage',id,data),onRemoved:native.tabs?.onRemoved,onUpdated:native.tabs?.onUpdated},
  storage:{local:{get:key=>call(native.storage.local,'get',key),set:data=>call(native.storage.local,'set',data)},session:native.storage.session?{get:key=>call(native.storage.session,'get',key),set:data=>call(native.storage.session,'set',data)}:null},
  action:native.action||native.browserAction,
  runtime:{id:native.runtime.id,getURL:path=>native.runtime.getURL(path),sendMessage:data=>call(native.runtime,'sendMessage',data),onMessage:{
   addListener(listener){
    const wrapped=(data,sender,sendResponse)=>{
     let result;try{result=listener(data,sender);}catch(error){sendResponse({__teilefinderPlatformError:error.message});return false;}
     if(result===undefined)return false;
     if(result&&typeof result.then==='function'){
      Promise.resolve(result).then(sendResponse,error=>sendResponse({__teilefinderPlatformError:error.message}));return true;
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
