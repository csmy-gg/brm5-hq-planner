import test from 'node:test';
import assert from 'node:assert/strict';
import expected from './fixtures/ammunition-2026-11-27.json' with {type:'json'};
import {DATA} from '../src/full-data.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {start,blocked} from '../src/engine.js';
test('November 27 ammunition panels gate cash and power and record one-minute research without resource costs',()=>{
 const now=Date.UTC(2026,10,27,12);
 for(const panel of expected){
  const task=DATA.tasks.find(t=>t.id===panel.id);
  assert.deepEqual({id:task.id,name:task.name,cost:task.cost,power:task.power,res:task.res,hours:task.hours},panel);
  const s=createEmptyProfile(DATA.tasks,{now,timezone:'Europe/Prague'});
  for(const t of DATA.tasks)s.status[t.id]={state:'done'};
  s.status[task.id]={state:'todo'};Object.assign(s,{cash:panel.cost,res:[0,0,0,0],reserve:0,power:panel.power});
  assert.deepEqual(blocked(task,s,DATA.tasks,now),[]);
  assert(blocked(task,{...s,cash:panel.cost-1},DATA.tasks,now).length);
  assert(blocked(task,{...s,power:panel.power-1},DATA.tasks,now).length);
  const next=start(s,task.id,DATA.tasks,now);assert.equal(next.cash,0);assert.deepEqual(next.res,[0,0,0,0]);assert.equal(next.status[task.id].end,now+60000);assert.throws(()=>start(next,task.id,DATA.tasks,now));
 }
});
