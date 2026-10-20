import {createEmptyProfile} from './empty-profile.js';
import {zonedTimestamp,validTimestamp} from './time.js';
import {PLANNING_POLICIES,researchPlanner,productionPlan,chooseDelivery,planAssignments} from './planning.js';
export const KEYS=['cm','pm','fuel','equipment'];
export const LABELS=['Construction Materials','Precious Metals','Fuel','Equipment'];
export const AREAS=['Operations','Delivery','Logistics','Defense','Infirmary','Training'];
export const clone=x=>JSON.parse(JSON.stringify(x));
export const defaults=createEmptyProfile;
export const count=(s,a)=>Math.max(0,Object.values(s.staff[a]).reduce((a,b)=>a+b,0)-(s.unavailable[a]||0));
export function metrics(s,wiki){
 const sum=(a,f)=>Object.entries(s.staff[a]).reduce((n,[r,c])=>n+c*f(wiki.staff[r]),0);
 const cap=s.autoCapacity?Math.max(0,sum('Logistics',x=>x.storage)-(s.unavailable.Logistics||0)*20):s.capacity;
 const delivery=Math.max(0,sum('Delivery',x=>x.deliveryUnitCapacityConservative)-(s.unavailable.Delivery||0)*30);
 const n=Object.values(s.staff.Operations).reduce((a,b)=>a+b,0);
 const rates=KEYS.map(k=>n?sum('Operations',x=>x.operationsPerDay[k])/n:0);
 return {capacity:cap,delivery,rates,ops:count(s,'Operations')};
}
export function tasksFor(s,data){return data.tasks.map(t=>({...t,...s.overrides?.[t.id]}));}
export function goalIds(s,tasks){
 if(s.goal==='cash'||s.goal==='resource')return new Set();
 if(s.goal==='all')return new Set(tasks.map(t=>t.id));
 const ids=new Set(),visit=id=>{if(ids.has(id))return; ids.add(id);tasks.find(t=>t.id===id)?.deps.forEach(visit);}; visit(Number(s.goal));return ids;
}
// Elapsed timers keep their recorded active status until confirmed, but no longer occupy power.
export function researchPowerUsed(s,tasks,now=Date.now()){
 return tasks.filter(t=>s.status[t.id]?.state==='active'&&!(s.status[t.id].end<=now)).reduce((sum,t)=>sum+t.power,0);
}
export function blocked(t,s,tasks,now=Date.now(),costsAlreadyPaid=false){
 const why=[]; if(s.status[t.id]?.state!=='todo')why.push('Already started or completed');
 if(t.deps.some(id=>s.status[id]?.state!=='done'))why.push('Complete prerequisites first');
 const power=researchPowerUsed(s,tasks,now);
 if(power+t.power>s.power)why.push('Not enough free research power');
 if(!costsAlreadyPaid&&s.cash-t.cost<s.reserve)why.push('Cash would fall below your reserve');
 t.res.forEach((n,i)=>{if(!costsAlreadyPaid&&n>s.res[i]+1e-6)why.push(`Need ${Math.ceil(n-s.res[i])} more ${LABELS[i]}`);});
 return why;
}
export function start(s,id,tasks,now=Date.now(),costsAlreadyPaid=false){
 const t=tasks.find(t=>t.id===id); if(!t)throw Error('Unknown research');const why=blocked(t,s,tasks,now,costsAlreadyPaid); if(why.length)throw Error(why.join('. '));
 const x=clone(s);if(!costsAlreadyPaid){x.snapshot=now;x.cash-=t.cost;x.res=x.res.map((n,i)=>n-t.res[i]);}x.status[id]={state:'active',end:now+t.hours*3600000};return x;
}
export function deliverySlots(s,wiki){
 const slots=[];for(const rank of Object.keys(wiki.staff).reverse())for(let i=0;i<(s.staff.Delivery[rank]||0);i++)slots.push({id:rank+':'+i,capacity:wiki.staff[rank].deliveryUnitCapacityConservative});
 return slots.slice(s.unavailable.Delivery||0);
}
export function normalizeDeliveries(s,wiki){
 const x=clone(s);if(!Array.isArray(x.ships)){x.ships=[];if(x.ship){let capacity=0;const staffIds=[];for(const worker of deliverySlots(x,wiki)){staffIds.push(worker.id);capacity+=worker.capacity;if(capacity>=x.ship.quantity)break;}x.ships.push({...x.ship,id:'legacy-delivery',staffIds});}}
 delete x.ship;return x;
}
export function freeDeliverySlots(s,wiki){const busy=new Set((s.ships||[]).flatMap(x=>x.staffIds));return deliverySlots(s,wiki).filter(x=>!busy.has(x.id));}
export function dispatch(s,resource,qty,wiki,now=Date.now(),alreadyReflected=false){
 const x=normalizeDeliveries(s,wiki),free=freeDeliverySlots(x,wiki),capacity=free.reduce((n,x)=>n+x.capacity,0);
 if(!Number.isInteger(resource)||resource<0||resource>3||!Number.isInteger(qty)||qty<=0||(!alreadyReflected&&qty>x.res[resource])||qty>capacity)throw Error('Choose a whole quantity within your stock and available delivery staff capacity.');
 let assigned=0;const staffIds=[];for(const worker of free){staffIds.push(worker.id);assigned+=worker.capacity;if(assigned>=qty)break;}
 if(!alreadyReflected){x.snapshot=now;x.res[resource]-=qty;}x.ships.push({id:'delivery-'+now+'-'+Math.random().toString(36).slice(2,9),staffIds,resource,quantity:qty,value:qty*wiki.sellPrices[KEYS[resource]],end:now+wiki.deliveryHours*3600000});return x;
}
export function collect(s,now=Date.now(),id,alreadyReflected=false){
 const x=clone(s),shipment=x.ships?.find(t=>id?t.id===id:t.end<=now);
 if(!shipment||shipment.end>now)throw Error('This delivery is not ready or was already collected.');if(!alreadyReflected)x.cash+=shipment.value;x.ships=x.ships.filter(t=>t.id!==shipment.id);return x;
}
export function stateSnapshot(s){const x=clone(s);delete x.history;return x;}
export function recordHistory(previous,next,label,now=Date.now()){
 const x=clone(next);x.history=[...(previous.history||[]),{id:'action-'+now+'-'+Math.random().toString(36).slice(2,9),at:now,label:String(label).slice(0,240),before:stateSnapshot(previous)}].slice(-50);return x;
}
export function restoreHistory(s,id){const entry=s.history?.find(x=>x.id===id);if(!entry)throw Error('History entry is no longer available.');return {...clone(entry.before),history:clone(s.history)};}
// Compatibility helper for legacy backups. New profiles carry their own timezone.
export const pragueTimestamp=input=>zonedTimestamp(input,'Europe/Prague');
export function nextVisit(s){return s.session?.scheduled??(s.anchor?zonedTimestamp(s.anchor,s.timezone||'Europe/Prague'):null);}
export function followingVisit(s,now=Date.now()){
 const current=nextVisit(s),step=s.interval*3600000;return current+Math.max(1,Math.floor((now-current)/step)+1)*step;
}
export function finishSession(s,expectedScheduled,now=Date.now()){
 const scheduled=nextVisit(s);if(scheduled==null)throw Error('Finish setup before completing a session.');if(scheduled!==expectedScheduled)throw Error('This session has already advanced. Review the current session.');
 const x=clone(s);x.session={scheduled:followingVisit(s,now),completed:[...(s.session?.completed||[]),{scheduled,finishedAt:now}].slice(-200)};return x;
}
export function projectStock(s,until,m){
 const hours=Math.max(0,(until-s.snapshot)/3600000),gain=s.assign.map((n,i)=>n*m.rates[i]*hours/24*s.uptime/100);
 const free=Math.max(0,m.capacity-s.res.reduce((a,b)=>a+b,0)),total=gain.reduce((a,b)=>a+b,0),factor=total>free?free/total:1;
 return {res:s.res.map((n,i)=>n+gain[i]*factor),capped:total>free+1e-6};
}

function simulateForecast(state,data,now,limit,policy,planner,tasks,m,ids){
 const s=normalizeDeliveries(stateSnapshot(state),data.wiki),rows=[],scheduled=nextVisit(s),following=followingVisit(s,now);
 const needed=()=>tasks.filter(task=>ids.has(task.id)&&s.status[task.id]?.state==='todo');
 const achieved=()=>s.goal==='cash'?s.cash>=s.target:s.goal==='resource'?s.res[s.goalResource]>=s.target:[...ids].every(id=>s.status[id]?.state==='done');
 if(achieved())return {rows,finished:true,finish:now,metrics:m,policy};
 const visitMinutes=state.visitMinutes??5,maxHours=Math.max(data.wiki.deliveryHours,...tasks.map(t=>t.hours));
 let finished=false,finish=null;
 for(let k=0;k<limit;k++){
  const scheduledTime=k===0?scheduled:following+(k-1)*state.interval*3600000;
  const time=Math.max(scheduledTime,now,rows.at(-1)?.visitEnd??-Infinity),windowEnd=time+visitMinutes*60000;
  if(!validTimestamp(time)||!validTimestamp(windowEnd+maxHours*3600000))break;
  const row={time,scheduledTime,visitMinutes,starts:[],completes:[],researchSteps:[],completionSteps:[],events:[],collected:0,sold:0,delivery:null,capped:false};
  let at=time;
  for(let event=0;event<tasks.length*3+(s.ships?.length||0)+4;event++){
   const projected=projectStock(s,at,m);s.res=projected.res;s.snapshot=at;row.capped||=projected.capped;
   const arrived=s.ships.filter(ship=>ship.end<=at);row.collected+=arrived.reduce((n,ship)=>n+ship.value,0);s.cash+=arrived.reduce((n,ship)=>n+ship.value,0);for(const ship of arrived)row.events.push({type:'collect',id:ship.id,at});s.ships=s.ships.filter(ship=>ship.end>at);
   for(const task of tasks)if(s.status[task.id]?.state==='active'&&s.status[task.id].end<=at){s.status[task.id]={state:'done'};row.completes.push(task.id);row.completionSteps.push({id:task.id,at});row.events.push({type:'research-complete',id:task.id,at});}
   row.before??={cash:s.cash,res:[...s.res]};
   if(achieved()){finished=true;finish=at;break;}
   const rank=planner.ranks(s,at),eligible=needed().filter(task=>!blocked(task,s,tasks,at).length);
   const batch=planner.select(eligible,s,Math.max(0,s.power-researchPowerUsed(s,tasks,at)),rank,policy);
   let started=false;
   for(const task of batch){if(blocked(task,s,tasks,at).length)continue;Object.assign(s,start(s,task.id,tasks,at));row.starts.push(task.id);row.researchSteps.push({id:task.id,at,end:s.status[task.id].end});row.events.push({type:'research-start',id:task.id,at});started=true;}
   // Confirm instant nodes in the disposable simulation before choosing newly unlocked work.
   if(started&&tasks.some(task=>s.status[task.id]?.state==='active'&&s.status[task.id].end<=at))continue;
   const upcoming=[...tasks.filter(task=>s.status[task.id]?.state==='active').map(task=>s.status[task.id].end),...s.ships.map(ship=>ship.end)].filter(end=>end>at&&end<=windowEnd);
   if(!upcoming.length)break;
   at=Math.min(...upcoming);
  }
  if(!finished){
   const rank=planner.ranks(s,at),remaining=needed();let production=productionPlan(s,remaining,m,data.wiki,rank,policy);
   const capacity=freeDeliverySlots(s,data.wiki).reduce((n,worker)=>n+worker.capacity,0),sale=chooseDelivery(s,production,capacity,data.wiki);
   if(sale){Object.assign(s,dispatch(s,sale.resource,sale.quantity,data.wiki,at));row.delivery={...sale,at};row.sold=sale.resource===2?sale.quantity:0;row.events.push({type:'dispatch',...sale,id:s.ships.at(-1).id,at});production=productionPlan(s,remaining,m,data.wiki,rank,policy);}
   const allocation=planAssignments(s,production,m);s.assign=allocation.assign;row.productionBuffer=allocation.buffer;
  }
  row.assign=[...s.assign];row.after={cash:s.cash,res:[...s.res]};row.visitEnd=at;rows.push(row);
  if(finished)break;
 }
 const progress=[...ids].reduce((n,id)=>n+(s.status[id]?.state==='done'?2:s.status[id]?.state==='active'?1:0),0);
 const targetProgress=s.goal==='cash'?s.cash:s.goal==='resource'?s.res[s.goalResource]:progress;
 return {rows,finished,finish,metrics:m,policy,progress:targetProgress};
}
export function forecast(state,data,now=Date.now(),limit=160){
 const m=metrics(state,data.wiki);
 if(state.setupComplete===false||nextVisit(state)==null)return {rows:[],finished:false,finish:null,metrics:m,needsSetup:true};
 const tasks=tasksFor(state,data),ids=goalIds(state,tasks),planner=researchPlanner(tasks,ids);
 const policies=(state.goal==='cash'||state.goal==='resource')?['critical']:PLANNING_POLICIES;
 const results=policies.map(policy=>simulateForecast(state,data,now,limit,policy,planner,tasks,m,ids));
 results.sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.finish-b.finish:(b.progress||0)-(a.progress||0))||a.rows.filter(row=>row.delivery).length-b.rows.filter(row=>row.delivery).length||a.rows.length-b.rows.length);
 return {...results[0],comparedPlans:results.length};
}
