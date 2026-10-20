export const GUIDE_KEY='brm5-public-guide-open';
export function guideInitiallyOpen(setupComplete,preference,hash){
 return preference!=='false'&&(hash==='#guide'||!setupComplete);
}
export function rememberGuideState(open,{storage,location=globalThis.location,history=globalThis.history}={}){
 try{(storage??globalThis.localStorage).setItem(GUIDE_KEY,String(open));}catch{}
 // A closed guide must not be reopened by a leftover fragment on the next load.
 if(!open&&location.hash==='#guide')history.replaceState(history.state,'',location.pathname+location.search+'#today');
}
export function closeGuideForUpdate(guide,environment){
 guide.open=false;
 // The details toggle event is asynchronous; save this before navigating away.
 rememberGuideState(false,environment);
}
