export const HALLOWEEN_START=Date.parse('2026-10-30T00:00:00+01:00');
export const HALLOWEEN_END=Date.parse('2026-11-02T00:00:00+01:00');
export const HALLOWEEN_INVITE='brm5-seasonal-invite-halloween-2026';
export const regularThemes=['system','light','dark','blueprint','contrast'];
export const halloweenActive=(now=Date.now())=>now>=HALLOWEEN_START&&now<HALLOWEEN_END;
export function expireSeasonal(value,now=Date.now()){
 if(value.theme!=='halloween'||value.halloween?.until!==HALLOWEEN_END||now<HALLOWEEN_END)return value;
 const next={...value,theme:regularThemes.includes(value.halloween.previous)?value.halloween.previous:'system'};delete next.halloween;return next;
}
export function chooseSeasonal(value,previous,now=Date.now()){
 const next={...expireSeasonal(value,now)};
 if(next.theme!=='halloween'){delete next.halloween;return next;}
 if(!next.halloween){const old=expireSeasonal(previous,now);next.halloween={previous:regularThemes.includes(old.theme)?old.theme:'system',until:now<HALLOWEEN_END?HALLOWEEN_END:null};}
 return next;
}
export function shouldInvite({now=Date.now(),seen=false,theme,busy=false,canRemember=true}){return canRemember&&halloweenActive(now)&&!seen&&theme!=='halloween'&&!busy;}
export function installSeasonal({getPreferences,selectTheme,refresh,isEditing,document:doc=globalThis.document,window:win=globalThis.window}){
 let banner=null;let storage;try{storage=win.localStorage;const key=HALLOWEEN_INVITE+':probe';storage.setItem(key,'1');storage.removeItem(key);}catch{storage=null;}
 function dismiss(){try{storage?.setItem(HALLOWEEN_INVITE,'seen');}catch{}banner?.remove();banner=null;}
 function tick(){
  refresh();let seen=true,dismissed=false;try{const decision=storage?.getItem(HALLOWEEN_INVITE);seen=!storage||decision!=null;dismissed=decision==='seen';}catch{}
  const p=getPreferences();
  if(!halloweenActive()||p.theme==='halloween'||dismissed){banner?.remove();banner=null;return;}
  if(banner||!shouldInvite({seen,theme:p.theme,busy:isEditing(),canRemember:Boolean(storage)}))return;
  try{storage.setItem(HALLOWEEN_INVITE,'shown');}catch{return;}
  banner=doc.createElement('aside');banner.className='seasonal-invitation';banner.setAttribute('aria-label','Optional Halloween theme');
  banner.innerHTML='<div><strong>Halloween has arrived</strong><p>Try a seasonal look through 1 November. Your previous theme returns on 2 November.</p></div><div class="seasonal-actions"><button type="button" class="primary" data-halloween-yes>Try Halloween</button><button type="button" class="ghost" data-halloween-no>Not now</button><button type="button" class="ghost" aria-label="Dismiss Halloween invitation">×</button></div>';
  banner.querySelector('[data-halloween-yes]').onclick=()=>{try{selectTheme('halloween');dismiss();}catch{banner.querySelector('p').textContent='Could not save this preference. You can try Halloween in Settings → Appearance → Seasonal Themes.';}};
  banner.querySelector('[data-halloween-no]').onclick=dismiss;banner.querySelector('[aria-label]').onclick=dismiss;doc.querySelector('main')?.prepend(banner);
 }
 const visible=()=>{if(!doc.hidden)tick();};const timer=win.setInterval(visible,15000);doc.addEventListener('visibilitychange',visible);win.addEventListener('storage',visible);tick();
 return {tick,destroy(){win.clearInterval(timer);doc.removeEventListener('visibilitychange',visible);win.removeEventListener('storage',visible);banner?.remove();}};
}
