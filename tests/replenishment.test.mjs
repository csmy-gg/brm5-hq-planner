import test from 'node:test';
import assert from 'node:assert/strict';
import {planDispatch,productionPlan,chooseDelivery,researchPlanner} from '../src/planning.js';
import {forecast,metrics,projectStock} from '../src/engine.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {replenishmentText} from '../src/forecast-ui.js';
import {DATA} from '../src/full-data.js';
import {assertForecastValid} from './forecast-assertions.mjs';
const now=Date.UTC(2026,9,20,15),hour=3600000;
const task={id:1,name:'Research goal',deps:[],res:[30,7,60,19],cost:30000,power:10,hours:1};
function fixture(){const s=createEmptyProfile([task],{now,timezone:'Europe/Prague'});Object.assign(s,{goal:'1',cash:13433,res:[30,7,28,19],capacity:179,autoCapacity:false,interval:24,uptime:90,raid:56,win:86,reserve:5000,power:191,setupComplete:true,anchor:'2026-10-20T17:00'});s.session.scheduled=now;s.staff.Operations={'S++':8};s.staff.Delivery={'S++':6};return s;}
function plan(s,{tasks=[task],hours=s.interval,capacity=180}={}){const m=metrics(s,DATA.wiki),rank=researchPlanner(tasks,new Set(tasks.map(t=>t.id))).ranks(s,now);return planDispatch(s,tasks,m,DATA.wiki,rank,'critical',capacity,hours);}
function stressStock(s,result,hours=s.interval){const assign=result.allocation.assign,loss=Math.ceil(assign.reduce((a,b)=>a+b,0)/2),res=s.res.map((n,i)=>n-(i===result.sale?.resource?result.sale.quantity:0));return assign.map((_,i)=>projectStock({...s,res,assign:assign.map((n,j)=>Math.max(0,n-(i===j?loss:0)))},now+hours*hour,metrics(s,DATA.wiki)).res[i]);}

test('28 Fuel can be sold and replenished for research with four of eight workers unavailable',()=>{
 const s=fixture(),before=structuredClone(s),result=plan(s);
 assert.equal(result.sale.quantity,28);assert.equal(result.sale.value,4200);assert.deepEqual(result.allocation.assign,[0,0,8,0]);
 assert.equal(result.sale.replenishment.workerLoss,4);assert.equal(result.sale.replenishment.protectedFuel,60);
 assert(Math.abs(stressStock(s,result)[2]-110.88)<1e-6);assert.deepEqual(s,before);
 const initial=productionPlan(s,[task],metrics(s,DATA.wiki),DATA.wiki,new Map(),'critical');assert.equal(chooseDelivery(s,initial,180,DATA.wiki),null);
});

test('shorter production windows reduce the sale or retain all Fuel',()=>{
 const s=fixture();assert.equal(plan(s,{hours:12}).sale.quantity,23);assert.equal(plan(s,{hours:6}).sale,null);
 assert.equal(plan(s,{hours:0}).sale,null);assert.equal(plan(s,{hours:12-1/60}).sale.quantity,23);
});

test('large research requirements, unavailable staff and full storage prevent overselling',()=>{
 const s=fixture(),large={...task,res:[30,7,500,19]},limited=plan(s,{tasks:[large]});assert.equal(limited.sale.quantity,15);assert(stressStock(s,limited)[2]>=123-1e-7);
 s.unavailable.Operations=3;const reduced=plan(s);assert.equal(reduced.sale.quantity,23);assert.equal(reduced.sale.replenishment.workerLoss,3);assert(stressStock(s,reduced)[2]>=60);
 s.unavailable.Operations=8;assert.equal(plan(s).sale,null);
 s.unavailable.Operations=0;s.res[0]=3000;assert.equal(plan(s).sale.resource,0);assert.equal(s.res[0],3000);
});

test('replacement estimates respect uptime, delivery capacity and the conservative staffing choice',()=>{
 const s=fixture();assert.equal(plan(s,{capacity:10}).sale.quantity,10);assert.equal(plan(s,{capacity:0}).sale,null);
 s.uptime=0;assert.equal(plan(s).sale,null);s.uptime=90;s.productionBuffer='minimum';assert.equal(plan(s).sale,null);
 s.productionBuffer='auto';s.ships=[{value:100000}];assert.equal(plan(s).sale,null);
 s.goal='resource';s.goalResource=2;s.target=100;assert.equal(plan(s).sale,null);
});

test('mixed-resource replacement never crowds out the baseline protected research stock',()=>{
 let checked=0;
 for(const capacity of [95,179,500])for(const res of [[30,7,28,19],[0,0,28,0],[0,0,100,0],[30,4,28,12]]){
  const s=fixture();s.capacity=capacity;s.res=res;const tasks=[{...task,res:[30,5,60,12]}],result=plan(s,{tasks});
  if(!result.sale?.replenishment)continue;
  checked++;
  const baseline=plan(s,{tasks,capacity:0}),baseStock=stressStock(s,baseline),stock=stressStock(s,result);
  stock.forEach((n,i)=>assert(n+1e-7>=Math.min(baseStock[i],tasks[0].res[i])));
 }
 assert(checked>0,'Exercise an actual replacement sale alongside other resource production');
});

test('whole-unit rounding preserves a requirement just above the replacement limit',()=>{
 const s=fixture(),tasks=[{...task,res:[30,7,111,19]}],result=plan(s,{tasks});assert.equal(result.sale.quantity,27);assert(stressStock(s,result)[2]>=111);
});

test('forecast dispatch and collection replay once without spending the pending $4200',()=>{
 const s=fixture(),data={tasks:[task],wiki:DATA.wiki},result=forecast(s,data,now);
 assert(result.finished);assert.equal(result.rows[0].delivery.quantity,28);assert.equal(result.rows[0].after.cash,13433);
 assert.equal(result.rows[0].after.res[2],0);assert(result.rows[1].collected>=4200);assertForecastValid(s,result,data);
});

test('a late current visit uses the actual time left before the next scheduled visit',()=>{
 const s=fixture(),result=forecast(s,{tasks:[task],wiki:DATA.wiki},now+18*hour,1);
 assert.equal(result.rows[0].delivery,null);assert.equal(result.rows[0].time,now+18*hour);
});

test('replacement explanation labels the staff-loss assumption and retains its limits',()=>{
 const text=replenishmentText(plan(fixture()).sale);assert.match(text,/110 Fuel/);assert.match(text,/4 assigned Operations staff unavailable from the start/);assert.match(text,/Protects 60 Fuel/);assert.match(text,/larger losses/);assert.equal(replenishmentText(null),'');
});
