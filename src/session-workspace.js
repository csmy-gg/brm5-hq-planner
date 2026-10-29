import {captureViewFocus,restoreViewFocus} from './view-focus.js';
import {researchDuration} from './duration.js';
import {plannedStartText,plannedDelivery,plannedDeliveryText,productionBufferText,replenishmentText} from './forecast-ui.js';
import {researchCountdown} from './research-timing.js';
import {AREAS,LABELS,clone,count,blocked,tasksFor,forecast,nextVisit,researchPowerUsed} from './engine.js';
import {applySessionBatch} from './session-actions.js';
import {resourceMarkup} from './resource-ui.js';

const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=['CM','PM','Fuel','Equipment'];
export function createSessionWorkspace({getState,commit,data,date,money,getForecast}){
 const dialog=document.querySelector('#finish-session-dialog'),$=s=>dialog.querySelector(s),$$=s=>[...dialog.querySelectorAll(s)];let context=null,trigger=null;
 const total=(s,area)=>Object.values(s.staff[area]).reduce((n,x)=>n+x,0);
 const quantity=n=>(Math.floor(n*100)/100).toLocaleString('en-US');
 const resources=resourceMarkup;
 const button=(action,text,attributes='')=>`<button type="button" class="small-button" data-ws-action="${action}" ${attributes}>${text}</button>`;
 const included=(id,text)=>`<label class="checkbox ws-included"><input type="checkbox" id="${id}">${text}</label>`;
 function status(message,error=false){$('#workspace-status').textContent=message;$('#workspace-status').className=error?'ws-status error':'ws-status';$('#workspace-status').hidden=false;}
 function ensureCurrent(){if(!context||nextVisit(getState())!==context.scheduled||getState().revision!==context.revision)throw Error('Progress changed in another tab. Close and reopen this session to review the latest values.');}
 function number(selector,report=true){const el=$(selector);if(!el||!el.checkValidity()||el.value.trim()===''){if(report)el?.reportValidity();throw Error('Check the highlighted number before saving.');}return Number(el.value);}
 function readDrafts(report=true){
  const actions=[];
  if(context.dirty.has('ranks'))actions.push({type:'staff-ranks',area:context.rankArea,ranks:Object.fromEntries(Object.keys(data.wiki.staff).map(rank=>[rank,number(`[data-ws-rank="${rank}"]`,report)]))});
  if(context.dirty.has('staff'))actions.push({type:'unavailable',values:Object.fromEntries(AREAS.map(a=>[a,number(`[data-ws-unavailable="${a}"]`,report)]))});
  if(context.dirty.has('ops'))actions.push({type:'assign',assign:short.map((_,i)=>number(`[data-ws-assign="${i}"]`,report))});
  if(context.dirty.has('balances'))actions.push({type:'balances',cash:number('#ws-cash',report),res:short.map((_,i)=>number(`#ws-resource-${i}`,report))});
  return actions;
 }
 function write(actions,label,{close=false,after}={}){
  try{
   ensureCurrent();const all=[...readDrafts(),...actions];if(!all.length){after?.();if(close)dialog.close();else{if(after)render();status(after?label:'Everything is already saved.');}return true;}
   const next=applySessionBatch(getState(),all,data,Date.now()),result=commit(next,label);context.revision=getState().revision;context.dirty.clear();context.plan.ready=false;after?.();
   if(close){dialog.close();return true;}
   const scroll=dialog.querySelector('.ws-body').scrollTop;render();dialog.querySelector('.ws-body').scrollTop=scroll;
   refreshPlan();status(result?.persisted===false?'Recorded for this open page, but browser storage failed. Export a backup before closing.':label);return true;
  }catch(error){status(error.message,true);return false;}
 }
 function plan(result){const row=result.rows[0];return {ready:true,starts:row?.starts||[],researchSteps:row?.researchSteps||[],time:row?.time??Date.now(),visitMinutes:getState().visitMinutes??5,assign:row?.assign||[...getState().assign],productionBuffer:row?.productionBuffer,sold:row?.sold||0,delivery:plannedDelivery(row)};}
 async function refreshPlan(explicit=false){const reference=context;if(!reference)return;reference.plan.ready=false;const revision=getState().revision;try{const result=await getForecast();if(context!==reference||revision!==getState().revision)return;if(context.dirty.size||(!explicit&&(context.inputDrafts.size||dialog.querySelector('input:focus,select:focus')))){status('New suggestions are ready. Save or discard pending edits, then choose Update suggestions.');return;}context.plan=plan(result);for(const id of context.manualStarts)if(!context.plan.starts.includes(id))context.plan.starts.push(id);const scroll=$('.ws-body').scrollTop;render();$('.ws-body').scrollTop=scroll;}catch(error){if(context===reference&&revision===getState().revision)status(error.message,true);}}

 function timer(kind,id,end){const mins=Math.max(0,Math.ceil((end-Date.now())/60000));return `<details class="ws-timer" data-ws-timer="${kind}" data-ws-id="${id}"><summary>Edit remaining time</summary><div class="timer-fields"><label>Hours<input data-ws-hours type="number" min="0" max="8760" step="1" required value="${Math.floor(mins/60)}"></label><label>Minutes<input data-ws-minutes type="number" min="0" max="59" step="1" required value="${mins%60}"></label></div>${button('timer','Save time')}</details>`;}
 function balanceFields(s){return `<form class="ws-card ws-balances" data-ws-form="balances"><div class="ws-section-title"><div><h3>1. Cash & resources</h3><p>Enter your current in-game totals. Recorded actions below update these balances automatically.</p></div><span class="tag">Recorded ${date(s.snapshot,true)}</span></div><div class="ws-balance-grid"><label>Cash (USD)<input id="ws-cash" type="number" min="0" step="0.01" required value="${s.cash}"></label>${short.map((name,i)=>`<label>${name}<small>${LABELS[i]}</small><input id="ws-resource-${i}" type="number" min="0" step="1" required value="${s.res[i]}"></label>`).join('')}</div><div class="ws-card-footer"><button type="submit" class="secondary">Save balances</button><small>After recording actions, you can correct these to the final totals shown in-game.</small></div></form>`;}
 function staffFields(s){return `<details class="ws-card ws-staff"><summary>2. Staff recovery & losses <span class="tag">Edit here</span></summary><p class="muted">Update unavailable counts after treating injured staff or returning recovered staff.</p><form data-ws-form="staff"><div class="ws-staff-grid">${AREAS.map(area=>`<label>${area}<small>${total(s,area)} staff total · unavailable:</small><input data-ws-unavailable="${area}" type="number" min="0" max="${total(s,area)}" step="1" required value="${s.unavailable[area]}"></label>`).join('')}</div><button type="submit" class="secondary">Save staff readiness</button></form><details class="ws-ranks"><summary>Adjust ranks after hiring or a loss</summary><label>Department<select id="ws-rank-area">${AREAS.map(area=>`<option ${area===context.rankArea?'selected':''}>${area}</option>`).join('')}</select></label><form data-ws-form="ranks"><div class="ws-rank-grid">${Object.keys(data.wiki.staff).reverse().map(rank=>`<label>${rank}<input data-ws-rank="${rank}" type="number" min="0" max="1000" step="1" required value="${s.staff[context.rankArea][rank]||0}"></label>`).join('')}</div><button type="submit" class="secondary">Save department counts</button></form></details></details>`;}
 function deliveries(s){
  const suggested=context.plan.delivery;
  const rows=s.ships.map(ship=>{const ready=ship.end<=Date.now();return `<article class="ws-action-row" data-ws-ship="${ship.id}"><div class="ws-row-title"><strong>${ship.quantity} ${LABELS[ship.resource]}</strong><span class="badge ${ready?'':'active'}" data-ws-due="${ship.end}">${ready?'Ready to collect':'In transit'}</span></div><p>Payout ${money(ship.value)} · ${ship.staffIds.length} staff · due ${date(ship.end,true)}</p>${included('ws-collected-'+ship.id,'My cash already includes this payment')}${button('collect','Record collection',`data-ws-id="${ship.id}" ${ready?'':'disabled'}`)}${timer('delivery',ship.id,ship.end)}</article>`;}).join('')||'<p class="muted">No outgoing deliveries.</p>';
  const sent=s.ships.find(x=>x.recordToken===context.dispatchToken),recorded=s.session.actionKeys?.includes(context.dispatchToken);
  const dispatchRow=recorded?`<div class="ws-recorded">✓ Dispatch recorded${sent?': '+sent.quantity+' '+LABELS[sent.resource]:''}. It is already in your delivery list.</div>${button('another-dispatch','Record another delivery')}`:`<form data-ws-form="dispatch" class="ws-dispatch"><h4>${suggested?'Send this session’s planned delivery':'Send a delivery if needed'}</h4><p class="muted">${suggested?'Suggested: '+plannedDeliveryText(context.plan,money)+'.':'No sale is currently suggested. You can still record a delivery here.'} Payment arrives after ${data.wiki.deliveryHours} hours.</p>${suggested?.replenishment?'<p class="hint">'+replenishmentText(suggested)+'</p>':''}<div class="inline-fields"><label>Resource<select id="ws-dispatch-resource">${LABELS.map((name,i)=>`<option value="${i}" ${i===(suggested?.resource??2)?'selected':''}>${name}</option>`).join('')}</select></label><label>Quantity<input id="ws-dispatch-quantity" type="number" min="1" step="1" required value="${Math.max(1,suggested?.quantity??0)}"></label></div>${included('ws-dispatch-reflected','My resources already reflect this dispatch')}<button type="submit" class="secondary">Record dispatch</button><p class="hint">Record this after sending it in BRM5. The tracker saves its resource cost and outgoing timer.</p></form>`;
  return `<section class="ws-card"><div class="ws-section-title"><div><h3>3. Deliveries</h3><p>Collect each ready payment or record the delivery you sent. Each action saves once.</p></div></div><div class="ws-delivery-list">${rows}</div>${dispatchRow}</section>`;
 }
 function research(s){
  const tasks=tasksFor(s,data),active=tasks.filter(t=>s.status[t.id].state==='active'),power=researchPowerUsed(s,tasks);
  const planned=context.plan.starts.map(id=>tasks.find(t=>t.id===id)).filter(Boolean).map(t=>{const state=s.status[t.id].state;return `<article class="ws-action-row" data-ws-research="${t.id}"><strong>${escape(t.name)}</strong><p>${money(t.cost)} · ${resources(t.res)} · ${t.power} power · ${researchDuration(t.hours)}</p>${state==='todo'?`<p class="hint">${plannedStartText(context.plan.researchSteps.find(step=>step.id===t.id),context.plan.time)}</p>`+button('research-start','Record started',`data-ws-id="${t.id}"`)+`<p class="hint" data-ws-blocker="${t.id}"></p>`:`<span class="ws-recorded">✓ ${state==='active'?'Start recorded':'Completed'} — already updated in the research board.</span>`}</article>`;}).join('')||'<p class="muted">No new research starts suggested for this session.</p>';
  const running=active.map(t=>`<article class="ws-action-row" data-ws-running="${t.id}"><strong>${escape(t.name)}</strong><p data-ws-due="${s.status[t.id].end}">${researchCountdown(s.status[t.id].end)}${s.status[t.id].end>Date.now()?' · due '+date(s.status[t.id].end,true):''}</p>${button('research-complete','Record completed in-game',`data-ws-id="${t.id}"`)}${timer('research',t.id,s.status[t.id].end)}</article>`).join('')||'<p class="muted">No active research.</p>';
  return `<section class="ws-card"><div class="ws-section-title"><div><h3>4. Research</h3><p>Planned for ${context.plan.visitMinutes} minutes per visit. Work down this list, wait for short timers, and record completions to unlock follow-ups. Timers release power automatically.</p></div><span class="tag" data-ws-power>${Math.max(0,s.power-power)} / ${s.power} power free</span></div>${included('ws-research-reflected','My balances already include the research costs')}<div class="ws-research-planned">${planned}</div><details class="ws-other-research"><summary>Find a different research item</summary><label>Search<input id="ws-research-search" type="search" placeholder="Research name…"></label><label>Research item<select id="ws-research-choice"></select></label>${button('add-research','Add to this session’s list')}</details><h4>In progress</h4>${running}</section>`;
 }
 function operations(s){return `<form class="ws-card" data-ws-form="ops"><div class="ws-section-title"><div><h3>5. Operations assignments</h3><p>${count(s,'Operations')} staff available. CM / PM / Fuel / Equipment</p><div class="assignment-comparison"><div><span>Recorded</span><strong>${s.assign.join(' / ')}</strong></div><div><span>Suggested</span><strong>${context.plan.ready?context.plan.assign.join(' / '):'Updating…'}</strong></div></div><p class="assignment-state">${!context.plan.ready?'Updating assignment suggestion…':context.plan.assign.some((n,i)=>n!==s.assign[i])?'Suggestion not yet recorded':'Recorded assignments match the suggestion'}</p></div></div><div class="ws-ops-grid">${short.map((name,i)=>`<label>${name}<input data-ws-assign="${i}" type="number" min="0" step="1" required value="${s.assign[i]}"></label>`).join('')}</div><div class="ws-actions"><button type="submit" class="secondary">Save assignments</button>${button('suggested-assign','Record suggested assignments')}</div>${context.plan.productionBuffer?.extra?'<details class="advanced-explanation"><summary>Why this staffing suggestion?</summary><p class="hint">'+productionBufferText(context.plan.productionBuffer)+'</p></details>':''}<p class="hint">Record the assignments after setting them in-game. Saving updates the main staffing section too.</p></form>`;}
 function rememberInput(el){if(!el.matches('input,select'))return;const form=el.closest('[data-ws-form]');if(form&&['balances','staff','ops','ranks'].includes(form.dataset.wsForm))return;const timer=el.closest('[data-ws-timer]');const key=el.id?'#'+el.id:timer?'[data-ws-timer="'+timer.dataset.wsTimer+'"][data-ws-id="'+timer.dataset.wsId+'"] ['+(el.hasAttribute('data-ws-hours')?'data-ws-hours':'data-ws-minutes')+']':null;if(key)context.inputDrafts.set(key,{value:el.value,checked:el.checked});}
 function render(){
  const focus=captureViewFocus(dialog);
  const opened=$$('details[open]').map(el=>el.matches('[data-ws-timer]')?'[data-ws-timer="'+el.dataset.wsTimer+'"][data-ws-id="'+el.dataset.wsId+'"]':el.className?'.'+el.className.split(' ').join('.'):null).filter(Boolean);
  const s=getState();$('#finish-dialog-checklist').innerHTML=(!context.plan.ready?'<p class="ws-plan-note" role="status">Updating suggestions. Manual updates remain available.</p>':'')+balanceFields(s)+staffFields(s)+deliveries(s)+research(s)+operations(s);$('#workspace-unsaved').hidden=true;
  $('#ws-research-reflected').checked=context.researchReflected;Object.entries(context.flags).forEach(([id,value])=>{const input=$('#'+id);if(input)input.checked=value;});for(const [selector,value]of context.inputDrafts){const el=$(selector);if(el){el.value=value.value;el.checked=value.checked;}}filterResearch();const choice=context.inputDrafts.get('#ws-research-choice');if(choice&&[...$('#ws-research-choice').options].some(o=>o.value===choice.value))$('#ws-research-choice').value=choice.value;for(const selector of opened){const el=$(selector);if(el)el.open=true;}refreshEligibility();$('#workspace-close-warning').hidden=true;if(dialog.open)restoreViewFocus(dialog,focus,$('#close-finish-dialog'));
 }
 function filterResearch(){const q=$('#ws-research-search')?.value.toLowerCase()||'',tasks=tasksFor(getState(),data).filter(t=>getState().status[t.id].state==='todo'&&t.name.toLowerCase().includes(q));$('#ws-research-choice').innerHTML=tasks.length?tasks.map(t=>`<option value="${t.id}">${escape(t.name)}</option>`).join(''):'<option value="">No matching unstarted research</option>';}
 function preview(){return applySessionBatch(getState(),readDrafts(false),data,Date.now());}
 function refreshEligibility(){
  if(!context)return;let s;try{s=preview();}catch{return;}
  const power=researchPowerUsed(s,tasksFor(s,data));$('[data-ws-power]').textContent=`${Math.max(0,s.power-power)} / ${s.power} power free`;
  $$('[data-ws-action="research-start"]').forEach(el=>{const id=Number(el.dataset.wsId),task=tasksFor(s,data).find(t=>t.id===id),why=blocked(task,s,tasksFor(s,data),Date.now(),$('#ws-research-reflected').checked);el.disabled=why.length>0||(!context.plan.ready&&!context.manualStarts.has(id));el.textContent=$('#ws-research-reflected').checked?'Record start · balances unchanged':'Record start · −'+money(task.cost);$(`[data-ws-blocker="${id}"]`).textContent=why.join(' · ');});
  const suggested=$('[data-ws-action="suggested-assign"]');if(suggested)suggested.disabled=!context.plan.ready;
  const form=$('[data-ws-form="dispatch"]');if(form){form.querySelector('button[type=submit]').disabled=!context.plan.ready&&!context.inputDrafts.has('#ws-dispatch-quantity')&&!context.inputDrafts.has('#ws-dispatch-resource');const resource=Number($('#ws-dispatch-resource').value),q=Number($('#ws-dispatch-quantity').value);form.querySelector('button[type=submit]').textContent=$('#ws-dispatch-reflected').checked?'Record dispatch · stock unchanged':'Record dispatch · −'+quantity(q)+' '+short[resource];}
  $$('[data-ws-action="collect"]').forEach(el=>{const ship=s.ships.find(x=>x.id===el.dataset.wsId);if(!ship)return;el.disabled=ship.end>Date.now();el.textContent=$('#ws-collected-'+ship.id).checked?'Record collection · cash unchanged':'Record collection · +'+money(ship.value);});
 }
 function dirty(section){context.dirty.add(section);$('#workspace-unsaved').hidden=false;refreshEligibility();}
 function close(){if(context?.dirty.size){$('#workspace-close-warning').hidden=false;$('#workspace-save-close').focus();return;}dialog.close();}
 function saveAndFinish(){if(!context)return;context.dirty.add('balances');write([{type:'finish',scheduled:context.scheduled}],'Session finished: '+date(context.scheduled)+'. Recorded updates saved.',{close:true});}
 function run(action){
  const s=getState();
  switch(action){
   case 'balances':case 'staff':case 'ops':case 'ranks':context.dirty.add(action);return write([],'Session: '+({balances:'cash and resource totals saved',staff:'staff readiness saved',ops:'Operations assignments saved',ranks:'department staff counts saved'}[action]));
   case 'dispatch':if(!context.plan.ready&&!context.inputDrafts.has('#ws-dispatch-quantity')&&!context.inputDrafts.has('#ws-dispatch-resource'))throw Error('Wait for updated suggestions, or enter the actual delivery you sent.');return write([{type:'dispatch',resource:number('#ws-dispatch-resource'),quantity:number('#ws-dispatch-quantity'),alreadyReflected:$('#ws-dispatch-reflected').checked,token:context.dispatchToken}],'Session: outgoing delivery recorded');
  }
 }
 dialog.addEventListener('submit',event=>{const form=event.target.closest('[data-ws-form]');if(!form)return;event.preventDefault();try{run(form.dataset.wsForm);}catch(error){status(error.message,true);}});
 dialog.addEventListener('input',event=>{
  if(!context)return;const form=event.target.closest('[data-ws-form]');if(form&&['balances','staff','ops','ranks'].includes(form.dataset.wsForm))dirty(form.dataset.wsForm);
  rememberInput(event.target);if(event.target.id==='ws-research-search')filterResearch();
 });
 dialog.addEventListener('change',event=>{
  if(!context)return;
  if(event.target.id==='ws-rank-area'){if(context.dirty.has('ranks')){event.target.value=context.rankArea;status('Save your department count edits before selecting another department.',true);return;}context.rankArea=event.target.value;const details=event.target.closest('.ws-ranks');details.querySelectorAll('[data-ws-rank]').forEach(input=>input.value=getState().staff[context.rankArea][input.dataset.wsRank]||0);}
  if(event.target.closest('.ws-included'))context.flags[event.target.id]=event.target.checked;
  if(event.target.id==='ws-research-reflected')context.researchReflected=event.target.checked;
  refreshEligibility();
 });
 dialog.addEventListener('click',event=>{
  if(event.detail>1&&event.target.closest('button,input[type=checkbox],label.checkbox')){event.preventDefault();return;}
  const summary=event.target.closest('[data-ws-timer] > summary');if(context&&summary){const details=summary.parentElement;if(!details.open){const state=getState(),id=details.dataset.wsId,end=details.dataset.wsTimer==='delivery'?state.ships.find(x=>x.id===id)?.end:state.status[Number(id)]?.end;if(end!=null){const minutes=Math.max(0,Math.ceil((end-Date.now())/60000));details.querySelector('[data-ws-hours]').value=Math.floor(minutes/60);details.querySelector('[data-ws-minutes]').value=minutes%60;}}}
  const el=event.target.closest('[data-ws-action]');if(!el||!context)return;
  try{
   const id=el.dataset.wsId,action=el.dataset.wsAction;
   if(action==='another-dispatch')write([],'Session: ready for another delivery',{after:()=>{context.dispatchToken='checkin-'+context.scheduled+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);context.plan.sold=0;context.plan.delivery=null;}});
   if(action==='collect'){const ship=getState().ships.find(x=>x.id===id);write([{type:'collect',id,alreadyReflected:$('#ws-collected-'+id).checked}],'Session: collected '+ship?.quantity+' '+LABELS[ship?.resource]+' delivery');}
   if(action==='research-start'){if(!context.plan.ready&&!context.manualStarts.has(Number(id)))throw Error('Wait for updated suggestions.');const task=data.tasks.find(x=>x.id===Number(id));write([{type:'research-start',id:Number(id),alreadyReflected:$('#ws-research-reflected').checked}],'Session: research started — '+task.name);}
   if(action==='research-complete'){const task=data.tasks.find(x=>x.id===Number(id));write([{type:'research-complete',id:Number(id)}],'Session: research completed — '+task.name);}
   if(action==='suggested-assign'&&!context.plan.ready)throw Error('Wait for updated suggestions before recording this assignment.');
   if(action==='suggested-assign')write([{type:'assign',assign:context.plan.assign}],'Session: suggested Operations assignments recorded');
   if(action==='add-research'){if(context.dirty.size)throw Error('Save pending edits before changing the research list.');const value=$('#ws-research-choice').value;if(value==='')throw Error('Choose a research item first.');context.manualStarts.add(Number(value));if(!context.plan.starts.includes(Number(value)))context.plan.starts.push(Number(value));const scroll=$('.ws-body').scrollTop;render();$('.ws-body').scrollTop=scroll;}
   if(action==='timer'){const details=el.closest('[data-ws-timer]'),hours=details.querySelector('[data-ws-hours]'),minutes=details.querySelector('[data-ws-minutes]');if(!hours.reportValidity()||!minutes.reportValidity())return;write([{type:'timer',kind:details.dataset.wsTimer,id:details.dataset.wsTimer==='research'?Number(details.dataset.wsId):details.dataset.wsId,hours:Number(hours.value),minutes:Number(minutes.value)}],'Session: remaining time updated');}
  }catch(error){status(error.message,true);}
 });
 $('#cancel-finish-dialog').onclick=$('#close-finish-dialog').onclick=close;
 $('#confirm-finish-dialog').onclick=saveAndFinish;
 $('#workspace-save-close').onclick=()=>write([],'Session: pending updates saved',{close:true});
 $('#workspace-discard-close').onclick=()=>dialog.close();
 $('#workspace-refresh').onclick=()=>{write([],'Session: suggestions refreshed',{after:()=>{refreshPlan(true);}});};
 setInterval(()=>{if(!context||!dialog.open)return;$$('[data-ws-due]').forEach(el=>{const end=Number(el.dataset.wsDue),minutes=Math.max(0,Math.ceil((end-Date.now())/60000)),left=Math.floor(minutes/60)+'h '+String(minutes%60).padStart(2,'0')+'m';if(el.closest('[data-ws-ship]')){el.textContent=end<=Date.now()?'Ready to collect':left+' remaining';el.classList.toggle('active',end>Date.now());}else el.textContent=researchCountdown(end)+(end>Date.now()?' · due '+date(end,true):'');});refreshEligibility();},1000);
 dialog.addEventListener('cancel',event=>{if(context?.dirty.size){event.preventDefault();close();}});
 dialog.addEventListener('close',()=>{context=null;const target=trigger;trigger=null;if(target?.isConnected)target.focus();else document.querySelector('#finish-session').focus();});
 return {
  onForecastChange(view){if(!context||!dialog.open)return;if(view.pending){context.plan.ready=false;refreshEligibility();}else if(!view.error)refreshPlan();},
  get hasDrafts(){return Boolean(context?.dirty.size);},
  async open(scheduled,element,section){
   if(dialog.open)return;if(scheduled!==nextVisit(getState()))throw Error('The current session changed. Review it first.');
   const revision=getState().revision,result=await getForecast();if(dialog.open)return;if(revision!==getState().revision||scheduled!==nextVisit(getState()))throw Error('The HQ changed while opening this session. Try again.');
   trigger=element;context={scheduled,revision:getState().revision,plan:plan(result),manualStarts:new Set(),inputDrafts:new Map(),dirty:new Set(),rankArea:'Operations',researchReflected:false,flags:{},dispatchToken:'checkin-'+scheduled+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)};
   $('#finish-dialog-date').textContent=date(scheduled);$('#workspace-status').hidden=true;render();dialog.showModal();$('#close-finish-dialog').focus({preventScroll:true});$('.ws-body').scrollTop=0;if(section){const target=dialog.querySelector(section==='deliveries'?'.ws-delivery-list':section==='research'?'.ws-research-planned':`[data-ws-form="${section}"]`);target?.scrollIntoView({block:'start'});}
  }
 };
}
