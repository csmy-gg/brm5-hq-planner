import test from 'node:test';
import assert from 'node:assert/strict';
import {nextScheduleTime,scheduleChange} from '../src/schedule.js';
import {zonedTimestamp} from '../src/time.js';
const zone='Europe/Prague',now=Date.parse('2026-10-20T12:00:00Z');
const previous=()=>({anchor:'2026-10-18T12:00',interval:12,timezone:zone,session:{scheduled:Date.parse('2026-10-18T10:00Z'),completed:[]}});
test('daily 5 PM selected on an old date moves to October 20 before 5 PM',()=>{
 const s=previous(),before=structuredClone(s),result=scheduleChange(s,{...s,interval:24,anchor:'2026-10-18T17:00'},now);
 assert.deepEqual(result,{anchor:'2026-10-20T17:00',scheduled:Date.parse('2026-10-20T15:00Z'),advanced:true});assert.deepEqual(s,before);
});
test('daily visits move to tomorrow after the selected time and respect exact deadlines',()=>{
 const due=Date.parse('2026-10-20T15:00Z');
 assert.equal(nextScheduleTime('2026-10-18T17:00',24,zone,due).anchor,'2026-10-20T17:00');
 assert.equal(nextScheduleTime('2026-10-18T17:00',24,zone,due+1).anchor,'2026-10-21T17:00');
});
test('changing only the interval reschedules overdue visits but unrelated settings leave them awaiting confirmation',()=>{
 const s=previous();assert.equal(scheduleChange(s,{...s,interval:24},now).anchor,'2026-10-21T12:00');
 assert.deepEqual(scheduleChange(s,{...s,power:250},now),{anchor:s.anchor,scheduled:s.session.scheduled,advanced:false});
 assert.equal(scheduleChange(s,{...s,visitMinutes:10},now).scheduled,s.session.scheduled);
});
test('recurrence finds the next half-day or weekly visit without discarding explicit future dates',()=>{
 assert.equal(nextScheduleTime('2026-10-18T17:00',12,zone,Date.parse('2026-10-20T01:00Z')).anchor,'2026-10-20T05:00');
 assert.equal(nextScheduleTime('2026-10-18T17:00',168,zone,now).anchor,'2026-10-25T17:00');
 assert.equal(nextScheduleTime('2026-11-02T17:00',24,zone,now).anchor,'2026-11-02T17:00');
});
test('rescheduling follows the selected local clock across DST and uses that zone calendar day',()=>{
 const fall=nextScheduleTime('2026-10-18T17:00',24,zone,Date.parse('2026-10-26T12:00Z'));
 assert.equal(fall.anchor,'2026-10-26T17:00');assert.equal(fall.scheduled,Date.parse('2026-10-26T16:00Z'));
 assert.equal(nextScheduleTime('2026-10-18T17:00',24,'Pacific/Auckland',Date.parse('2026-10-20T22:00Z')).anchor,'2026-10-21T17:00');
});
test('nonexistent spring times are rejected and repeated autumn times use the first occurrence',()=>{
 assert.throws(()=>nextScheduleTime('2026-03-28T02:30',24,zone,Date.parse('2026-03-28T12:00Z')),/does not exist/);
 const first=nextScheduleTime('2026-10-24T02:30',24,zone,Date.parse('2026-10-24T12:00Z'));
 assert.equal(first.scheduled,Date.parse('2026-10-25T00:30Z'));
 const passed=nextScheduleTime('2026-10-24T02:30',24,zone,Date.parse('2026-10-25T01:15Z'));
 assert.equal(passed.anchor,'2026-10-26T02:30');
});
test('timezone-only changes preserve the pending visit instant and empty setup stays unscheduled',()=>{
 const s=previous(),result=scheduleChange(s,{...s,timezone:'America/New_York'},now);
 assert.equal(result.scheduled,s.session.scheduled);assert.equal(result.anchor,'2026-10-18T06:00');
 assert.equal(zonedTimestamp(result.anchor,'America/New_York'),s.session.scheduled);
 const empty={anchor:'',interval:12,timezone:zone,session:{scheduled:null,completed:[]}};
 assert.deepEqual(scheduleChange(empty,{...empty,interval:24},now),{anchor:'',scheduled:null,advanced:false});
});
test('invalid dates, intervals and unsupported timestamps fail before changing a session',()=>{
 for(const interval of [0,5,169,NaN,Infinity])assert.throws(()=>nextScheduleTime('2026-10-18T17:00',interval,zone,now));
 assert.throws(()=>nextScheduleTime('2026-02-30T17:00',24,zone,now));assert.throws(()=>nextScheduleTime('2026-10-18T17:00',24,zone,Infinity));
});
