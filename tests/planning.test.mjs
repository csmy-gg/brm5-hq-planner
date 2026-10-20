import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA} from '../src/full-data.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {validateProfile} from '../src/profile.js';
import {forecast,goalIds} from '../src/engine.js';
import {assertForecastValid} from './forecast-assertions.mjs';
import {plannedStartText,plannedDeliveryText} from '../src/forecast-ui.js';
const now=Date.UTC(2026,9,20,10),hour=3600000;
function profile(goal='139'){
 const s=createEmptyProfile(DATA.tasks,{now,timezone:'Europe/Prague'});
 Object.assign(s,{goal,cash:100000,power:191,capacity:500,autoCapacity:false,setupComplete:true,anchor:'2026-10-20T12:00'});
 s.session.scheduled=now;s.staff.Operations={'S++':8};s.staff.Delivery={'S++':6};s.staff.Logistics={'S++':8,'S+':1};return s;
}
test('zero-stock Cobra completes without the old CM target deadlock',()=>{
 const s=profile('137'),original=structuredClone(s),plan=forecast(s,DATA,now);assert(plan.finished);assert(plan.finish-now<=204*hour);assert(plan.rows.some(row=>row.starts.includes(100)));assertForecastValid(s,plan);assert.deepEqual(s,original);assert.equal(plan.comparedPlans,5);
});
test('one worker can fill the final two storage slots instead of being rounded down to zero',()=>{
 const s=profile('12');for(const t of DATA.tasks)s.status[t.id]={state:'done'};s.status[12]={state:'todo'};s.res=[498,0,0,0];
 const plan=forecast(s,DATA,now);assert(plan.finished);assert.equal(plan.rows[0].productionBuffer.base[3],1);assert.equal(plan.rows[0].assign[3],8);assert(plan.finish-now<=24*hour);assertForecastValid(s,plan);
});
test('goal-specific scheduling starts the long Skirmisher prerequisite early',()=>{
 const s=profile('139'),required=goalIds(s,DATA.tasks),pending=[5,156,159,1,22,8,158,17,139];
 for(const t of DATA.tasks)s.status[t.id]={state:required.has(t.id)?'done':'todo'};for(const id of pending)s.status[id]={state:'todo'};s.res=[4,0,0,12];
 const plan=forecast(s,DATA,now);assert(plan.finished);assert(plan.rows[0].starts.includes(5));assert(plan.finish-now<=24*hour+60000);assertForecastValid(s,plan);
});
test('short prerequisite chains run in the same visit without skipping a dependency',()=>{
 const s=profile('110');s.res=[50,0,65,15];const plan=forecast(s,DATA,now);
 assert(plan.finished);assert.equal(plan.finish-now,45000);assert.deepEqual(plan.rows[0].starts,[100,101,108,110]);assert.equal(plan.rows.length,1);assertForecastValid(s,plan);
 s.visitMinutes=0;const immediate=forecast(s,DATA,now);assert.equal(immediate.finish-now,48*hour);assertForecastValid(s,immediate);
});
test('visit length respects the exact boundary and active timers can unlock follow-ups inside it',()=>{
 const s=profile('110');s.res=[10,0,5,5];s.status[100]={state:'done'};s.status[101]={state:'active',end:now+50000};s.visitMinutes=1;
 const plan=forecast(s,DATA,now);assert(plan.rows[0].starts.includes(108));assert(plan.rows[0].starts.includes(110));assert.equal(plan.rows[0].researchSteps.find(x=>x.id===110).at,now+60000);assertForecastValid(s,plan);
 s.status[101].end=now+60001;const late=forecast(s,DATA,now);assert(!late.rows[0].starts.includes(108));assertForecastValid(s,late);
});
test('old backups gain a visit-time assumption without moving any deadline; malformed values are rejected',()=>{
 const s=profile();delete s.visitMinutes;s.status[100]={state:'active',end:now+12345};const migrated=validateProfile(s);assert.equal(migrated.visitMinutes,5);assert.deepEqual(migrated.status,s.status);assert.deepEqual(migrated.session,s.session);
 for(const value of [-1,121,1.5,'5',null])assert.throws(()=>validateProfile({...s,visitMinutes:value}));
});
test('cash goals can sell surplus precious metals and never spend pending income prematurely',()=>{
 const s=profile('cash');s.cash=0;s.target=1000;s.res=[0,10,0,0];const plan=forecast(s,DATA,now);assert.equal(plan.rows[0].delivery.resource,1);assert.equal(plan.rows[0].delivery.quantity,2);assert.equal(plan.rows[0].after.cash,0);assert(plan.finished);assertForecastValid(s,plan);
 assert.equal(plannedDeliveryText(plan.rows[0],n=>'$'+n),'2 PM → $1500');
});
test('a full warehouse can send unneeded CM to make room for goal resources',()=>{
 const s=profile('resource');s.target=2;s.goalResource=3;s.res=[500,0,0,0];const plan=forecast(s,DATA,now);assert(plan.finished);assert.equal(plan.rows[0].delivery.resource,0);assert.equal(plan.rows[0].delivery.quantity,2);assert(plan.rows[0].assign[3]>0);assertForecastValid(s,plan);
});
test('reserve, depleted power and zero staff stay binding during same-visit planning',()=>{
 const s=profile('110');s.res=[50,0,65,15];s.reserve=s.cash;const reserve=forecast(s,DATA,now,3);assert(!reserve.rows[0].starts.length);assertForecastValid(s,reserve);
 s.reserve=0;s.power=0;const power=forecast(s,DATA,now,3);assert(power.rows.every(row=>!row.starts.length));assertForecastValid(s,power);
 s.staff.Operations={};s.res=[3000,0,0,0];s.staff.Delivery={};const stalled=forecast(s,DATA,now,3);assert(stalled.rows.every(row=>row.after.res[0]===3000&&row.assign.every(n=>n===0)));assertForecastValid(s,stalled);
});
test('all product goals finish from representative low-stock HQs and every planned action replays safely',()=>{
 for(const task of DATA.tasks.filter(t=>t.category==='Products')){
  const s=profile(String(task.id));s.cash=25271;s.res=[30,2,90,10];s.reserve=5000;const plan=forecast(s,DATA,now);assert(plan.finished,task.name);assertForecastValid(s,plan);
 }
});
test('step labels distinguish immediate work, short follow-ups and non-Fuel deliveries',()=>{
 assert.equal(plannedStartText({at:now},now),'Start when ready.');assert.match(plannedStartText({at:now+25000},now),/25s/);assert.match(plannedStartText({at:now+65000},now),/1m 5s/);assert.equal(plannedDeliveryText({delivery:{resource:0,quantity:2,value:200}},n=>'$'+n),'2 CM → $200');
});
