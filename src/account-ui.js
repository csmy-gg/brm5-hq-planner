import {createRecoveryPrompt} from './recovery-prompt.js';
const $=s=>document.querySelector(s);
export function downloadJSON(data,name='brm5-hq-recovery'){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function createAccountUI({persistence:p,getState,toast}){
 const dialog=$('#account-dialog'),offerRecovery=createRecoveryPrompt($('#recovery-dialog'),downloadJSON);let openedChoice=null;
 const summary=(label,profile)=>{const article=document.createElement('article'),h=document.createElement('h3'),text=document.createElement('p');h.textContent=label;text.textContent=profile?'$'+Math.round(profile.cash).toLocaleString()+' · '+Object.values(profile.status).filter(x=>x.state==='done').length+' research completed · '+profile.ships.length+' deliveries':'No saved HQ yet';article.append(h,text);return article;};
 const run=fn=>async()=>{try{await fn();render();}catch(error){toast(error.message,true);}};
 function review(){
  const c=p.choice;if(!c)return;openedChoice=c;$('#account-dialog-title').textContent=c.kind==='conflict'?'Progress changed on another device':'Choose your account HQ';
  $('#account-dialog-description').textContent=c.kind==='conflict'?'Both copies are preserved. Choose the one you want to continue with. Cash and actions will not be combined.':'Choose an existing HQ or start an empty one. Your guest save stays separate.';
  $('#save-comparison').replaceChildren(summary('Account save',c.remote?.profile),summary('This device',getState()));
  if(c.guest)$('#save-comparison').append(summary('Guest HQ',c.guest));
  $('#account-dialog-note').textContent='Choosing a save keeps a recovery copy on this device. You can optionally download a backup afterward.';
  const actions=$('#account-dialog-actions');actions.replaceChildren();
  const add=(value,text)=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.onclick=run(async()=>{const backup=await p.resolve(value);dialog.close();openedChoice=null;await offerRecovery(backup);});actions.append(b);};
  if(c.remote)add('cloud','Use account save');
  if(c.kind==='conflict')add('device','Use this device’s save');
  else{if(c.guest)add('guest','Save guest HQ to account');if(!c.remote)add('empty','Start an empty HQ');}
  if(!dialog.open)dialog.showModal();
 }
 function render(){
  $('#save-status').textContent=p.status;
  $('#account-description').textContent=p.user?'Signed in as '+(p.user.email||'a player')+'. Your HQ is private to your account.':'Guest mode keeps this HQ in this browser. Sign in to sync between devices.';
  $('#account-status').textContent=p.detail||(!p.client?'Account sync is not configured on this deployment. Guest tracking and backups work normally.':!p.user&&!p.providers.length?'Sign-in is being configured. You can use the full planner as a guest.':'');
  document.querySelectorAll('[data-sign-in]').forEach(b=>{b.hidden=Boolean(p.user);b.disabled=!p.providers.includes(b.dataset.signIn);});
  $('#sign-out').hidden=!p.user;$('#sync-retry').hidden=!p.user||Boolean(p.choice);$('#review-save').hidden=!p.choice;
  if(p.choice&&openedChoice!==p.choice)review();
 }
 document.querySelectorAll('[data-sign-in]').forEach(b=>b.onclick=run(()=>p.signIn(b.dataset.signIn)));
 $('#sign-out').onclick=run(async()=>{if(p.pending||p.choice){await offerRecovery(getState(),'brm5-unsynced-hq');toast('Unsynced changes remain saved on this device.');}await p.signOut();});
 $('#sync-retry').onclick=run(()=>p.refresh());$('#review-save').onclick=review;$('#close-account-dialog').onclick=()=>dialog.close();
 const list=$('#timezones');const zones=Intl.supportedValuesOf?.('timeZone')||['UTC','Europe/Prague','Europe/London','America/New_York'];for(const zone of ['UTC',...zones]){const option=document.createElement('option');option.value=zone;list.append(option);}
 return {render};
}
