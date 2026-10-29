import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA} from '../src/full-data.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {researchPowerUsed,blocked,start,goalIds,forecast} from '../src/engine.js';
import {applySessionAction} from '../src/session-actions.js';
import {visibleResearch} from '../src/research-view.js';
import {researchCountdown} from '../src/research-timing.js';
const now=Date.UTC(2026,9,19,12),surface=14,internal=13,dimensional=12;
function fixture(){const s=createEmptyProfile(DATA.tasks,{now});s.power=40;s.cash=10000;s.res=[100,100,100,100];for(const t of DATA.tasks)s.status[t.id]={state:'done'};for(const id of [surface,internal,dimensional])s.status[id]={state:'todo'};return s;}

test('System Integration occupies power for 24 hours and cannot finish within its starting visit',()=>{
 const task=DATA.tasks.find(t=>t.name==='System Integration'),day=24*3600000;
 const s=fixture();for(const t of DATA.tasks)s.status[t.id]={state:'done'};
 s.status[task.id]={state:'todo'};s.power=191;s.goal=String(task.id);s.setupComplete=true;
 s.anchor='2026-10-19T14:00';s.session.scheduled=now;s.capacity=500;s.autoCapacity=false;
 const active=start(s,task.id,DATA.tasks,now);
 assert.equal(active.status[task.id].end,now+day);
 assert.equal(researchPowerUsed(active,DATA.tasks,now+day-1),task.power);
 assert.equal(researchPowerUsed(active,DATA.tasks,now+day),0);
 const plan=forecast(s,DATA,now);
 assert.equal(plan.finished,true);assert.equal(plan.finish,now+day);
 assert(plan.rows[0].starts.includes(task.id));assert(!plan.rows[0].completes.includes(task.id));
});

test('two five-second research timers release power at their exact deadlines without claiming completion',()=>{
 let s=fixture();s=start(s,surface,DATA.tasks,now);s=start(s,internal,DATA.tasks,now+1000);
 const original=structuredClone(s);
 assert.equal(s.status[surface].end,now+5000);
 assert.equal(s.status[internal].end,now+6000);
 for(const [offset,used,eligible] of [[0,4,false],[4999,4,false],[5000,2,false],[5999,2,false],[6000,0,true]]){
  assert.equal(researchPowerUsed(s,DATA.tasks,now+offset),used);
  assert.equal(blocked(DATA.tasks.find(t=>t.id===dimensional),s,DATA.tasks,now+offset).includes('Not enough free research power'),!eligible);
  assert.equal(visibleResearch(DATA.tasks,s,{filter:'ready'},now+offset).some(t=>t.id===dimensional),eligible);
 }
 assert.deepEqual(s,original);
 const next=applySessionAction(s,{type:'research-start',id:dimensional},DATA,now+6000);
 assert.equal(researchPowerUsed(next,DATA.tasks,now+6000),40);
 assert.equal(next.cash,s.cash-500);assert.equal(next.res[3],s.res[3]-2);
 assert.equal(next.status[surface].state,'active');assert.equal(next.status[internal].state,'active');
 assert.throws(()=>applySessionAction(next,{type:'research-start',id:dimensional},DATA,now+6001),/Already started/);
 const confirmed=applySessionAction(next,{type:'research-complete',id:surface},DATA,now+6002);
 assert.equal(researchPowerUsed(confirmed,DATA.tasks,now+6002),40);assert.equal(confirmed.cash,next.cash);
});

test('elapsed power does not bypass cash, reserve, resources or unconfirmed prerequisites',()=>{
 const s=start(fixture(),surface,DATA.tasks,now),task={...DATA.tasks.find(t=>t.id===dimensional),deps:[surface]};
 assert(blocked(task,s,DATA.tasks,now+5000).includes('Complete prerequisites first'));
 s.cash=499;s.res[3]=0;
 const reasons=blocked(task,s,DATA.tasks,now+5000);
 assert(reasons.includes('Cash would fall below your reserve'));assert(reasons.some(x=>x.includes('Equipment')));
 assert(!reasons.includes('Not enough free research power'));
});

test('editing remaining time restores power use, while an elapsed item cannot be purchased again',()=>{
 const s=start(fixture(),surface,DATA.tasks,now);
 assert.equal(researchPowerUsed(s,DATA.tasks,now+5000),0);
 const edited=applySessionAction(s,{type:'timer',kind:'research',id:surface,hours:0,minutes:1},DATA,now+5000);
 assert.equal(researchPowerUsed(edited,DATA.tasks,now+5000),2);
 assert.throws(()=>start(s,surface,DATA.tasks,now+5000),/Already started/);
});

test('countdown shows seconds for short timers and elapsed power release at the deadline',()=>{
 assert.equal(researchCountdown(now+5000,now),'5s remaining');
 assert.equal(researchCountdown(now+5000,now+4999),'1s remaining');
 assert.match(researchCountdown(now+5000,now+5000),/power released/);
 assert.equal(researchCountdown(now+60000,now),'0h 01m remaining');
});

test('Skirmisher-only forecasts exclude optional tier III research; ammo goals include the extra requirements',()=>{
 const s=fixture();s.goal='139';s.setupComplete=true;s.anchor='2026-10-19T14:00';s.session.scheduled=now;s.capacity=500;s.autoCapacity=false;
 for(const t of DATA.tasks)s.status[t.id]={state:'todo'};
 const skirmisher=goalIds(s,DATA.tasks),optional=DATA.tasks.filter(t=>t.category!=='Products'&&!skirmisher.has(t.id));
 assert.equal(optional.length,6);assert(optional.some(t=>t.id===23));
 const plan=forecast(s,DATA,now);assert(plan.rows.length);
 for(const row of plan.rows)assert(row.starts.every(id=>skirmisher.has(id)));
 for(const id of [142,143,144]){
  const task=DATA.tasks.find(t=>t.id===id),required=goalIds({...s,goal:String(id)},DATA.tasks);
  assert(required.has(139));for(const t of optional){assert(task.deps.includes(t.id));assert(required.has(t.id));}
  assert(task.deps.includes(31));assert(task.deps.includes(145));
  for(let science=149;science<=159;science++)assert(!task.deps.includes(science));
 }
});
