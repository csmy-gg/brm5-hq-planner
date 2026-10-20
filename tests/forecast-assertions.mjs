import assert from 'node:assert/strict';
import {DATA} from '../src/full-data.js';
import {clone,metrics,projectStock,start,collect,dispatch,blocked,researchPowerUsed,count} from '../src/engine.js';
export function assertForecastValid(initial,forecast,data=DATA){
 let state=clone(initial);const m=metrics(state,data.wiki),tasks=data.tasks;
 function advance(at){assert(at>=state.snapshot);state.res=projectStock(state,at,m).res;state.snapshot=at;}
 for(const row of forecast.rows){
  advance(row.time);let last=row.time;
  for(const event of row.events){
   assert(event.at>=last&&event.at<=row.time+row.visitMinutes*60000);advance(event.at);last=event.at;
   if(event.type==='research-complete'){assert.equal(state.status[event.id].state,'active');assert(state.status[event.id].end<=event.at);state.status[event.id]={state:'done'};}
   if(event.type==='research-start'){assert.deepEqual(blocked(tasks.find(t=>t.id===event.id),state,tasks,event.at),[]);state=start(state,event.id,tasks,event.at);assert(researchPowerUsed(state,tasks,event.at)<=state.power);assert(state.cash>=state.reserve);}
   if(event.type==='collect')state=collect(state,event.at,event.id);
   if(event.type==='dispatch'){state=dispatch(state,event.resource,event.quantity,data.wiki,event.at);state.ships.at(-1).id=event.id;}
   assert(state.res.every(n=>n>=-1e-7));
  }
  advance(row.visitEnd);assert(Math.abs(state.cash-row.after.cash)<1e-6);
  state.res.forEach((n,i)=>assert(Math.abs(n-row.after.res[i])<1e-6,`Resource ${i} differs at ${row.time}`));
  assert(row.assign.every(n=>Number.isInteger(n)&&n>=0&&n<=1000));assert(row.assign.reduce((a,b)=>a+b,0)<=count(state,'Operations'));state.assign=[...row.assign];
 }
 return state;
}
