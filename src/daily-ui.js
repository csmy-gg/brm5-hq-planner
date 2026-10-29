import {tasksFor,researchPowerUsed,followingVisit} from './engine.js';
import {goalProgress} from './research-view.js';
import {resourceNames,resourceShort} from './resource-ui.js';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dailySummary(s,data,forecast,now=Date.now(),current=true){
 const tasks=tasksFor(s,data),row=forecast?.rows[0],readyShips=s.ships.filter(t=>t.end<=now),completed=tasks.filter(t=>s.status[t.id]?.state==='active'&&s.status[t.id].end<=now),events=[];
 for(const ship of s.ships)events.push({at:ship.end,label:ship.quantity+' '+resourceNames[ship.resource]+' delivery',section:'deliveries',due:ship.end<=now});
 for(const task of tasks)if(s.status[task.id]?.state==='active')events.push({at:s.status[task.id].end,label:task.name,section:'research',due:s.status[task.id].end<=now});
 const next=followingVisit(s,now);if(next!==null)events.push({at:next,label:'Next planned visit',section:'balances'});
 if(current&&row?.storageFullAt!=null)events.push({at:row.storageFullAt,label:'Storage may fill',section:'balances',estimate:true});
 events.sort((a,b)=>a.at-b.at||a.label.localeCompare(b.label));
 return {readyShips:readyShips.length,completed:completed.length,starts:current?(row?.starts.length||0):null,changedAssignments:current&&Boolean(row)&&row.assign.some((n,i)=>n!==s.assign[i]),assign:row?.assign,events:events.slice(0,5),progress:goalProgress(s,tasks),freePower:Math.max(0,s.power-researchPowerUsed(s,tasks,now))};
}

export function createDailyUI({getState,data,getForecastView,date,money,onCheckIn,onAdvanced}){
 const $=s=>document.querySelector(s),host=document.createElement('div');host.id='daily-home';host.className='easy-only';$('#today .hero').after(host);
 const balanceHost=document.createElement('section');balanceHost.id='daily-balances';balanceHost.className='daily-balances panel';balanceHost.innerHTML='<div class="daily-card-heading"><div><h3>Recorded balances</h3><p class="muted" id="daily-recorded-at"></p></div></div><div id="daily-stock-slot"></div><p class="daily-capacity" id="daily-capacity"></p>';host.before(balanceHost);
 const inventory=$('#inventory'),stockHome=inventory.parentElement,stockNext=inventory.nextSibling;const balanceLink=document.createElement('p');balanceLink.className='easy-only';balanceLink.innerHTML='<a class="button ghost" href="#daily-balances">Edit balances in Current Session</a>';inventory.before(balanceLink);
 function placeInventory(){const easy=document.documentElement.dataset.uiMode==='easy';balanceHost.hidden=!easy;if(easy){if(inventory.parentElement!==$('#daily-stock-slot'))$('#daily-stock-slot').append(inventory);}else if(inventory.parentElement!==stockHome)stockHome.insertBefore(inventory,stockNext);const names=easy?['Cash (USD)','Construction M.','Precious M.','Fuel','Equipment']:['Cash (USD)',...resourceNames];[...inventory.querySelectorAll('#inventory-fields label')].forEach((label,i)=>{const text=[...label.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=names[i];});}

 const summary=document.createElement('div');summary.id='easy-goal-summary';summary.className='easy-only';$('#eta').after(summary);
 const planGate=document.createElement('div');planGate.className='easy-only advanced-gate';planGate.innerHTML='<h3>Detailed session forecast</h3><p>Switch to Advanced mode in Appearance to see the full forecast and planning details.</p><button class="ghost" type="button" data-daily-advanced>Open Appearance settings</button>';$('#plan').prepend(planGate);
 const recent=document.createElement('details');recent.className='easy-only recent-changes';recent.innerHTML='<summary>Recent changes &amp; Undo</summary><div id="easy-recent-list"></div><button type="button" class="ghost" data-daily-undo>Undo latest change</button> <a href="#history">View action history</a>';$('#staff').after(recent);
 const department=document.createElement('label');department.className='easy-only department-picker';department.innerHTML='Department<select id="easy-department">'+['Operations','Delivery','Logistics','Defense','Infirmary','Training'].map(n=>`<option>${n}</option>`).join('')+'</select>';$('#staff-form').prepend(department);
 const nav=[...document.querySelectorAll('.sidebar nav a')].map(el=>({el,html:el.innerHTML}));
 let selectedDepartment='Operations',lastMode;
 department.querySelector('select').onchange=event=>{selectedDepartment=event.target.value;staffLayout();};
 function staffLayout(){const rows=[...$('#staff-table').querySelectorAll('tbody tr')],headers=[...$('#staff-table').querySelectorAll('thead th')].map(x=>x.textContent);for(const row of rows){row.classList.toggle('selected-department',row.cells[0].textContent===selectedDepartment);[...row.cells].forEach((cell,i)=>cell.dataset.label=headers[i]||'');}}
 function route(scroll=false){const target=location.hash.slice(1);document.documentElement.dataset.easyTarget=target;if(scroll&&document.documentElement.dataset.uiMode==='easy'&&['plan','history'].includes(target))document.getElementById(target)?.scrollIntoView({block:'start'});}
 function syncMode(){const easy=document.documentElement.dataset.uiMode==='easy';if(lastMode!==easy){const order=easy?['#today','#stock','#research']:nav.map(n=>n.el.getAttribute('href'));for(const href of order){const entry=nav.find(n=>n.el.getAttribute('href')===href);if(entry)entry.el.parentElement.append(entry.el);}lastMode=easy;}for(const {el,html}of nav){el.innerHTML=html;const href=el.getAttribute('href');if(easy&&['#today','#research','#stock'].includes(href))el.innerHTML=({'#today':'◈ Current Session','#research':'⌘ Research','#stock':'▦ My HQ'})[href];el.classList.toggle('easy-nav-secondary',easy&&!['#today','#research','#stock'].includes(href));}
  $('#finish-session-top').textContent=easy?'Open session check-in':'Mark session as completed';$('#stock .section-heading h2').textContent=easy?'My HQ':'Resources & money';route();staffLayout();placeInventory();
 }
 function sync(){
  const s=getState(),view=getForecastView(),now=Date.now(),d=dailySummary(s,data,view.result,now,view.current),p=d.progress;
  $('#easy-goal-summary').innerHTML=`<progress max="100" value="${p.percent}" aria-label="Goal progress"></progress><p>${p.kind==='research'?`${p.done} / ${p.total} completed · ${p.active} in progress`:`${p.current.toLocaleString()} / ${p.target.toLocaleString()}`}</p>`;
  $('#daily-recorded-at').textContent='Recorded '+date(s.snapshot,true);$('#daily-capacity').textContent=d.freePower+' / '+s.power+' research power free · '+Math.floor(s.res.reduce((a,b)=>a+b,0))+' / '+(view.result?.metrics.capacity??(s.autoCapacity?'—':s.capacity))+' storage used';
  const checks=[];
  if(!s.setupComplete)checks.push({title:'Finish setting up your HQ',text:'Copy your in-game totals, staff, research and schedule.',link:'#guide'});
  else{
   if(d.readyShips)checks.push({title:`Collect ${d.readyShips} ready ${d.readyShips===1?'delivery':'deliveries'}`,text:'Record payments after collecting them in BRM5.',section:'deliveries'});
   if(d.completed)checks.push({title:`Confirm ${d.completed} finished research ${d.completed===1?'item':'items'}`,text:'Record completion to unlock the next prerequisites.',section:'research'});
   if(d.starts)checks.push({title:`${d.starts} research ${d.starts===1?'start':'starts'} planned`,text:'Follow the order in your check-in, including short follow-ups.',section:'research'});
   if(d.changedAssignments)checks.push({title:'Operations suggestion not yet recorded',text:`Recorded: ${s.assign.join(' / ')}. Suggested: ${d.assign.join(' / ')}. CM / PM / Fuel / Equipment.`,section:'ops'});
  }
  const warnings=[...document.querySelectorAll('#attention .attention-item:not(.good)')].map(e=>e.outerHTML).join('');
  host.innerHTML=`<div class="daily-warnings">${warnings}</div><div class="daily-columns"><section class="panel daily-attention"><h3>What needs attention</h3><p class="plan-calculation">${view.pending?'Updating plan…':view.error?'Plan unavailable. Your recorded HQ is safe.':''}</p>${checks.map(x=>`<article><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p>${x.link?`<a class="button ghost" href="${x.link}">Open setup guide</a>`:`<button type="button" class="small-button" data-daily-checkin="${x.section}">Review in check-in</button>`}</article>`).join('')||'<p class="muted">Nothing needs recording right now. Check your HQ at the next visit.</p>'}</section><section class="panel daily-upcoming"><h3>Coming up</h3><p class="muted">Timers show when to check the game, not actions already completed.</p>${d.events.map(e=>`<article><div><strong>${esc(e.label)}</strong><span>${e.due?'Ready · record in-game result':date(e.at,true)}${e.estimate?' · estimate':''}</span></div><button type="button" class="ghost" data-daily-checkin="${e.section}" aria-label="Review ${esc(e.label)}">Review</button></article>`).join('')||'<p class="muted">No active timers. Record ongoing research or deliveries in My HQ.</p>'}</section></div>`;
  host.querySelectorAll('[data-daily-checkin]').forEach(b=>{b.disabled=!s.setupComplete;b.onclick=()=>onCheckIn(b.dataset.dailyCheckin,b);});
  $('#easy-recent-list').innerHTML=s.history.slice(-3).reverse().map(e=>`<p><strong>${esc(e.label)}</strong><small>${date(e.at,true)}</small></p>`).join('')||'<p>No saved changes yet.</p>';recent.querySelector('button').disabled=!s.history.length;syncMode();
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-daily-undo]'))$('#undo').click();if(e.target.closest('[data-daily-advanced]'))onAdvanced();});
 window.addEventListener('hashchange',()=>route(true));
 return {sync,syncMode};
}
