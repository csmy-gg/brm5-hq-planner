import {calendarInput,zonedTimestamp,validTimestamp} from './time.js';

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
 const changed=next.anchor!==previous.anchor||next.interval!==previous.interval;
 if(changed)return next.anchor?nextScheduleTime(next.anchor,next.interval,next.timezone,now):{anchor:'',scheduled:null,advanced:false};
 const scheduled=previous.session.scheduled;
 return {anchor:next.timezone!==previous.timezone&&scheduled!==null?calendarInput(scheduled,next.timezone):next.anchor,scheduled,advanced:false};
}
