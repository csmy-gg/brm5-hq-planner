import {rememberUpdateIntent} from './update-notice.js';
export function validRelease(value){return value?.format===1&&typeof value.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value.id);}

export function updateBlocker({online=true,dirty=false,editing=false,pending=false,locked=false,conflict=false,saveError=false,storageError=false,deferred=false}={}){
 if(!online)return 'You are offline. Reconnect before updating.';
 if(storageError)return 'Browser saving is unavailable. Export a backup before resolving the save problem.';
 if(dirty)return 'Save or discard unfinished edits, then close your check-in or Settings.';
 if(editing)return 'Close your check-in or Settings before updating.';
 if(conflict||deferred)return 'Review the latest save and resolve any save choices before updating.';
 if(saveError)return 'Reconnect to account saves before updating. Your device copy is preserved.';
 if(pending||locked)return 'Wait for your account save to finish syncing before updating.';
 return '';
}

export function createReleaseMonitor({current,fetchRelease,online=()=>true,visible=()=>true,blocker=()=>'',onChange=()=>{},reload=()=>{},now=Date.now}={}){
 let latest=null,latestRelease=null,checking=null,updating=false,lastCheck=-Infinity,error='',stopped=false;
 const view=()=>({available:Boolean(latest&&latest!==current),reason:blocker(),checking:Boolean(checking),updating,error});
 const refresh=()=>{if(!stopped)onChange(view());};
 async function check({force=false}={}){
  if(stopped||!online()||!visible())return false;
  if(checking)return checking;
  if(!force&&now()-lastCheck<30000)return false;
  lastCheck=now();
  checking=Promise.resolve().then(fetchRelease).then(value=>{
   if(stopped)return false;
   if(!validRelease(value))throw Error('Invalid release metadata');
   latest=value.id;latestRelease=value;error='';return true;
  }).catch(()=>{if(!stopped)error='Could not check the latest version. Try again when connected.';return false;}).finally(()=>{checking=null;refresh();});
  refresh();return checking;
 }
 async function update({discard=false}={}){
  if(stopped||updating||!view().available||blocker(discard))return false;
  updating=true;refresh();
  try{
   const checked=await check({force:true});
   if(stopped||!checked||blocker(discard)||!view().available)return false;
   // Recheck after the network request: a user may have edited or started a save meanwhile.
   reload({discard,release:latestRelease});return true;
  }finally{updating=false;refresh();}
 }
 return {check,update,refresh,get state(){return view();},stop(){stopped=true;}};
}

export function installReleaseUpdates({current,enabled,getSafety,document:doc=globalThis.document,window:win=globalThis.window,fetch:read=globalThis.fetch,reload=()=>win.location.reload()}={}){
 const banner=doc.querySelector('#release-update'),message=doc.querySelector('#release-update-message'),hint=doc.querySelector('#release-update-hint'),button=doc.querySelector('#release-update-button');
 if(!enabled||!current||current==='development')return {savedForm(){},stop(){}};
 const drafts=new Set(),online=()=>win.navigator.onLine!==false,discardButton=doc.querySelector('#release-discard-button'),dialog=doc.querySelector('#release-discard-dialog'),cancel=doc.querySelector('#release-discard-cancel'),confirm=doc.querySelector('#release-discard-confirm'),discardError=doc.querySelector('#release-discard-error');
 const safety=discard=>{const state=getSafety(),otherDialog=Boolean(doc.querySelector('dialog[open]:not(#release-discard-dialog)'));return {...state,online:online(),dirty:discard?false:Boolean(state.dirty||drafts.size),editing:discard?otherDialog:state.editing};};
 const monitor=createReleaseMonitor({current,online,visible:()=>!doc.hidden,reload:options=>{try{rememberUpdateIntent(win.sessionStorage,options.release);}catch{}reload(options);},
  fetchRelease:async()=>{
   const response=await read('/version.json',{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Release check failed');
   return response.json();
  },
  blocker:discard=>updateBlocker(safety(discard)),
  onChange:state=>{
   banner.hidden=!state.available;
   const title='A new website version is ready.';
   const detail=state.reason||state.error||'Your recorded progress is saved. Update when you are ready.';
   if(message.textContent!==title)message.textContent=title;
   if(hint.textContent!==detail)hint.textContent=detail;
   button.disabled=Boolean(state.reason||state.checking||state.updating);
   if(discardButton){discardButton.hidden=!state.reason||Boolean(updateBlocker(safety(true)));discardButton.disabled=state.checking||state.updating;}
   if(confirm)confirm.disabled=Boolean(updateBlocker(safety(true))||state.checking||state.updating);
   if(discardError&&dialog?.open)discardError.textContent=updateBlocker(safety(true))||state.error;
   const text=state.updating?'Preparing update…':state.checking?'Checking update…':'Update now';
   if(button.textContent!==text)button.textContent=text;
  }
 });
 function track(event){const form=event.target.form||event.target.closest?.('form');if(['start-research','sale'].includes(form?.id))drafts.add(form.id);monitor.refresh();}
 const check=()=>{monitor.refresh();void monitor.check();},click=()=>void monitor.update();
 function openDiscard(){if(updateBlocker(safety(true)))return;dialog.showModal();monitor.refresh();cancel.focus();}
 const cancelDiscard=()=>{dialog.close();discardButton.focus();},confirmDiscard=async()=>{if(await monitor.update({discard:true}))dialog.close();};
 discardButton?.addEventListener('click',openDiscard);cancel?.addEventListener('click',cancelDiscard);confirm?.addEventListener('click',confirmDiscard);
 dialog?.addEventListener('cancel',()=>{queueMicrotask(()=>discardButton.focus());});
 doc.addEventListener('input',track);doc.addEventListener('change',track);doc.addEventListener('visibilitychange',check);
 win.addEventListener('online',check);win.addEventListener('offline',check);win.addEventListener('focus',check);button.addEventListener('click',click);
 const checks=win.setInterval(()=>void monitor.check(),120000),safetyTimer=win.setInterval(monitor.refresh,1000);
 check();
 return {savedForm(id){drafts.delete(id);monitor.refresh();},stop(){monitor.stop();win.clearInterval(checks);win.clearInterval(safetyTimer);doc.removeEventListener('input',track);doc.removeEventListener('change',track);doc.removeEventListener('visibilitychange',check);for(const event of ['online','offline','focus'])win.removeEventListener(event,check);button.removeEventListener('click',click);discardButton?.removeEventListener('click',openDiscard);cancel?.removeEventListener('click',cancelDiscard);confirm?.removeEventListener('click',confirmDiscard);}};
}
