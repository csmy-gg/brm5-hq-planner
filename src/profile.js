import {DATA,migrateResearchState} from './full-data.js';
import {clone,defaults,AREAS,count,normalizeDeliveries,metrics} from './engine.js';
import {validTimezone,zonedTimestamp,validTimestamp} from './time.js';
import {validateSchedule} from './schedule.js';
export function validateProfile(input,withHistory=true){
 let s=clone(input);const legacy=s?.profileSchemaVersion==null;
 if(legacy){s.timezone='Europe/Prague';s.setupComplete=true;s.profileSchemaVersion=2;}
 if(!validTimezone(s?.timezone)||typeof s.setupComplete!=='boolean')throw Error('Invalid timezone or setup state.');
 if(s?.version!==1||!Array.isArray(s.res)||s.res.length!==4||!s.staff||!s.status)throw Error('This is not a compatible HQ backup.');
 for(const area of ['Training']){s.staff[area]??={};s.unavailable[area]??=0;}
 const finite=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!Object.hasOwn(s,'visitMinutes'))s.visitMinutes=5;
 if(!Object.hasOwn(s,'productionBuffer'))s.productionBuffer='auto';
 if(!['auto','minimum'].includes(s.productionBuffer))throw Error('Choose a valid production staffing mode.');
 if(!finite(s.visitMinutes,0,120)||!Number.isInteger(s.visitMinutes))throw Error('Time per visit must be a whole number from 0 to 120 minutes.');
 s.schedule=validateSchedule(s.schedule,s.visitMinutes);
 if(!finite(s.cash)||!s.res.every(n=>finite(n))||!finite(s.snapshot)||!finite(s.power,0,10000)||!finite(s.reserve)||!finite(s.capacity)||!finite(s.uptime,0,100)||!finite(s.interval,6,168)||!(s.raid===null||finite(s.raid,0,100))||!(s.win===null||finite(s.win,0,100))||typeof s.anchor!=='string'||(s.anchor!==''&&!Number.isFinite(Date.parse(s.anchor))))throw Error('Backup contains invalid quantities or settings.');
 if(typeof s.autoCapacity!=='boolean')throw Error('Invalid storage setting.');
 if(!validTimestamp(s.snapshot)||Object.values(s.status).some(x=>x?.state==='active'&&!validTimestamp(x.end)))throw Error('Backup contains an invalid timestamp.');
 if(s.session==null)s.session={scheduled:s.anchor?zonedTimestamp(s.anchor,s.timezone):null,completed:[]};
 if(s.session.actionKeys!=null&&(!Array.isArray(s.session.actionKeys)||s.session.actionKeys.length>200||s.session.actionKeys.some(x=>typeof x!=='string')))throw Error('Invalid session action receipts.');
 if(!s.session||!(s.session.scheduled===null||validTimestamp(s.session.scheduled))||!Array.isArray(s.session.completed)||s.session.completed.length>200||s.session.completed.some(x=>!x||!validTimestamp(x.scheduled)||!validTimestamp(x.finishedAt)))throw Error('Invalid session progress.');
 if(!Array.isArray(s.assign)||s.assign.length!==4||!s.assign.every(n=>Number.isInteger(n)&&n>=0&&n<=1000))throw Error('Invalid assignments.');
 for(const area of AREAS){if(!s.staff[area]||Object.entries(s.staff[area]).some(([r,n])=>!DATA.wiki.staff[r]||!Number.isInteger(n)||n<0||n>1000)||!Number.isInteger(s.unavailable?.[area])||s.unavailable[area]<0||s.unavailable[area]>Object.values(s.staff[area]).reduce((a,b)=>a+b,0))throw Error('Invalid staff counts.');}
 if(s.assign.reduce((a,b)=>a+b,0)>count(s,'Operations'))throw Error('Assignments exceed available Operations staff.');
 s=migrateResearchState(s);
 for(const t of DATA.tasks){const x=s.status[t.id];if(!x||!['todo','active','done'].includes(x.state)||(x.state==='active'&&!finite(x.end)))throw Error('Invalid research status.');}
 s=normalizeDeliveries(s,DATA.wiki);
 if(s.ships.length>100||new Set(s.ships.map(x=>x.id)).size!==s.ships.length)throw Error('Invalid delivery list.');
 const staffIds=new Set();for(const ship of s.ships){if(typeof ship.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(ship.id)||!validTimestamp(ship.end)||!finite(ship.value)||!Number.isInteger(ship.resource)||ship.resource<0||ship.resource>3||!Number.isInteger(ship.quantity)||ship.quantity<=0||!Array.isArray(ship.staffIds)||new Set(ship.staffIds).size!==ship.staffIds.length||ship.staffIds.some(id=>typeof id!=='string'||staffIds.has(id)))throw Error('Invalid shipment.');ship.staffIds.forEach(id=>staffIds.add(id));}
 if(withHistory){if(s.history!=null&&!Array.isArray(s.history))throw Error('Invalid history.');s.history=(s.history||[]).slice(-50).map(entry=>{if(!entry||typeof entry.id!=='string'||!validTimestamp(entry.at)||typeof entry.label!=='string'||!entry.before)throw Error('Invalid history entry.');const before=validateProfile({...entry.before,history:[]},false);delete before.history;return {...entry,label:entry.label.slice(0,240),before};});}else s.history=[];

 if(s.overrides&&Object.keys(s.overrides).length)throw Error('Unrecognized research overrides.');
 const validGoals=['all','cash','resource',...DATA.tasks.map(t=>String(t.id))];if(!validGoals.includes(s.goal)||!finite(s.target)||!Number.isInteger(s.goalResource)||s.goalResource<0||s.goalResource>3)throw Error('Invalid goal.');
 if(s.legacy!=null&&(!s.legacy||typeof s.legacy!=='object'||Array.isArray(s.legacy)||Object.values(s.legacy).some(value=>typeof value!=='boolean')))throw Error('Invalid supplemental research progress.');
 if(s.setupComplete&&(s.session.scheduled===null||!s.anchor))throw Error('Enter a first visit before finishing setup.');
 delete s.researchProgressCorrections;
 return {...defaults(DATA.tasks),...s,legacy:s.legacy||{},overrides:{}};
}
