// Default follows the system preference; only an explicit choice overrides it.
function createThemeController({root,media,storage,onChange=()=>{}}){
 let preference='auto',revision=0,writes=Promise.resolve();
 const normalise=value=>['light','dark'].includes(value)?value:'auto';
 const apply=()=>{const dark=preference==='auto'?media.matches:preference==='dark';root.dataset.theme=dark?'dark':'light';onChange({preference,dark});};
 const select=value=>{preference=normalise(value);revision++;apply();const saved=preference;writes=writes.then(()=>storage.set({themePreference:saved})).catch(()=>{});return writes;};
 media.addEventListener('change',()=>{if(preference==='auto')apply();});
 apply();const initialRevision=revision;
 const ready=Promise.resolve().then(()=>storage.get('themePreference')).then(data=>{if(revision===initialRevision){preference=normalise(data.themePreference);apply();}}).catch(()=>{});
 return {ready,refresh:apply,select,toggle:()=>select(root.dataset.theme==='dark'?'light':'dark')};
}
if(typeof document!=='undefined'){
 const theme=createThemeController({root:document.documentElement,media:matchMedia('(prefers-color-scheme: dark)'),storage:installedPlatform().storage.local,onChange:({preference,dark})=>{
  const toggle=document.getElementById('theme-toggle'),automatic=document.getElementById('theme-auto');
  if(toggle){toggle.setAttribute('aria-pressed',String(dark));toggle.title=(preference==='auto'?'Browser-Design · ':'')+(dark?'Helles Design aktivieren':'Dunkles Design aktivieren');}
  if(automatic)automatic.hidden=preference==='auto';
 }});
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{void theme.toggle();});
  document.getElementById('theme-auto')?.addEventListener('click',()=>{void theme.select('auto');});
  theme.refresh();
 });
}
