// Each page starts with the browser preference; manual switching lasts until reload.
function createThemeController({root,media,onChange=()=>{}}){
 let manual=false;
 const apply=dark=>{root.dataset.theme=dark?'dark':'light';onChange({dark});};
 media.addEventListener('change',()=>{if(!manual)apply(media.matches);});
 apply(media.matches);
 return {refresh:()=>apply(root.dataset.theme==='dark'),toggle:()=>{manual=true;apply(root.dataset.theme!=='dark');}};
}
if(typeof document!=='undefined'){
 const theme=createThemeController({root:document.documentElement,media:matchMedia('(prefers-color-scheme: dark)'),onChange:({dark})=>{
  const toggle=document.getElementById('theme-toggle');
  if(toggle){toggle.setAttribute('aria-pressed',String(dark));toggle.title=dark?'Helles Design aktivieren':'Dunkles Design aktivieren';}
 }});
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('theme-toggle')?.addEventListener('click',()=>theme.toggle());
  theme.refresh();
 });
}
