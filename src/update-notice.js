export const UPDATE_INTENT_KEY='brm5-update-intent';
export const UPDATE_NOTICE_KEY='brm5-update-notice-seen';
export function rememberUpdateIntent(storage,release){try{if(release?.id)storage?.setItem(UPDATE_INTENT_KEY,JSON.stringify({id:release.id,version:release.version}));}catch{}}
export function consumeUpdateNotice({version,current,existing,local,session,settled=false}){
 let intent=null,seen=null;
 try{const raw=session?.getItem(UPDATE_INTENT_KEY);intent=raw?JSON.parse(raw):null;}catch{}
 try{seen=local?.getItem(UPDATE_NOTICE_KEY);}catch{}
 const clicked=intent?.id===current;
 if(version!=='1.2.0'){if(clicked)try{session?.removeItem(UPDATE_INTENT_KEY);}catch{}return false;}
 // 1.1.0 did not record update clicks. Existing HQs get this release's notice
 // once on arrival; later refreshes require an explicit update intent.
 const firstSchedulingRelease=version==='1.2.0'&&existing&&seen!==version;
 if(!clicked&&!firstSchedulingRelease){if(settled&&version==='1.2.0')try{local?.setItem(UPDATE_NOTICE_KEY,version);}catch{}return false;}
 try{session?.removeItem(UPDATE_INTENT_KEY);}catch{}
 try{local?.setItem(UPDATE_NOTICE_KEY,version);}catch{}
 return true;
}
export function installUpdateNotice({version,current,document:doc=globalThis.document,window:win=globalThis.window,onSettings}){
 let displayed=false;
 return {consider(profile,{settled=false}={}){
  if(displayed||current==='development')return;
  let local,session;try{local=win.localStorage;session=win.sessionStorage;}catch{return;}
  if(!consumeUpdateNotice({version,current,existing:profile.setupComplete,local,session,settled}))return;
  displayed=true;
  const bubble=doc.createElement('aside');bubble.className='update-notice';bubble.setAttribute('aria-label','Website updated');
  const scheduling=version==='1.2.0';
  bubble.innerHTML=`<div class="update-notice-header"><strong>${scheduling?'More flexible visit schedules':'Website updated'}</strong><button type="button" class="ghost" aria-label="Dismiss update message">×</button></div><p role="status">${scheduling?'Scheduling has been updated. Choose specific daily times, such as 14:00 and 20:00, in Settings → Schedule.':'Your website update is ready. See what changed in the update log.'}</p><div class="update-notice-actions">${scheduling?'<button type="button" class="secondary" data-open-schedule>Check Schedule settings</button>':''}<a class="button ghost" href="https://github.com/csmy-gg/brm5-hq-planner/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Full Update Log</a></div>`;
  bubble.querySelector('[aria-label="Dismiss update message"]').onclick=()=>bubble.remove();
  const settings=bubble.querySelector('[data-open-schedule]');if(settings)settings.onclick=()=>{bubble.remove();onSettings();};
  doc.body.append(bubble);
 }};
}
