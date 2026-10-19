import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA} from '../src/full-data.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {validateProfile} from '../src/profile.js';
import {metrics,projectStock,forecast,blocked} from '../src/engine.js';
import {preferenceDefaults,validatePreferences,readPreferences,savePreferences,PREFERENCES_KEY} from '../src/preferences.js';
import {visibleResearch,goalProgress,productGoals} from '../src/research-view.js';
import {searchTimezones,timezoneOffset,mapClusters} from '../src/timezone-picker.js';
import {calendarInput,zonedTimestamp} from '../src/time.js';

function storage(seed={}){const map=new Map(Object.entries(seed));return {map,get length(){return map.size;},key:i=>[...map.keys()][i],getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
const empty=()=>createEmptyProfile(DATA.tasks,{timezone:'Europe/Prague'});

test('device preferences default by existing HQ, migrate theme, and never modify HQ records',()=>{
  const fresh=storage({'brm5-theme':'dark'});assert.equal(readPreferences(fresh).mode,'easy');assert.equal(readPreferences(fresh).theme,'dark');
  const raw=JSON.stringify({profile:{version:1,cash:10}}),saved=storage({'brm5-public-v2:project:guest':raw});assert.equal(readPreferences(saved).mode,'advanced');
  savePreferences({...preferenceDefaults(),mode:'easy',modeChosen:true,textSize:150,theme:'blueprint'},saved);
  assert.equal(readPreferences(saved).mode,'easy');assert.equal(readPreferences(saved).textSize,150);assert.equal(saved.getItem('brm5-public-v2:project:guest'),raw);
  assert.deepEqual(validatePreferences({version:1,theme:'invalid',textSize:900,filter:'invalid'}),preferenceDefaults());
  assert(saved.getItem(PREFERENCES_KEY));
});

test('Ready now exactly matches start eligibility, including reserve, dependencies and running power',()=>{
  const state=empty();state.cash=100000;state.res=[100,100,100,100];state.power=191;
  assert.deepEqual(visibleResearch(DATA.tasks,state,{filter:'ready'}).map(t=>t.id),DATA.tasks.filter(t=>blocked(t,state,DATA.tasks).length===0).map(t=>t.id));
  state.status[DATA.tasks[0].id]={state:'active',end:Date.now()+60000};state.power=DATA.tasks[0].power;
  assert.equal(visibleResearch(DATA.tasks,state,{filter:'ready'}).every(t=>t.power===0),true);
  state.reserve=state.cash;assert(visibleResearch(DATA.tasks,state,{filter:'ready'}).every(t=>t.cost===0));
  const tasks=[{id:1,name:'Active',power:180,deps:[],cost:0,res:[0,0,0,0]},{id:2,name:'Fits',power:11,deps:[],cost:0,res:[0,0,0,0]},{id:3,name:'Too much',power:12,deps:[],cost:0,res:[0,0,0,0]}];state.power=191;state.status={1:{state:'active',end:Date.now()+60000},2:{state:'todo'},3:{state:'todo'}};
  assert.deepEqual(visibleResearch(tasks,state,{filter:'ready'}).map(t=>t.id),[2]);
});

test('goal summary deduplicates prerequisite DAG and excludes active or completed purchase costs',()=>{
  const tasks=[{id:0,name:'Root',deps:[],cost:1,res:[1,0,0,0]},{id:1,name:'A',deps:[0],cost:10,res:[1,0,0,0]},{id:2,name:'B',deps:[0],cost:20,res:[2,0,0,0]},{id:3,name:'Product',deps:[1,2],cost:30,res:[4,0,0,0]}];
  const state=createEmptyProfile(tasks);state.goal='3';state.status[0]={state:'done'};state.status[1]={state:'active',end:0};state.cash=15;state.reserve=5;state.res=[3,0,0,0];state.ships=[{value:1000}];
  const summary=goalProgress(state,tasks);assert.equal(summary.total,4);assert.equal(summary.done,1);assert.equal(summary.active,1);assert.equal(summary.todo,2);assert.equal(summary.cash,50);assert.equal(summary.cashShortfall,40);assert.deepEqual(summary.resourceShortfalls,[3,0,0,0]);assert.equal(summary.pendingIncome,1000);
  state.goal='cash';state.target=50;assert.equal(goalProgress(state,tasks).shortfall,35);
  state.goal='resource';state.goalResource=0;state.target=100;assert.equal(goalProgress(state,tasks).shortfall,97);
});

test('timezone search supports country names, aliases, UTC and fractional seasonal offsets',()=>{
  assert(searchTimezones('Czechia').some(e=>e.id==='Europe/Prague'));assert(searchTimezones('Czech Republic').some(e=>e.id==='Europe/Prague'));
  assert(searchTimezones('Calcutta','Asia/Calcutta').some(e=>e.id==='Asia/Calcutta'));
  assert(searchTimezones('UTC').some(e=>e.id==='UTC'));
  assert.equal(timezoneOffset('Europe/Prague',Date.UTC(2026,0,1)),'UTC+01:00');assert.equal(timezoneOffset('Europe/Prague',Date.UTC(2026,6,1)),'UTC+02:00');
  assert.equal(timezoneOffset('Asia/Kathmandu',Date.UTC(2026,0,1)),'UTC+05:45');
  const clusters=mapClusters([{id:'UTC',lat:0,lon:0},{id:'A',lat:50,lon:14},{id:'B',lat:51,lon:15}]);assert.equal(clusters.length,1);assert.equal(clusters[0].entries.length,2);
});

test('timezone-only changes preserve instants across date-line, half-hour and DST zones',()=>{
  const instant=zonedTimestamp('2026-10-25T02:30','Europe/Prague');
  for(const zone of ['Pacific/Auckland','America/St_Johns','Asia/Kathmandu','UTC'])assert.equal(zonedTimestamp(calendarInput(instant,zone),zone),instant);
  assert.throws(()=>zonedTimestamp('2026-03-29T02:30','Europe/Prague'),/does not exist/);
});

test('over-capacity stock and zero production remain finite without clamping recorded balances',()=>{
  const state=empty();state.res=[3000,0,0,0];state.autoCapacity=false;state.capacity=500;
  const original=structuredClone(state);validateProfile(state);assert.deepEqual(projectStock(state,Date.now()+86400000,metrics(state,DATA.wiki)).res,[3000,0,0,0]);assert.deepEqual(state,original);
  state.setupComplete=true;state.anchor='2026-10-18T12:00';state.session.scheduled=zonedTimestamp(state.anchor,state.timezone);
  const result=forecast(state,DATA,Date.now(),3);assert.equal(result.rows.length,3);assert(result.rows.every(row=>Number.isFinite(row.after.cash)&&row.after.res.every(Number.isFinite)));
});

test('out-of-range imported dates and duplicate delivery staff are rejected before rendering',()=>{
  for(const mutate of [s=>s.snapshot=Number.MAX_SAFE_INTEGER,s=>s.status[DATA.tasks[0].id]={state:'active',end:Number.MAX_SAFE_INTEGER},s=>s.session.scheduled=Number.MAX_SAFE_INTEGER,s=>s.ships=[{id:'ship',staffIds:['S++:0','S++:0'],resource:0,quantity:1,value:100,end:Date.now()}]]){
    const state=empty();mutate(state);assert.throws(()=>validateProfile(state));
  }
  const corrected=empty();corrected.status[DATA.tasks.at(-1).id]={state:'done'};assert.equal(validateProfile(corrected).status[DATA.tasks.at(-1).id].state,'done');
});


test('extreme supported deadlines cannot produce unformattable forecast dates',()=>{const state=empty();state.setupComplete=true;state.anchor='2026-10-18T12:00';state.session.scheduled=8640000000000000-30000;const result=forecast(validateProfile(state),DATA);assert.deepEqual(result.rows,[]);assert.equal(result.finished,false);});
test('malformed storage flags, duplicate delivery IDs and invalid delivery dates fail validation',()=>{for(const mutate of [s=>s.autoCapacity='false',s=>s.ships=[{id:'same',end:0,value:1,resource:0,quantity:1,staffIds:[]},{id:'same',end:0,value:1,resource:0,quantity:1,staffIds:[]}],s=>s.ships=[{id:'bad-date',end:Number.MAX_SAFE_INTEGER,value:1,resource:0,quantity:1,staffIds:[]}]]){const state=empty();mutate(state);assert.throws(()=>validateProfile(state));}});

import {chartRegions,offsetMinutes,zonesAtOffset} from '../src/timezone-chart.js';
test('goal choices contain only products while existing research goals remain compatible',()=>{const choices=productGoals(DATA.tasks);assert.equal(choices.length,8);assert(choices.some(t=>t.name.includes('Skirmisher')));assert(choices.every(t=>t.category==='Products'));assert(!choices.some(t=>t.name==='Mathematics'));const state=empty();state.goal=String(DATA.tasks.find(t=>t.name==='Mathematics').id);assert.equal(validateProfile(state).goal,state.goal);});
test('timezone regions retain exact IANA choices and use current seasonal offsets',()=>{const now=Date.UTC(2026,9,18),regions=chartRegions(now);assert.equal(new Set(regions.flatMap(r=>r.zones)).size,418);assert(regions.find(r=>r.zones.includes('America/Caracas')).offsets.includes(-240));assert(regions.find(r=>r.zones.includes('Pacific/Norfolk')).offsets.includes(offsetMinutes('Pacific/Norfolk',now)));assert.equal(offsetMinutes('Asia/Kathmandu',now),345);assert(zonesAtOffset(345,now).some(entry=>entry.id==='Asia/Kathmandu'));assert.equal(offsetMinutes('Europe/Prague',Date.UTC(2026,0,1)),60);assert.equal(offsetMinutes('Europe/Prague',Date.UTC(2026,6,1)),120);});
