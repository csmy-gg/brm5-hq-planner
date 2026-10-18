import {clone,AREAS,count,start,collect,dispatch,tasksFor,finishSession} from './engine.js';

const validAmount=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const validCount=n=>Number.isInteger(n)&&n>=0&&n<=1000;
function fitAssignments(s){let available=count(s,'Operations');s.assign=s.assign.map(n=>{const fitted=Math.min(n,available);available-=fitted;return fitted;});}

// Every operation returns a new state. A failed operation or batch leaves the original untouched.
export function applySessionAction(state,action,data,now=Date.now()){
 if(action.token&&state.session.actionKeys?.includes(action.token))throw Error('This action has already been recorded.');
 let next=clone(state);
 switch(action.type){
  case 'balances':
   if(!validAmount(action.cash)||!Array.isArray(action.res)||action.res.length!==4||!action.res.every(validAmount))throw Error('Enter valid, nonnegative cash and resource totals.');
   next.cash=action.cash;next.res=[...action.res];next.snapshot=now;break;
  case 'collect':next=collect(state,now,action.id,Boolean(action.alreadyReflected));break;
  case 'dispatch':next=dispatch(state,action.resource,action.quantity,data.wiki,now,Boolean(action.alreadyReflected));break;
  case 'research-start':next=start(state,action.id,tasksFor(state,data),now,Boolean(action.alreadyReflected));break;
  case 'research-complete':
   if(next.status[action.id]?.state!=='active')throw Error('This research is not active or was already completed.');
   next.status[action.id]={state:'done'};break;
  case 'assign':
   if(!Array.isArray(action.assign)||action.assign.length!==4||!action.assign.every(validCount)||action.assign.reduce((n,x)=>n+x,0)>count(next,'Operations'))throw Error('Operations assignments must fit your available staff.');
   next.assign=[...action.assign];break;
  case 'unavailable':
   for(const area of AREAS){const n=action.values?.[area],total=Object.values(next.staff[area]).reduce((n,x)=>n+x,0);if(!validCount(n)||n>total)throw Error('Unavailable '+area+' staff must be between 0 and '+total+'.');next.unavailable[area]=n;}
   fitAssignments(next);break;
  case 'staff-ranks':
   if(!AREAS.includes(action.area)||!action.ranks||Object.entries(action.ranks).some(([rank,n])=>!data.wiki.staff[rank]||!validCount(n)))throw Error('Enter valid staff ranks and counts.');
   next.staff[action.area]={...action.ranks};next.unavailable[action.area]=Math.min(next.unavailable[action.area],Object.values(action.ranks).reduce((n,x)=>n+x,0));fitAssignments(next);break;
  case 'timer': {
   if(!Number.isInteger(action.hours)||action.hours<0||action.hours>8760||!Number.isInteger(action.minutes)||action.minutes<0||action.minutes>59)throw Error('Use whole hours from 0 to 8760 and minutes from 0 to 59.');
   const end=now+(action.hours*60+action.minutes)*60000;
   if(action.kind==='delivery'){const ship=next.ships.find(x=>x.id===action.id);if(!ship)throw Error('This delivery was already collected.');ship.end=end;}
   else if(action.kind==='research'&&next.status[action.id]?.state==='active')next.status[action.id].end=end;
   else throw Error('This research is no longer active.');break;
  }
  case 'finish':next=finishSession(next,action.scheduled,now);break;
  default:throw Error('Unknown session action.');
 }
 if(action.token){next.session.actionKeys=[...(next.session.actionKeys||[]),action.token].slice(-200);if(action.type==='dispatch')next.ships.at(-1).recordToken=action.token;}
 return next;
}

export function applySessionBatch(state,actions,data,now=Date.now()){
 let next=state;for(const action of actions)next=applySessionAction(next,action,data,now);return next;
}
