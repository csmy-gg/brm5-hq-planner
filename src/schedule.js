import {calendarInput,zonedTimestamp,validTimestamp} from './time.js';

// Forecast policies revisit the same calendar times. Keep a bounded in-memory
// conversion cache; no HQ state or calculated balances are cached here.
const dailyInstants=new Map();
function dailyTimestamp(input,zone){
 const key=zone+'|'+input;if(dailyInstants.has(key))return dailyInstants.get(key);
 let time;try{time=zonedTimestamp(input,zone);}catch(error){if(!error.message.includes('does not exist'))throw error;time=null;}
 if(dailyInstants.size>=4096)dailyInstants.delete(dailyInstants.keys().next().value);
 dailyInstants.set(key,time);return time;
}

export function validateSchedule(value,visitMinutes=0){
 if(value===undefined)return {mode:'interval',times:[]};
 if(!value||!['interval','daily'].includes(value.mode)||!Array.isArray(value.times))throw Error('Choose a valid visit schedule.');
 if(value.mode==='interval')return {mode:'interval',times:[]};
 const times=[...value.times].sort();
 if(!times.length||times.length>8||times.some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Enter 1–8 daily visit times, from 00:00 to 23:59.');
 if(new Set(times).size!==times.length)throw Error('Each daily visit time must be different.');
 const minutes=times.map(t=>Number(t.slice(0,2))*60+Number(t.slice(3)));
 if(minutes.some((m,i)=>(minutes[(i+1)%minutes.length]+(i===minutes.length-1?1440:0)-m)<visitMinutes))throw Error('Daily visits overlap. Move them farther apart or reduce Time per visit.');
 return {mode:'daily',times};
}

// Shared recurrence for the check-in, preview and disposable forecast. The pending
// session is an absolute instant; daily repetitions are local calendar times.
export function nextScheduledVisit(s,after,{inclusive=false,previous=null}={}){
 if(!validTimestamp(after))return {time:null,warnings:[]};
 if(s.schedule?.mode!=='daily'){
  const base=s.session?.scheduled??(s.anchor?zonedTimestamp(s.anchor,s.timezone):null),step=s.interval*3600000;
  if(base===null||!Number.isFinite(step)||step<=0)return {time:null,warnings:[]};
  const n=Math.max(0,inclusive?Math.ceil((after-base)/step):Math.floor((after-base)/step)+1),time=base+n*step;
  return {time:validTimestamp(time)?time:null,warnings:[]};
 }
 const {times}=validateSchedule(s.schedule,s.visitMinutes),local=calendarInput(after,s.timezone),warnings=[];
 // Local visit inputs support four-digit years, unlike extreme legacy deadlines.
 if(!/^\d{4}-/.test(local))return {time:null,warnings};
 const day=Date.parse(local.slice(0,10)+'T00:00:00Z');
 for(let offset=0;offset<8;offset++){
  const date=new Date(day+offset*86400000).toISOString().slice(0,10);
  if(!/^\d{4}-/.test(date))break;
  for(const clock of times){
   const input=date+'T'+clock;
   const time=dailyTimestamp(input,s.timezone);
   if(time===null){
    if(input>=local)warnings.push(`Skipped ${date} at ${clock}: this local time does not exist because the clocks change.`);
    continue;
   }
   if(validTimestamp(time)&&(inclusive?time>=after:time>after)){
    if(previous!==null&&time-previous<(s.visitMinutes||0)*60000){warnings.push(`Skipped ${date} at ${clock}: the clock change would overlap the previous visit window.`);continue;}
    return {time,warnings};
   }
  }
 }
 return {time:null,warnings};
}

export function visitPreview(previous,next,now=Date.now(),count=4){
 const first=scheduleChange(previous,next,now),rows=[];
 let occurrence={time:first.scheduled,warnings:first.warnings||[]};
 for(let i=0;i<count&&occurrence.time!==null;i++){
  const time=occurrence.time;
  rows.push({time,gapHours:i?(time-rows[i-1].time)/3600000:null,warnings:occurrence.warnings});
  occurrence=nextScheduledVisit({...next,session:{...next.session,scheduled:first.scheduled}},Math.max(time,now),{previous:time});
 }
 return rows;
}

// Rescheduling an old date follows its local clock-time pattern. Existing deadlines
// and the forecast's elapsed-hour spacing are unaffected until a schedule is saved.
export function nextScheduleTime(input,interval,zone,now=Date.now()){
 if(!Number.isFinite(interval)||interval<6||interval>168||!validTimestamp(now))throw Error('Choose an interval from 6 to 168 hours.');
 const original=zonedTimestamp(input,zone);if(original>=now)return {anchor:input,scheduled:original,advanced:false};
 const step=interval*3600000,wall=Date.parse(input+'Z'),wallNow=Date.parse(calendarInput(now,zone)+'Z');
 let offset=Math.max(0,Math.ceil((wallNow-wall)/step));
 let anchor=new Date(wall+offset*step).toISOString().slice(0,16),scheduled=zonedTimestamp(anchor,zone);
 // A repeated autumn hour means its first occurrence, even if that occurrence has passed.
 if(scheduled<now){offset++;anchor=new Date(wall+offset*step).toISOString().slice(0,16);scheduled=zonedTimestamp(anchor,zone);}
 if(!validTimestamp(scheduled)||scheduled<now)throw Error('Choose a supported future visit time.');
 return {anchor,scheduled,advanced:true};
}

export function scheduleChange(previous,next,now=Date.now()){
 if(next.schedule?.mode==='daily'){
  validateSchedule(next.schedule,next.visitMinutes);
  const pending=previous.session?.scheduled;
  if(pending!=null)return {anchor:calendarInput(pending,next.timezone),scheduled:pending,advanced:false};
  const result=nextScheduledVisit(next,now,{inclusive:true});
  if(result.time===null)throw Error('Choose a supported future visit time.');
  return {anchor:calendarInput(result.time,next.timezone),scheduled:result.time,advanced:false,...(result.warnings.length?{warnings:result.warnings}:{})};
 }
 const changed=previous.schedule?.mode==='daily'||next.anchor!==previous.anchor||next.interval!==previous.interval;
 if(changed)return next.anchor?nextScheduleTime(next.anchor,next.interval,next.timezone,now):{anchor:'',scheduled:null,advanced:false};
 const scheduled=previous.session.scheduled;
 return {anchor:next.timezone!==previous.timezone&&scheduled!==null?calendarInput(scheduled,next.timezone):next.anchor,scheduled,advanced:false};
}
