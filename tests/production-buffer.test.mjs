import test from 'node:test';
import assert from 'node:assert/strict';
import {planAssignments,chooseAssignments} from '../src/planning.js';
import {projectStock,metrics,forecast} from '../src/engine.js';
import {productionBufferText} from '../src/forecast-ui.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {validateProfile} from '../src/profile.js';
import {DATA} from '../src/full-data.js';
const now=Date.UTC(2026,9,20,15),rates=[30.8,2.2,30.8,4.5];
function fixture(){const s=createEmptyProfile(DATA.tasks,{now,timezone:'Europe/Prague'});Object.assign(s,{cash:13433,res:[30,7,28,19],capacity:179,autoCapacity:false,interval:24,uptime:90,raid:56,win:86,goal:'cash',target:200000,setupComplete:true,anchor:'2026-10-20T17:00'});s.session.scheduled=now;s.staff.Operations={'S++':8};s.staff.Delivery={'S++':6};return s;}
const fuelPlan={primary:[0,0,10000,0],secondary:[0,0,10000,0]};
const output=(s,assign,m)=>projectStock({...s,assign},now+s.interval*3600000,m).res;
test('the 179-storage HQ gets eight Fuel workers instead of four while retaining its storage cap',()=>{
 const s=fixture(),m=metrics(s,DATA.wiki),result=planAssignments(s,fuelPlan,m);
 assert.deepEqual(result.buffer.base,[0,0,4,0]);assert.deepEqual(result.assign,[0,0,8,0]);assert.equal(result.buffer.extra,4);
 assert.deepEqual(output(s,result.assign,m),[30,7,123,19]);assert.deepEqual(output(s,result.assign,m),output(s,result.buffer.base,m));
 assert(Math.abs(result.buffer.minimumHours-20.56277056277056)<1e-6);assert(Math.abs(result.buffer.bufferedHours-10.28138528138528)<1e-6);
});
test('four unavailable workers cannot erase all Fuel production when eight were assigned',()=>{
 const s=fixture(),m=metrics(s,DATA.wiki),result=planAssignments(s,fuelPlan,m);
 for(const raidHour of [0,6,12,18]){
  const afterRaid=projectStock({...s,assign:result.assign},now+raidHour*3600000,m);
  const final=projectStock({...s,res:afterRaid.res,snapshot:now+raidHour*3600000,assign:[0,0,4,0]},now+24*3600000,m);
  assert.deepEqual(final.res,[30,7,123,19]);
 }
 assert.deepEqual(output(s,[0,0,0,0],m),s.res); // No promise if every assigned worker is disabled.
});
test('minimum mode and confirmed absence of risk retain the minimum allocation',()=>{
 const s=fixture(),m=metrics(s,DATA.wiki);s.productionBuffer='minimum';assert.deepEqual(planAssignments(s,fuelPlan,m).assign,[0,0,4,0]);
 s.productionBuffer='auto';s.uptime=100;s.raid=0;assert.equal(planAssignments(s,fuelPlan,m).buffer.extra,0);
 s.raid=56;s.win=100;assert.equal(planAssignments(s,fuelPlan,m).buffer.extra,0);
 s.uptime=90;assert(planAssignments(s,fuelPlan,m).buffer.extra>0);
});
test('unknown raid readings use a conservative buffer and unavailable staff are excluded',()=>{
 const s=fixture();s.raid=null;s.win=null;s.unavailable.Operations=3;const m=metrics(s,DATA.wiki),result=planAssignments(s,fuelPlan,m);
 assert.equal(result.assign.reduce((a,b)=>a+b,0),5);assert.equal(result.buffer.extra,1);
 s.unavailable.Operations=8;assert.deepEqual(planAssignments(s,fuelPlan,metrics(s,DATA.wiki)).assign,[0,0,0,0]);
});
test('a raid buffer never crowds a required resource out of shared storage',()=>{
 const s=fixture();s.res=[0,0,0,0];s.capacity=70;
 const plan={primary:[0,4,60,0],secondary:[0,4,60,0]},m=metrics(s,DATA.wiki),result=planAssignments(s,plan,m);
 assert.deepEqual(result.buffer.base,[0,2,3,0]);assert.deepEqual(result.assign,result.buffer.base);
 const proportion={primary:[0,1,60,0],secondary:[0,1,60,0]},scaled=planAssignments(s,proportion,m);
 assert(scaled.buffer.extra>0);assert.deepEqual(output(s,scaled.assign,m),output(s,scaled.buffer.base,m));
});
test('bounded allocation respects all limits and never reduces minimum-plan resource output',()=>{
 for(const capacity of [50,95,179,500,3000])for(const target of [[0,0,1000,0],[40,7,65,12],[0,5,30,15],[0,0,0,5]]){
  const s=fixture();s.res=[0,0,0,0];s.capacity=capacity;const m=metrics(s,DATA.wiki),plan={primary:target,secondary:target},result=planAssignments(s,plan,m),base=chooseAssignments(s,plan,m);
  assert(result.assign.every((n,i)=>Number.isInteger(n)&&n>=base[i]&&n<=1000));assert(result.assign.reduce((a,b)=>a+b,0)<=m.ops);
  const minimum=output(s,base,m);output(s,result.assign,m).forEach((n,i)=>assert(n+1e-7>=minimum[i]));
 }
 const s=fixture();s.staff.Operations={'S++':5000};const allocation=planAssignments(s,fuelPlan,metrics(s,DATA.wiki)).assign;assert(allocation.every(n=>n<=1000));assert(allocation.reduce((a,b)=>a+b,0)<=4000);
});
test('full stock, over-capacity stock, zero rates and zero uptime do not get phantom production',()=>{
 const s=fixture(),m={capacity:179,ops:8,rates};
 s.res=[3000,0,0,0];assert.deepEqual(planAssignments(s,fuelPlan,m).assign,[0,0,0,0]);
 s.res=[179,0,0,0];assert.deepEqual(planAssignments(s,fuelPlan,m).assign,[0,0,0,0]);
 s.res=[0,0,0,0];s.uptime=0;assert.deepEqual(planAssignments(s,fuelPlan,m).assign,[0,0,0,0]);
 s.uptime=90;assert.deepEqual(planAssignments(s,fuelPlan,{...m,rates:[0,0,0,0]}).assign,[0,0,0,0]);
});
test('existing backups gain Auto without moving timers or inventing casualties',()=>{
 const s=fixture();delete s.productionBuffer;s.status[100]={state:'active',end:now+10000};const migrated=validateProfile(s);
 assert.equal(migrated.productionBuffer,'auto');assert.deepEqual(migrated.status,s.status);assert.deepEqual(migrated.session,s.session);assert.deepEqual(migrated.unavailable,s.unavailable);
 for(const value of [null,true,'maximum'])assert.throws(()=>validateProfile({...s,productionBuffer:value}));
 const before=structuredClone(migrated),plan=forecast(migrated,DATA,now,3);assert(plan.rows[0].productionBuffer.extra>0);assert.deepEqual(migrated,before);
});
test('check-in text explains the buffer and its limits without promising casualty protection',()=>{
 const s=fixture(),buffer=planAssignments(s,fuelPlan,metrics(s,DATA.wiki)).buffer,text=productionBufferText(buffer);
 assert.match(text,/4 extra workers/);assert.match(text,/10h 17m/);assert.match(text,/20h 34m/);assert.match(text,/record actual injuries/);assert.equal(productionBufferText({extra:0}),'');
});
