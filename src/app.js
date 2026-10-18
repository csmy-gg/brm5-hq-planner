import {validateProfile as validate} from './profile.js';
import {createPersistence} from './persistence.js';
import {createAccountUI} from './account-ui.js';
import {zonedTimestamp,calendarInput,validTimezone} from './time.js';
import {createSetupResearch} from './setup-research.js';
import {createSessionWorkspace} from './session-workspace.js';
import {DATA,migrateResearchState} from './full-data.js';
import {KEYS,LABELS,AREAS,clone,defaults,count,metrics,tasksFor,goalIds,blocked,start,dispatch,collect,forecast,nextVisit,projectStock,normalizeDeliveries,freeDeliverySlots,recordHistory,restoreHistory,pragueTimestamp,finishSession} from './engine.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],money=n=>'$'+Math.round(n).toLocaleString('en-US'),num=n=>(Math.floor(n*10)/10).toLocaleString('en-US'),esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=(t,short=false)=>t==null?'Set up your first visit':new Intl.DateTimeFormat('en-GB',{timeZone:state.timezone,weekday:short?undefined:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(t));
let state=normalizeDeliveries(defaults(DATA.tasks),DATA.wiki),filter='all',full=false,toastTimer,storageOk=true;
let accountUI,lastIdentity=null;
const persistence=createPersistence({validate,empty:()=>defaults(DATA.tasks),onChange:next=>{
 const identity=persistence.user?.id??null,switching=identity!==lastIdentity;
 if(!switching&&(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('#finish-session-dialog')?.open)){
  toast('Account progress changed elsewhere. Review the latest saved values before saving these edits.');return;
 }
 state=next;if(switching){lastIdentity=identity;setupResearch.reset();}document.querySelector('#finish-session-dialog')?.close();render();
},onStatus:()=>{accountUI?.render();}});
try{state=persistence.load();}catch{storageOk=false;}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6500);}
function describeAction(next,message){
 if(message?.startsWith('Restored the state before:')||message?.startsWith('Session:')||message?.startsWith('Session finished:'))return message;
 const tasks=tasksFor(state,DATA),started=tasks.filter(t=>state.status[t.id].state==='todo'&&next.status[t.id].state==='active'),completed=tasks.filter(t=>state.status[t.id].state!=='done'&&next.status[t.id].state==='done');
 if(started.length)return 'Started research: '+started.map(t=>t.name).join(', ');if(completed.length)return 'Completed research: '+completed.map(t=>t.name).join(', ');
 const added=next.ships.filter(x=>!state.ships.some(y=>y.id===x.id)),removed=state.ships.filter(x=>!next.ships.some(y=>y.id===x.id));
 if(added.length)return 'Dispatched '+added.map(x=>x.quantity+' '+LABELS[x.resource]).join(', ');if(removed.length)return 'Collected '+money(removed.reduce((n,x)=>n+x.value,0))+' from delivery';
 if(next.cash!==state.cash)return 'Cash changed: '+money(state.cash)+' → '+money(next.cash);return message||'Planning preferences updated';
}
function commit(next,message){
 let current;try{current=persistence.readRaw();}catch{storageOk=false;throw Error('Browser storage is unavailable. Your changes have not been saved.');}
 if(current){let latest;try{latest=validate(JSON.parse(current));}catch{throw Error('Saved progress could not be read. Reload or restore a backup before saving.');}if(latest.revision!==state.revision){state=latest;render();throw Error('Progress changed in another tab. Review the updated values and try again.');}}
 next=validate(next);const candidate=recordHistory(message==='Backup restored.'?{...state,history:next.history}:state,next,describeAction(next,message));candidate.revision=Date.now()+'-'+Math.random().toString(36).slice(2,9);
 try{persistence.save(candidate);}catch(error){storageOk=false;throw Error(error.message||'The browser could not save this action. Your recorded progress is unchanged.');}
 state=candidate;storageOk=true;render();if(message)toast(message);return {persisted:true};
}
function act(fn,msg){try{commit(fn(),msg);}catch(e){toast(e.message);}}
function input(id){const n=Number($('#'+id).value);if(!Number.isFinite(n)||n<0)throw Error('Enter a valid nonnegative number.');return n;}
function resourceText(res){return res.map((n,i)=>n?`${num(n)} ${['CM','PM','Fuel','E'][i]}`:'').filter(Boolean).join(' · ')||'No resources';}
function openFinishReview(scheduled,trigger){try{workspace.open(scheduled,trigger);}catch(error){toast(error.message);}}
function updateVisitCountdowns(){
 const now=Date.now();$$('[data-visit-time]').forEach(el=>{const end=Number(el.dataset.visitTime);if(!el.dataset.visitTime){el.textContent='Complete setup to create a visit';return;}const difference=end-now;if(difference<=0){el.textContent=el.hasAttribute('data-reference-visit')&&difference<0?'Visit time passed':el.hasAttribute('data-current-session')?'Due now · awaiting confirmation':'Due now';return;}const total=Math.ceil(difference/60000),days=Math.floor(total/1440),hours=Math.floor(total%1440/60),minutes=total%60;el.textContent='In '+(days?days+'d ':'')+(hours||days?hours+'h ':'')+minutes+'m';});
}
function render(){
 const tasks=tasksFor(state,DATA),now=Date.now(),m=metrics(state,DATA.wiki),f=forecast(state,DATA,now),row=f.rows[0],nxt=nextVisit(state,now),ids=goalIds(state,tasks);
 $('#today-date').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:state.timezone,day:'numeric',month:'long',year:'numeric'}).format(new Date(now));accountUI?.render();if(!storageOk)$('#save-status').textContent='Storage unavailable — export a backup';$('#timezone-label').textContent=state.timezone;$('#undo').disabled=!state.history?.length;
 $('#next-time').textContent=date(nxt);$('#next-visit-countdown').dataset.visitTime=nxt??'';$('#hero-detail').textContent=row?.starts.length?`${row.starts.length} research ${row.starts.length===1?'start':'starts'} projected, plus your usual HQ check-in.`:f.finished?'Your selected goal is already complete. Choose another goal to keep planning.':'A collection, recovery and production check-in. Research starts when stock and cash allow.';
 const lastSession=state.session.completed.at(-1);
 $('#session-status').textContent=nxt<=now?'Due · waiting for you to finish':'Scheduled · completion required';
 $('#finish-session').dataset.finishSession=nxt;
 $('#finish-session-top').dataset.finishSession=nxt;
 $('#session-completion-note').textContent='Record what you did in the controls below, then mark this session finished. '+(lastSession?'Last confirmed '+date(lastSession.finishedAt,true)+'.':'The current session stays here until you confirm it.');
 $('#goal').innerHTML=`<option value="all">Complete all ${tasks.length} research items</option><option value="cash">Reach a cash balance</option><option value="resource">Build a resource stockpile</option>`+tasks.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');$('#goal').value=state.goal;$('#target-wrap').hidden=!['cash','resource'].includes(state.goal);$('#target').value=state.target;$('#goal-resource').innerHTML=LABELS.map((n,i)=>`<option value="${i}">${n}</option>`).join('');$('#goal-resource').value=state.goalResource;$('#goal-resource').hidden=state.goal!=='resource';
 const remaining=tasks.filter(t=>ids.has(t.id)&&state.status[t.id].state==='todo');$('#goal-needs').textContent=state.goal==='cash'?`Need ${money(Math.max(0,state.target-state.cash))} more cash.`:state.goal==='resource'?`Need ${num(Math.max(0,state.target-state.res[state.goalResource]))} more ${LABELS[state.goalResource]}.`:`Remaining research costs: ${money(remaining.reduce((n,t)=>n+t.cost,0))} · ${resourceText(KEYS.map((_,i)=>remaining.reduce((n,t)=>n+t.res[i],0)))}`;
 $('#eta').textContent=f.finished?(f.rows.length?`Estimated ${date(f.finish,true)}`:'Goal reached ✓'):'No finish within 160 visits';
 const done=tasks.filter(t=>state.status[t.id].state==='done').length,active=tasks.filter(t=>state.status[t.id].state==='active'),power=active.reduce((n,t)=>n+t.power,0),used=state.res.reduce((a,b)=>a+b,0);
 $('#stats').innerHTML=`<div class="stat"><span>RESEARCH COMPLETED</span><strong>${done} <small>/ ${tasks.length}</small></strong><div class="progress"><i style="width:${done/tasks.length*100}%"></i></div></div><div class="stat"><span>AVAILABLE CASH</span><strong>${money(state.cash)}</strong><small>${money(state.reserve)} protected reserve</small><button id="edit-cash" type="button" class="small-button" aria-expanded="false" aria-controls="cash-editor">Edit cash</button><form id="cash-editor" hidden><label for="current-cash">Current cash (USD)</label><input id="current-cash" type="number" min="0" step="0.01" required value="${state.cash}"><div class="cash-actions"><button class="small-button" type="submit">Save cash</button><button class="small-button" type="button" id="cancel-cash">Cancel</button></div><small>Enter your actual balance after purchases.</small></form></div><div class="stat"><span>RESEARCH POWER</span><strong>${Math.max(0,state.power-power)} <small>/ ${state.power} free</small></strong><small>${active.length} in progress · ${power} in use</small></div><div class="stat"><span>STORAGE USED</span><strong>${num(used)} <small>/ ${m.capacity}</small></strong><small>${num(Math.max(0,m.capacity-used))} space available</small></div>`;
 const starts=row?.starts.map(id=>tasks.find(x=>x.id===id))||[],assign=row?.assign||state.assign;
 $('#checklist').innerHTML=`<li><strong>Recover your staff</strong><p>Send injured staff to Infirmary; return recovered staff to their departments. Update unavailable counts.</p></li><li><strong>Collect and check stock</strong><p>${row?.collected?`Collect ${money(row.collected)} from deliveries. `:''}Confirm completed research and enter actual balances after any raids.</p></li><li><strong>${starts.length?'Start research':'Hold for the next research window'}</strong><p>${starts.length?esc(starts.map(t=>t.name).join(' + '))+` · ${money(starts.reduce((n,t)=>n+t.cost,0))}`:'Let resources and cash build. Check the research board for the exact blockers.'}</p></li><li><strong>Dispatch & assign Operations</strong><p>${row?.sold?`Sell ${row.sold} Fuel → ${money(row.sold*150)} after delivery. `:'No fuel sale projected. '}Assign CM / PM / Fuel / E: <b>${assign.join(' / ')}</b>.</p></li>`;
 const notices=[];if(used>m.capacity)notices.push('Recorded stock exceeds calculated storage. Check staff or use the storage override.');if(power>state.power)notices.push('Recorded active research exceeds your current power. Correct completed research or power.');if(state.cash<state.reserve)notices.push('Cash is below your replacement reserve. Prioritize a delivery before new research.');if(AREAS.some(area=>(state.unavailable[area]||0)>0))notices.push('Some staff are unavailable. Production and capacity estimates have been reduced.');if(row?.capped)notices.push('Production may hit the storage limit before your next visit. Consider an earlier check-in.');if(state.goal==='resource'&&state.target>m.capacity)notices.push('Your stockpile target exceeds total storage. Increase Logistics capacity or lower the target.');
 $('#attention').innerHTML=(notices.length?notices.map(n=>`<div class="attention-item">${esc(n)}</div>`).join(''):'<div class="attention-item good">No urgent balance issues in your recorded HQ.</div>')+`<p class="hint">Raid chance ${state.raid===null?'not entered':state.raid+'%'} · defense win chance ${state.win===null?'not entered':state.win+'%'}. Losses and deaths vary; ${state.uptime}% uptime and ${money(state.reserve)} reserve are your planning buffers.</p>`;
 const activeMarkup=active.map(t=>researchTimerMarkup(t,now)).join('');
 $('#active-research').innerHTML=activeMarkup;
 $('#research-in-progress').innerHTML=activeMarkup||'<p class="hint">No active research. Choose an item to record its start.</p>';
 $('#research-power-used').textContent=`${power} / ${state.power} power in use`;
 renderResearchPicker();

 const free=freeDeliverySlots(state,DATA.wiki),capacity=free.reduce((n,x)=>n+x.capacity,0);
 const deliveryMarkup=state.ships.map(ship=>deliveryCard(ship,now)).join('')||'<p class="hint">No active deliveries. Delivery staff are available for a dispatch.</p>';
 $('#shipment').innerHTML=deliveryMarkup;
 $('#active-deliveries').innerHTML=`<h4>Active deliveries (${state.ships.length})</h4>`+deliveryMarkup;
 $('#sale button[type="submit"]').disabled=capacity===0;
 $('#inventory-fields').innerHTML=['Cash (USD)',...LABELS].map((name,i)=>`<label>${name}<input id="stock-${i}" type="number" min="0" step="0.01" required value="${i?state.res[i-1]:state.cash}"></label>`).join('');$('#snapshot-label').textContent='Recorded '+date(state.snapshot,true);$('#delivery-limit').textContent=` ${free.length} staff free · ${capacity} units available`;
 $('#sale-resource').innerHTML=LABELS.map((n,i)=>`<option value="${i}" ${i===2?'selected':''}>${n} (${money(DATA.wiki.sellPrices[KEYS[i]])})</option>`).join('');
 for(const k of ['power','reserve','uptime','capacity','anchor','interval','raid','win','timezone'])$('#'+k).value=state[k];$('#auto-capacity').checked=state.autoCapacity;$('#capacity').disabled=state.autoCapacity;
 const ranks=Object.keys(DATA.wiki.staff).reverse();$('#staff-total').textContent=AREAS.reduce((n,a)=>n+Object.values(state.staff[a]).reduce((a,b)=>a+b,0),0)+' staff';
 $('#staff-table').innerHTML='<thead><tr><th>Department</th>'+ranks.map(r=>`<th>${r}</th>`).join('')+'<th>Unavailable</th></tr></thead><tbody>'+AREAS.map(a=>`<tr><td>${a}</td>${ranks.map(r=>`<td><input type="number" min="0" max="1000" step="1" value="${state.staff[a][r]||0}" data-area="${a}" data-rank="${r}" aria-label="${a} ${r}"></td>`).join('')}<td><input type="number" min="0" value="${state.unavailable[a]}" data-unavailable="${a}" aria-label="${a} unavailable"></td></tr>`).join('')+'</tbody>';
 $('#allocation-fields').innerHTML=LABELS.map((n,i)=>`<label>${n}<input id="assign-${i}" type="number" min="0" step="1" value="${state.assign[i]}"></label>`).join('');
 renderResearch(tasks);
 setupResearch.sync();
 $('#timeline').innerHTML=f.rows.slice(0,full?160:8).map((r,i)=>`<article class="session-row ${i===0?'current-session-row':''}"><div class="session-date"><strong>${date(r.scheduledTime,true)}</strong><small>${i===0?'Current session · confirm to advance':'Upcoming visit '+i}</small><span class="visit-countdown" ${i===0?'data-current-session':''} data-visit-time="${r.scheduledTime}"></span></div><div class="session-content"><h3>${r.starts.length?r.starts.map(id=>esc(tasks.find(x=>x.id===id).name)).join(' + '):'Routine HQ check-in'}</h3><p>${r.completes.length?`Confirm ${r.completes.length} completed research. `:''}${r.collected?`Collect ${money(r.collected)}. `:''}${r.sold?`Send ${r.sold} Fuel for ${money(r.sold*150)}. `:''}</p><p>Operations CM / PM / Fuel / E: <b>${r.assign.join(' / ')}</b></p><span class="tag">Projected after actions: ${money(r.after.cash)} · ${resourceText(r.after.res)}</span>${i===0?`<div class="session-finish-inline"><button type="button" class="small-button" data-finish-session="${nxt}">Mark session finished</button></div>`:''}</div></article>`).join('')+(f.rows.length>8&&!full?`<p class="hint">Showing 8 of ${f.rows.length} forecast visits. Use “Show full forecast” for the entire plan.</p>`:'')+(!f.finished?'<p class="notice">This goal does not finish in the forecast window. Check staffing, delivery capacity, power, reserve and storage. The planner uses a practical priority rule, not a proof of the fastest possible schedule.</p>':'');
 if(!f.rows.length)$('#timeline').innerHTML=`<article class="session-row current-session-row"><div class="session-date"><strong>${date(nxt,true)}</strong><small>Current session</small><span class="visit-countdown" data-current-session data-visit-time="${nxt}"></span></div><div class="session-content"><h3>Goal reached — finish your HQ check-in</h3><p>Confirm this session after recording what you did.</p><button type="button" class="small-button" data-finish-session="${nxt}">Mark session finished</button></div></article>`;
 $('#show-all').textContent=full?'Show next 8 visits':'Show full forecast';
 $('#history-list').innerHTML=(state.history||[]).slice().reverse().map(entry=>`<article class="history-entry"><div><strong>${esc(entry.label)}</strong><small>${date(entry.at)}</small></div><button type="button" class="small-button" data-restore-history="${esc(entry.id)}">Restore before this</button></article>`).join('')||'<p class="hint">Your next saved change will appear here.</p>';
 if(f.needsSetup){
  $('#hero-detail').textContent='Start with your real HQ balances, staff and completed research. Then choose your first visit.';
  $('#eta').textContent='Finish setup to see your plan';$('#session-status').textContent='Setup needed';
  $('#checklist').innerHTML='<li><strong>Set up your HQ</strong><p>Follow the five steps in the setup guide. Nothing is prefilled as researched.</p><a href="#guide" class="button secondary">Open setup guide</a></li>';
  $('#timeline').innerHTML='<p class="notice">Finish the setup guide to generate your first session plan.</p>';
 }
 $$('[data-finish-session]').forEach(b=>b.disabled=Boolean(f.needsSetup));
 $('#setup-progress').textContent=state.setupComplete?'Setup complete. You can change your HQ details at any time.':'Your HQ starts empty. Save your details below, then finish setup.';
 $('#finish-setup').textContent=state.setupComplete?'Update setup & rebuild plan':'Finish setup & create my plan';
 updateVisitCountdowns();
}
function deliveryCard(ship,now){const minutes=Math.max(0,Math.ceil((ship.end-now)/60000));return `<div class="shipment" data-delivery-id="${ship.id}"><div class="delivery-heading"><strong>${ship.quantity} ${LABELS[ship.resource]}</strong><span class="badge ${ship.end<=now?'':'active'}">${ship.end<=now?'READY TO COLLECT':'IN TRANSIT'}</span></div><p class="hint">${ship.staffIds.length} delivery staff assigned</p><p class="delivery-payout">Payout: <b>${money(ship.value)}</b></p><p class="muted">${ship.end<=now?'Arrived '+date(ship.end,true):`Due ${date(ship.end,true)} · ${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m remaining`}</p><button type="button" data-collect class="small-button" ${ship.end>now?'disabled':''}>Record payment collected</button><button type="button" data-edit-delivery-time class="small-button" aria-expanded="false">Edit remaining time</button><fieldset class="delivery-timer-editor" hidden><legend>Time remaining from now</legend><div class="timer-fields"><label>Hours<input type="number" data-timer-hours min="0" max="8760" step="1" required value="${Math.floor(minutes/60)}"></label><label>Minutes<input type="number" data-timer-minutes min="0" max="59" step="1" required value="${minutes%60}"></label></div><div class="cash-actions"><button type="button" data-save-delivery-time class="small-button">Save time</button><button type="button" data-cancel-delivery-time class="small-button">Cancel</button></div><p class="hint">Set 0 hours and 0 minutes if it has arrived, then record payment collected.</p></fieldset></div>`;}
function researchTimerMarkup(t,now=Date.now(),heading=true){
 const end=state.status[t.id].end,mins=Math.max(0,Math.ceil((end-now)/60000));
 return `<div class="active-item research-running-item" data-research-id="${t.id}">${heading?`<strong>${esc(t.name)}</strong>`:''}<span>${end<=now?'Timer elapsed — confirm in game':`${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m remaining · Due ${date(end,true)}`}</span><br><button type="button" class="small-button" data-complete="${t.id}">Confirm completed</button><button type="button" class="small-button" data-edit-research-time aria-expanded="false">Edit remaining time</button><fieldset class="research-timer-editor" hidden><legend>Time remaining from now</legend><div class="timer-fields"><label>Hours<input type="number" data-research-hours min="0" max="8760" step="1" required value="${Math.floor(mins/60)}"></label><label>Minutes<input type="number" data-research-minutes min="0" max="59" step="1" required value="${mins%60}"></label></div><div class="cash-actions"><button type="button" data-save-research-time class="small-button">Save time</button><button type="button" data-cancel-research-time class="small-button">Cancel</button></div><p class="hint">Set both to 0 if finished, then confirm completed. Power is freed when you confirm.</p></fieldset></div>`;
}
function renderResearchPicker(){
 const tasks=tasksFor(state,DATA),q=$('#research-start-search').value.toLowerCase().trim(),selected=$('#research-start-item').value;
 const options=tasks.filter(t=>state.status[t.id].state==='todo'&&t.name.toLowerCase().includes(q));
 $('#research-start-item').innerHTML=options.length?options.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join(''):'<option value="">No matching unstarted research</option>';
 if(options.some(t=>String(t.id)===selected))$('#research-start-item').value=selected;
 renderResearchStartDetails();
}
function renderResearchStartDetails(){
 const value=$('#research-start-item').value,t=tasksFor(state,DATA).find(t=>String(t.id)===value);
 if(!t){$('#research-start-details').innerHTML='<p class="hint">Try another search or update the research board status.</p>';$('#record-research-start').disabled=true;return;}
 const why=blocked(t,state,tasksFor(state,DATA),Date.now(),$('#research-paid').checked);
 $('#research-start-details').innerHTML=`<p class="research-start-cost">${money(t.cost)} · ${t.power} power · ${researchDuration(t)}</p><p class="hint">${resourceText(t.res)}</p><p class="hint">${why.length?esc(why.join(' · ')):'Ready to record with your current settings.'}</p>`;
 $('#record-research-start').disabled=why.length>0;
}
function researchDuration(t){if(t.hours===0)return 'Instant';if(t.hours<1/60)return Math.round(t.hours*3600)+' seconds';const minutes=Math.round(t.hours*60);return (Math.floor(minutes/60)?Math.floor(minutes/60)+'h ':'')+(minutes%60?minutes%60+'m':'');}
function renderResearch(tasks){
 const query=$('#search').value.trim().toLowerCase(),category=$('#research-source').value;
 const visible=tasks.filter(t=>(filter==='all'||state.status[t.id].state===filter)&&(category==='all'||t.category===category)&&[t.name,...(t.aliases||[])].some(name=>name.toLowerCase().includes(query)));
 $('#research-list').innerHTML=visible.map(t=>{const st=state.status[t.id].state,why=blocked(t,state,tasks),completed=t.deps.filter(id=>state.status[id]?.state==='done').length;
 return `<article class="research-card ${st}" data-research-card="${t.id}"><div class="card-top"><span>${esc(t.category)} · ${t.power} RP</span><span class="badge ${st}">${{todo:'NOT STARTED',active:'IN PROGRESS',done:'COMPLETED'}[st]}</span></div><h3>${esc(t.name)}</h3><span class="cost">${money(t.cost)}</span><div class="research-res">${resourceText(t.res)}</div><p class="hint">Research time: ${researchDuration(t)}</p>${t.parent?`<p class="hint">Ammunition for ${esc(t.parent)}</p>`:''}<div class="card-actions">${st==='active'?researchTimerMarkup(t,Date.now(),false):''}${st==='todo'?`<button class="small-button" data-start="${t.id}" ${why.length?'disabled':''}>Record research started</button><p class="hint">${why.length?esc(why.join(' · ')):'Ready with your recorded stock'}</p>`:''}${t.deps.length?`<details class="catalog-prerequisites"><summary>${completed} / ${t.deps.length} prerequisites complete</summary><ul>${t.deps.map(id=>`<li class="${state.status[id]?.state==='done'?'requirement-done':''}"><span aria-hidden="true">${state.status[id]?.state==='done'?'✓':'○'}</span> ${esc(tasks.find(x=>x.id===id).name)}</li>`).join('')}</ul></details>`:''}<details><summary>Adjust recorded status</summary><label>Research status<select data-status="${t.id}"><option value="todo" ${st==='todo'?'selected':''}>Not started</option><option value="active" ${st==='active'?'selected':''}>In progress (timer from now)</option><option value="done" ${st==='done'?'selected':''}>Completed</option></select></label><p class="hint">Status correction only; stock and cash do not change. Use “Record research started” to deduct costs.</p></details></div></article>`;
 }).join('')||'<p class="muted">No matching research.</p>';
 $('#research-catalog-summary').textContent=`Showing ${visible.length} of ${tasks.length} research items. All items are included in planning.`;
}
const workspace=createSessionWorkspace({getState:()=>state,commit,data:DATA,date,money});
const setupResearch=createSetupResearch({getState:()=>state,commit,data:DATA});
$('#inventory').onsubmit=e=>{e.preventDefault();act(()=>({...clone(state),cash:input('stock-0'),res:[1,2,3,4].map(i=>input('stock-'+i)),snapshot:Date.now()}),'Current stock recorded. Your plan has been rebuilt.');};
$('#settings').onsubmit=e=>{e.preventDefault();act(()=>{const n=clone(state);for(const k of ['power','reserve','uptime','capacity','interval'])n[k]=input(k);n.timezone=$('#timezone').value.trim();if(!validTimezone(n.timezone))throw Error('Choose a valid timezone.');n.anchor=$('#anchor').value;if(n.anchor!==state.anchor)n.session.scheduled=zonedTimestamp(n.anchor,n.timezone);else if(n.timezone!==state.timezone&&n.session.scheduled!==null)n.anchor=calendarInput(n.session.scheduled,n.timezone);n.autoCapacity=$('#auto-capacity').checked;return n;},'Planning settings updated.');};$('#auto-capacity').onchange=()=>$('#capacity').disabled=$('#auto-capacity').checked;
$('#staff-form').onsubmit=e=>{e.preventDefault();act(()=>{const n=clone(state);$$('[data-area]').forEach(x=>n.staff[x.dataset.area][x.dataset.rank]=Number(x.value));$$('[data-unavailable]').forEach(x=>n.unavailable[x.dataset.unavailable]=Number(x.value));n.raid=$('#raid').value===''?null:input('raid');n.win=$('#win').value===''?null:input('win');let available=count(n,'Operations');n.assign=n.assign.map(x=>{const z=Math.min(x,available);available-=z;return z;});return n;},'Staffing saved. Check current power and raid readings after losses.');};
$('#allocation').onsubmit=e=>{e.preventDefault();act(()=>({...clone(state),assign:KEYS.map((_,i)=>input('assign-'+i))}),'Operations assignments saved.');};
$('#sale').onsubmit=e=>{e.preventDefault();act(()=>dispatch(state,Number($('#sale-resource').value),input('sale-qty'),DATA.wiki,Date.now(),$('#sale-reflected').checked),'Delivery recorded. Collect the payment after arrival.');};
$('#goal').onchange=()=>act(()=>({...clone(state),goal:$('#goal').value}));$('#target').onchange=()=>act(()=>({...clone(state),target:input('target')}));$('#goal-resource').onchange=()=>act(()=>({...clone(state),goalResource:Number($('#goal-resource').value)}));
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
if(b.hasAttribute('data-finish-session'))openFinishReview(Number(b.dataset.finishSession),b);
if(b.dataset.restoreHistory){const entry=state.history.find(x=>x.id===b.dataset.restoreHistory);if(entry)act(()=>restoreHistory(state,entry.id),'Restored the state before: '+entry.label);}
if(b.hasAttribute('data-edit-research-time')){const panel=b.closest('.research-running-item');panel.querySelector('.research-timer-editor').hidden=false;b.setAttribute('aria-expanded','true');panel.querySelector('[data-research-hours]').focus();}
if(b.hasAttribute('data-cancel-research-time')){const panel=b.closest('.research-running-item');panel.querySelector('.research-timer-editor').hidden=true;panel.querySelector('[data-edit-research-time]').setAttribute('aria-expanded','false');panel.querySelector('[data-edit-research-time]').focus();}
if(b.hasAttribute('data-save-research-time')){const panel=b.closest('.research-running-item'),id=Number(panel.dataset.researchId),hours=panel.querySelector('[data-research-hours]'),minutes=panel.querySelector('[data-research-minutes]');if(!hours.reportValidity()||!minutes.reportValidity())return;act(()=>{if(state.status[id]?.state!=='active')throw Error('This research is no longer active.');const n=clone(state);n.status[id].end=Date.now()+(Number(hours.value)*60+Number(minutes.value))*60000;return n;},'Research time updated. Your plan has been rebuilt.');}
if(b.hasAttribute('data-edit-delivery-time')){const panel=b.closest('.shipment');panel.querySelector('.delivery-timer-editor').hidden=false;b.setAttribute('aria-expanded','true');panel.querySelector('[data-timer-hours]').focus();}
if(b.hasAttribute('data-cancel-delivery-time')){const panel=b.closest('.shipment');panel.querySelector('.delivery-timer-editor').hidden=true;panel.querySelector('[data-edit-delivery-time]').setAttribute('aria-expanded','false');panel.querySelector('[data-edit-delivery-time]').focus();}
if(b.hasAttribute('data-save-delivery-time')){const panel=b.closest('.shipment'),hours=panel.querySelector('[data-timer-hours]'),minutes=panel.querySelector('[data-timer-minutes]');if(!hours.reportValidity()||!minutes.reportValidity())return;act(()=>{const n=clone(state),ship=n.ships.find(x=>x.id===panel.dataset.deliveryId);if(!ship)throw Error('No active delivery to edit.');ship.end=Date.now()+(Number(hours.value)*60+Number(minutes.value))*60000;return n;},'Delivery time updated. Your plan has been rebuilt.');}
if(b.id==='edit-cash'){$('#cash-editor').hidden=false;b.setAttribute('aria-expanded','true');$('#current-cash').focus();$('#current-cash').select();}if(b.id==='cancel-cash'){$('#cash-editor').hidden=true;$('#edit-cash').setAttribute('aria-expanded','false');$('#edit-cash').focus();}if(b.dataset.start!==undefined)act(()=>start(state,Number(b.dataset.start),tasksFor(state,DATA)),'Research started and its cost deducted once.');if(b.dataset.complete!==undefined)act(()=>{const n=clone(state);n.status[b.dataset.complete]={state:'done'};return n;},'Research completion recorded.');if(b.hasAttribute('data-collect'))act(()=>collect(state,Date.now(),b.closest('.shipment').dataset.deliveryId),'Delivery payment added. Staff are available again.');if(b.dataset.filter){filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderResearch(tasksFor(state,DATA));}});
document.addEventListener('change',e=>{if(e.target.dataset.catalogIndex!==undefined){const index=Number(e.target.dataset.catalogIndex);act(()=>{const n=clone(state);n.legacy[index]=e.target.checked;return n;},'Research completion updated. Balances kept as recorded.');}if(e.target.dataset.status!==undefined){const id=Number(e.target.dataset.status);act(()=>{const n=clone(state),t=tasksFor(state,DATA).find(t=>t.id===id);n.status[id]={state:e.target.value,...(e.target.value==='active'?{end:Date.now()+t.hours*3600000}:{})};return n;},'Status corrected. Balances were kept as recorded.');}if(e.target.dataset.legacy!==undefined)act(()=>{const n=clone(state);n.legacy[e.target.dataset.legacy]=e.target.checked;return n;});});
$('#research-start-search').oninput=renderResearchPicker;$('#research-start-item').onchange=renderResearchStartDetails;$('#research-paid').onchange=renderResearchStartDetails;
$('#start-research').onsubmit=e=>{e.preventDefault();const paid=$('#research-paid').checked;act(()=>{const value=$('#research-start-item').value;if(value==='')throw Error('Choose a research item first.');return start(state,Number(value),tasksFor(state,DATA),Date.now(),paid);},paid?'Research started. Recorded balances kept as entered.':'Research started. Its cost was deducted once.');};
$('#search').oninput=()=>renderResearch(tasksFor(state,DATA));$('#research-source').onchange=()=>renderResearch(tasksFor(state,DATA));$('#show-all').onclick=()=>{full=!full;render();};
$('#undo').onclick=()=>{const entry=state.history?.at(-1);if(entry)act(()=>restoreHistory(state,entry.id),'Restored the state before: '+entry.label);};
$('#export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.href=url;a.download='brm5-hq-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#theme').value=window.HQTheme.get();$('#theme').onchange=()=>window.HQTheme.set($('#theme').value);
$('#import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Backup is too large.');const n=validate(JSON.parse(await file.text()));commit(n,'Backup restored.');}catch(e){toast(e.message);}e.target.value='';};
document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>{$$('nav a').forEach(x=>x.classList.toggle('active',x===a));});
// Recompute the date and elapsed timers each minute without overwriting unsaved form inputs.
setInterval(()=>{const editing=['INPUT','SELECT'].includes(document.activeElement?.tagName);if(!editing&&!$('#finish-session-dialog').open)render();else updateVisitCountdowns();},60000);
render();


document.addEventListener('submit',e=>{if(e.target.id!=='cash-editor')return;e.preventDefault();act(()=>({...clone(state),cash:input('current-cash')}),'Cash balance updated. Your plan has been rebuilt.');});

window.addEventListener('storage',e=>{if(e.key===persistence.key&&e.newValue){try{const next=persistence.receiveStorage(e.newValue);if(!['INPUT','SELECT'].includes(document.activeElement?.tagName)){state=next;render();}else toast('Progress changed in another tab. Review the latest values before saving.');}catch{}}});

document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateVisitCountdowns();});

// Keep guide preferences separate from HQ progress and backups.
const guide=$('#setup-guide'),guideKey='brm5-public-guide-open';let guidePreference=null;
try{guidePreference=localStorage.getItem(guideKey);guide.open=guidePreference===null?!state.setupComplete:guidePreference==='true';}catch{guide.open=true;}
guide.addEventListener('toggle',()=>{try{localStorage.setItem(guideKey,String(guide.open));}catch{}});
$('#guide-close').onclick=()=>{guide.open=false;guide.querySelector('summary').focus();};
document.querySelector('nav a[href="#guide"]').addEventListener('click',()=>{guide.open=true;});
if(location.hash==='#guide'&&guidePreference!=='false')guide.open=true;

$('#guide-export').onclick=()=>$('#export').click();
$('#guide-import').onclick=()=>$('#import').click();

$('#finish-setup').onclick=()=>act(()=>{const n=clone(state);if(n.power<=0||metrics(n,DATA.wiki).capacity<=0||nextVisit(n)===null)throw Error('Save your research power, storage and first visit in Planning settings before finishing setup.');n.setupComplete=true;return n;},'Setup complete. Your first session is ready.');
accountUI=createAccountUI({persistence,getState:()=>state,toast});accountUI.render();
persistence.init().catch(error=>toast(error.message));
window.addEventListener('online',()=>persistence.refresh());
window.addEventListener('focus',()=>persistence.refresh());
setInterval(()=>{if(!document.hidden)persistence.refresh();},30000);
window.addEventListener('beforeunload',event=>{if(persistence.pending){event.preventDefault();event.returnValue='';}});
