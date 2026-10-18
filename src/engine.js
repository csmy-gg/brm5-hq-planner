import {createEmptyProfile} from './empty-profile.js';
import {zonedTimestamp} from './time.js';
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
export function blocked(t,s,tasks,now=Date.now(),costsAlreadyPaid=false){
 const why=[]; if(s.status[t.id]?.state!=='todo')why.push('Already started or completed');
 if(t.deps.some(id=>s.status[id]?.state!=='done'))why.push('Complete prerequisites first');
 const power=tasks.filter(x=>s.status[x.id]?.state==='active').reduce((n,x)=>n+x.power,0);
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
export function forecast(state,data,now=Date.now(),limit=160){
 if(state.setupComplete===false||nextVisit(state)==null)return {rows:[],finished:false,finish:null,metrics:metrics(state,data.wiki),needsSetup:true};
 const s=normalizeDeliveries(stateSnapshot(state),data.wiki),tasks=tasksFor(s,data),m=metrics(s,data.wiki),ids=goalIds(s,tasks),rows=[];const scheduled=nextVisit(s),following=followingVisit(s,now);let t=Math.max(scheduled,now),finished=false;
 const need=()=>tasks.filter(x=>ids.has(x.id)&&s.status[x.id]?.state==='todo');
 const done=()=>s.goal==='cash'?s.cash>=s.target:s.goal==='resource'?s.res[s.goalResource]>=s.target:[...ids].every(id=>s.status[id]?.state==='done');
 if(done())return {rows,finished:true,finish:now,metrics:m};
 for(let k=0;k<limit;k++){
  if(k>0)t=following+(k-1)*s.interval*3600000;
  const projected=projectStock(s,t,m);s.res=projected.res;s.snapshot=t;
  const ready=s.ships.filter(x=>x.end<=t);const collected=ready.reduce((n,x)=>n+x.value,0);s.cash+=collected;s.ships=s.ships.filter(x=>x.end>t);
  const completes=tasks.filter(x=>s.status[x.id]?.state==='active'&&s.status[x.id].end<=t);completes.forEach(x=>s.status[x.id]={state:'done'});
  const before={cash:s.cash,res:[...s.res]};const starts=[];
  // Favor research that unlocks children, then cheaper research. Shared power is checked for every start.
  const candidates=need().sort((a,b)=>(tasks.filter(t=>t.deps.includes(b.id)).length-tasks.filter(t=>t.deps.includes(a.id)).length)||a.cost-b.cost);
  for(const task of candidates){if(blocked(task,s,tasks,t).length)continue;const n=start(s,task.id,tasks,t);Object.assign(s,n);starts.push(task);}
  // Ended five-second/zero-duration nodes are confirmed at the next visit, keeping dependencies gradual.
  const remaining=need(),demand=KEYS.map((_,i)=>remaining.reduce((n,x)=>n+x.res[i],0));
  const canSell=s.goal!=='resource'||s.goalResource!==2;
  const fuelNeeded=Math.max(remaining.length?Math.max(...remaining.map(x=>x.res[2])):0,Math.min(demand[2],30));
  const deliveryCapacity=freeDeliverySlots(s,data.wiki).reduce((n,x)=>n+x.capacity,0);let sold=0;if(canSell&&deliveryCapacity>0){sold=Math.max(0,Math.min(deliveryCapacity,Math.floor(s.res[2]-fuelNeeded)));if(sold)Object.assign(s,dispatch(s,2,sold,data.wiki,t));}
  const alloc=[0,0,0,0],target=demand.map((n,i)=>Math.min(n,i===1?24:i===3?45:i===0?24:45));
  if(s.goal==='resource')target[s.goalResource]=s.target;
  // Each worker is assigned to the largest production-time shortage. Fuel earns future research cash.
  const cashNeed=remaining.reduce((n,x)=>n+x.cost,0)+s.reserve-s.cash-s.ships.reduce((n,x)=>n+x.value,0);
  if(s.goal==='cash')target[2]=Math.max(target[2],Math.ceil((s.target-s.cash-s.ships.reduce((n,x)=>n+x.value,0))/150));
  else if(cashNeed>0)target[2]=Math.max(target[2],Math.min(90,Math.ceil(cashNeed/150)+fuelNeeded));
  for(let n=0;n<m.ops;n++){
   const scores=target.map((v,i)=>(v-s.res[i]-alloc[i]*m.rates[i]*s.interval/24*s.uptime/100)/Math.max(.01,m.rates[i]));
   const best=scores.indexOf(Math.max(...scores));if(scores[best]<=0)break;alloc[best]++;
  }
  // Limit projected production to storage headroom; unused staff can rest.
  let head=Math.max(0,m.capacity-s.res.reduce((a,b)=>a+b,0));
  for(const i of [1,3,0,2]){const unit=m.rates[i]*s.interval/24*s.uptime/100;if(unit>0){alloc[i]=Math.min(alloc[i],Math.max(0,Math.floor((head+1e-8)/unit)));head-=alloc[i]*unit;}}
  s.assign=alloc;
  rows.push({time:t,scheduledTime:k===0?scheduled:t,starts:starts.map(x=>x.id),completes:completes.map(x=>x.id),collected,sold,assign:[...alloc],before,after:{cash:s.cash,res:[...s.res]},capped:projected.capped});
  if(done()){finished=true;break;}
 }
 return {rows,finished,finish:finished?rows.at(-1)?.time:null,metrics:m};
}
