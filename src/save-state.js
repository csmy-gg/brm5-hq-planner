// Compare saved content independent of JSON object-key ordering from Postgres.
export function saveSignature(value){return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);}
export function incomingSaveAction(current,next,{switching=false,reason='remote',hasDrafts=false,editing=false}={}){if(switching)return 'apply';if(saveSignature(current)===saveSignature(next))return 'ignore';if(hasDrafts||(editing&&reason!=='resolved'))return 'defer';return 'apply';}
