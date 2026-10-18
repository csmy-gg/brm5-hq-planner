export function validTimezone(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return typeof zone==='string'&&zone.length<100;}catch{return false;}}
export const validTimestamp=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=8640000000000000;
export function detectedTimezone(){const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;return validTimezone(zone)?zone:'UTC';}
export function calendarInput(timestamp,zone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(timestamp).map(x=>[x.type,x.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function zonedTimestamp(input,zone){
 if(!validTimezone(zone)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw Error('Enter a valid visit date and timezone.');
 const [year,month,day,hour,minute]=input.split(/[-T:]/).map(Number),wall=Date.UTC(year,month-1,day,hour,minute);
 if(new Date(wall).toISOString().slice(0,16)!==input)throw Error('Enter a valid calendar date.');
 const candidates=new Set();
 for(let hours=-36;hours<=36;hours+=6){
  const sample=wall+hours*3600000,shown=Date.parse(calendarInput(sample,zone)+'Z'),offset=shown-sample;
  const candidate=wall-offset;if(calendarInput(candidate,zone)===input)candidates.add(candidate);
 }
 if(!candidates.size)throw Error('This time does not exist because the clocks change. Choose a different visit time.');
 // A repeated autumn time consistently means its first occurrence.
 return Math.min(...candidates);
}
