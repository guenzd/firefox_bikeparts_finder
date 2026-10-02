function suggestionTokens(text){return String(text||'').toLowerCase().replace(/['’‘`´ʼ]/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑–—]/g,'-').replace(/[^a-z0-9-]+/g,' ').split(/\s+/).filter(t=>t.length>1);}
function tokenDistance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length];}
function similarProducts(cards,query){
 const words=suggestionTokens(query);if(!words.length||/^\d{8,14}$/.test(query.trim()))return [];
 return [...new Map(cards.map(c=>[c.url,c])).values()].map(raw=>{
  const name=raw.name.split(/\bUVP\b|(?:\bab\s*)?\d{1,5}(?:\.\d{3})*,\d{2}\s*€|\b\d+(?:\s*[-–]\s*\d+)?\s*(?:Arbeits|Werk)tage/i)[0].replace(/\s+/g,' ').trim();
  const card={...raw,name};
  const tokens=suggestionTokens(card.name);const scores=words.map(word=>Math.max(0,...tokens.map(t=>t===word?1:t.includes(word)&&word.length>=3?.9:Math.max(word.length,t.length)>=4&&tokenDistance(word,t)<=Math.min(2,Math.floor(Math.max(word.length,t.length)/4))?.7:0)));
  return {...card,similarity:scores.reduce((a,b)=>a+b,0)/words.length};
 }).filter(c=>c.similarity>=.55).sort((a,b)=>b.similarity-a.similarity||(a.price??Infinity)-(b.price??Infinity)).slice(0,5);
}
function broaderQuery(query){
 const tokens=query.trim().split(/\s+/);if(/^\d{8,14}$/.test(query.trim()))return null;
 const next=tokens.length>2?tokens.slice(0,2).join(' '):tokens.length===2?tokens[0]:tokens[0].split(/[-\d]/)[0];
 return next&&next.length>=2&&next!==query.trim()?next:null;
}
