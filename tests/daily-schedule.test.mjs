import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSchedule,nextScheduledVisit,scheduleChange,visitPreview} from '../src/schedule.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {validateProfile} from '../src/profile.js';
import {DATA} from '../src/full-data.js';
import {forecast,finishSession,recordHistory,restoreHistory} from '../src/engine.js';
import {assertForecastValid} from './forecast-assertions.mjs';
const H=3600000,at=Date.parse;
function state(clock='2026-10-24T12:00Z'){
 const s=createEmptyProfile(DATA.tasks,{now:at(clock),timezone:'Europe/Prague'});
 Object.assign(s,{schedule:{mode:'daily',times:['14:00','20:00']},anchor:'2026-10-24T14:00',setupComplete:true,power:191,autoCapacity:false,capacity:500,goal:'cash',target:1e9});
 s.session.scheduled=at(clock);return s;
}
test('daily visits alternate 6 and 18 hours and follow the local clock across autumn DST',()=>{
 const s=state('2026-10-22T12:00Z');
 const rows=visitPreview(s,s,at('2026-10-22T11:00Z'));
 assert.deepEqual(rows.map(r=>r.gapHours),[null,6,18,6]);
 const dst=visitPreview(state(),state(),at('2026-10-24T11:00Z'));
 assert.deepEqual(dst.map(r=>r.time),['2026-10-24T12:00Z','2026-10-24T18:00Z','2026-10-25T13:00Z','2026-10-25T19:00Z'].map(at));
 assert.equal(dst[2].gapHours,19);
});
test('new daily schedules choose the nearest time at or after save without a date',()=>{
 const empty=createEmptyProfile(DATA.tasks,{timezone:'Europe/Prague'}),next={...empty,schedule:{mode:'daily',times:['14:00','20:00']}};
 for(const [now,expected] of [['2026-10-22T10:00Z','2026-10-22T12:00Z'],['2026-10-22T12:00Z','2026-10-22T12:00Z'],['2026-10-22T12:00:01Z','2026-10-22T18:00Z'],['2026-10-22T19:00Z','2026-10-23T12:00Z']])assert.equal(scheduleChange(empty,next,at(now)).scheduled,at(expected));
});
test('saving daily times and timezone preserves the pending session and all HQ timers',()=>{
 const s=state(),before=structuredClone(s);s.status[100]={state:'active',end:at('2026-10-24T18:00Z')};
 const next={...s,schedule:{mode:'daily',times:['09:00']},timezone:'America/New_York',anchor:''};
 const result=scheduleChange(s,next,at('2026-10-25T20:00Z'));
 assert.equal(result.scheduled,before.session.scheduled);assert.equal(result.anchor,'2026-10-24T08:00');assert.equal(s.status[100].end,at('2026-10-24T18:00Z'));
 assert.equal(nextScheduledVisit(next,result.scheduled).time,at('2026-10-24T13:00Z'));
});
test('finish skips missed times, cannot advance twice, and early finish cannot go backwards',()=>{
 const s=state('2026-10-22T12:00Z');
 assert.equal(finishSession(s,s.session.scheduled,at('2026-10-22T11:00Z')).session.scheduled,at('2026-10-22T18:00Z'));
 const next=finishSession(s,s.session.scheduled,at('2026-10-25T15:00Z'));
 assert.equal(next.session.scheduled,at('2026-10-25T19:00Z'));assert.throws(()=>finishSession(next,s.session.scheduled),/already advanced/);
});
test('times sort canonically and reject duplicates, invalid values and overlapping midnight windows',()=>{
 assert.deepEqual(validateSchedule({mode:'daily',times:['20:00','14:00']},5),{mode:'daily',times:['14:00','20:00']});
 for(const times of [[],[''],['24:00'],['12:60'],['14:00','14:00'],Array(9).fill('12:00'),['00:01','23:59']])assert.throws(()=>validateSchedule({mode:'daily',times},5));
 assert.throws(()=>validateSchedule({mode:'daily',times:['14:00','14:04']},5),/overlap/);
 assert.doesNotThrow(()=>validateSchedule({mode:'daily',times:['14:00','14:05']},5));
 assert.doesNotThrow(()=>validateSchedule({mode:'daily',times:['00:00']},120));
});
test('spring missing daily occurrence is skipped with a warning; repeated autumn time runs once',()=>{
 const s=state('2026-03-28T01:30Z');s.schedule.times=['02:30'];
 const spring=nextScheduledVisit(s,s.session.scheduled);assert.equal(spring.time,at('2026-03-30T00:30Z'));assert.match(spring.warnings[0],/2026-03-29 at 02:30/);
 const autumn=state('2026-10-24T00:30Z');autumn.schedule.times=['02:30'];
 assert.equal(nextScheduledVisit(autumn,autumn.session.scheduled).time,at('2026-10-25T00:30Z'));
 assert.equal(nextScheduledVisit(autumn,at('2026-10-25T00:30Z')).time,at('2026-10-26T01:30Z'));
 assert.equal(nextScheduledVisit(autumn,at('2026-10-25T01:00Z')).time,at('2026-10-26T01:30Z'));
});
test('midnight and one-time daily patterns progress on local dates and extreme timers stop safely',()=>{
 const s=state();s.schedule.times=['00:00'];assert.equal(nextScheduledVisit(s,at('2026-10-24T21:00Z')).time,at('2026-10-24T22:00Z'));
 assert.equal(nextScheduledVisit(s,8640000000000000).time,null);assert.equal(nextScheduledVisit(s,Infinity).time,null);
});
test('spring clock changes cannot create overlapping two-hour visit windows',()=>{
 const s=state('2026-03-29T00:00Z');s.schedule.times=['01:00','03:00'];s.visitMinutes=120;
 const rows=visitPreview(s,s,s.session.scheduled);
 assert.equal(rows[1].time,at('2026-03-29T23:00Z'));assert.match(rows[1].warnings[0],/overlap/);
});
test('legacy profiles and history migrate without rescheduling; backups and Undo retain daily times',()=>{
 const legacy=state();delete legacy.schedule;const migrated=validateProfile(legacy);assert.deepEqual(migrated.schedule,{mode:'interval',times:[]});assert.equal(migrated.session.scheduled,legacy.session.scheduled);
 const daily=state(),saved=validateProfile(JSON.parse(JSON.stringify(recordHistory(migrated,daily,'Daily schedule'))));
 assert.deepEqual(saved.schedule,daily.schedule);assert.deepEqual(restoreHistory(saved,saved.history[0].id).schedule,migrated.schedule);
 const original=recordHistory(daily,{...daily,cash:50},'Cash');assert.deepEqual(validateProfile(restoreHistory(original,original.history[0].id)).schedule,daily.schedule);
 const invalid=state();invalid.schedule={mode:'unknown',times:[]};assert.throws(()=>validateProfile(invalid),/schedule/);
});
test('daily forecast replays correctly over unequal gaps, including collection and capped storage',()=>{
 const s=state('2026-10-22T12:00Z');s.staff.Operations={'S++':8};s.staff.Delivery={'S++':6};s.assign=[0,0,8,0];s.res=[0,0,0,0];s.ships=[{id:'outgoing',resource:2,quantity:10,value:1500,staffIds:['S++:0'],end:at('2026-10-22T18:00Z')}];
 const before=structuredClone(s),f=forecast(s,DATA,s.session.scheduled,4);
 assert.deepEqual(f.rows.map(r=>r.scheduledTime),['2026-10-22T12:00Z','2026-10-22T18:00Z','2026-10-23T12:00Z','2026-10-23T18:00Z'].map(at));
 assert.equal(f.rows[1].collected,1500);assert(f.rows[0].assign.every(n=>Number.isInteger(n)));assertForecastValid(s,f);assert.deepEqual(s,before);
});
test('daily forecast uses actual six-hour replacement window instead of stored 24-hour interval',()=>{
 const s=state('2026-10-22T12:00Z'),task={id:1,name:'Goal',deps:[],res:[30,7,60,19],cost:30000,power:10,hours:1};
 s.status={1:{state:'todo'}};Object.assign(s,{interval:24,goal:'1',cash:13433,res:[30,7,28,19],capacity:179,reserve:5000});s.staff.Operations={'S++':8};s.staff.Delivery={'S++':6};
 const daily=forecast(s,{tasks:[task],wiki:DATA.wiki},s.session.scheduled,1),interval=forecast({...s,schedule:{mode:'interval',times:[]}},{tasks:[task],wiki:DATA.wiki},s.session.scheduled,1);
 assert.equal(daily.rows[0].delivery,null);assert.equal(interval.rows[0].delivery.quantity,28);
});
