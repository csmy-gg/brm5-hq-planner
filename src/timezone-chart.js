import rawRegions from './timezone-regions.json' with {type:'json'};
import locations from './timezone-data.json' with {type:'json'};
import {validTimezone} from './time.js';
const formatters=new Map();
export function offsetMinutes(zone,now=Date.now()){if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longOffset'}));const text=formatters.get(zone).formatToParts(now).find(part=>part.type==='timeZoneName').value,match=text.match(/GMT([+-])(\d{2}):(\d{2})/);return match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3])):0;}
export function offsetLabel(minutes){const sign=minutes<0?'−':'+';const n=Math.abs(minutes);return 'UTC'+sign+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
export function chartRegions(now=Date.now()){return rawRegions.map(region=>{const zones=region.zones.filter(validTimezone),counts=new Map();zones.forEach(zone=>{const offset=offsetMinutes(zone,now);counts.set(offset,(counts.get(offset)||0)+1);});const offsets=[...counts.keys()].sort((a,b)=>a-b),offset=counts.size?[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0]:Math.round(region.sourceOffset*60);return {id:region.id,path:region.path,zones,offset,offsets:offsets.length?offsets:[offset]};});}
export function zonesAtOffset(minutes,now=Date.now()){return locations.filter(entry=>validTimezone(entry.id)&&offsetMinutes(entry.id,now)===Number(minutes));}
export function regionEntries(region){const ids=new Set(region.zones);return locations.filter(entry=>ids.has(entry.id));}
