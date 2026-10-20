// Pure planning decisions. Only the forecast applies these to a disposable copy of the HQ.
export const PLANNING_POLICIES=['critical','packing','duration','unlocks','legacy'];
export function researchPlanner(tasks,ids){
 const byId=new Map(tasks.map(t=>[t.id,t])),children=new Map(tasks.map(t=>[t.id,[]]));
 for(const task of tasks)if(ids.has(task.id))for(const parent of task.deps)children.get(parent)?.push(task.id);
 function ranks(state,now){
  const memo=new Map();
  function tail(id){if(memo.has(id))return memo.get(id);const task=byId.get(id),status=state.status[id];
   const own=status?.state==='done'?0:status?.state==='active'?Math.max(0,(status.end-now)/3600000):Math.max(task.hours,1/720);
   const next=(children.get(id)||[]).filter(child=>state.status[child]?.state!=='done');
   const value={hours:own+Math.max(0,...next.map(child=>tail(child).hours)),children:next.length};memo.set(id,value);return value;
  }
  tasks.forEach(t=>tail(t.id));return memo;
 }
 function ordered(candidates,rank,policy){return [...candidates].sort((a,b)=>{
  // Instant research can release its power before any positive-duration starts.
  if((a.hours===0)!==(b.hours===0))return a.hours===0?-1:1;
  if(policy==='duration')return b.hours-a.hours||rank.get(b.id).hours-rank.get(a.id).hours||a.cost-b.cost||a.id-b.id;
  if(policy==='legacy')return tasks.filter(t=>t.deps.includes(b.id)).length-tasks.filter(t=>t.deps.includes(a.id)).length||a.cost-b.cost||a.id-b.id;
  if(policy==='unlocks')return rank.get(b.id).children-rank.get(a.id).children||a.cost-b.cost||b.hours-a.hours||a.id-b.id;
  return rank.get(b.id).hours-rank.get(a.id).hours||b.hours-a.hours||rank.get(b.id).children-rank.get(a.id).children||a.cost-b.cost||a.id-b.id;
 });}
 function select(candidates,state,freePower,rank,policy){
  const order=ordered(candidates,rank,policy);if(policy!=='packing'||order.length<2)return order;
  // Bounded subset search compares combinations without blocking the interface.
  let beam=[{ids:[],power:0,cost:0,res:[0,0,0,0],score:0}];
  for(const task of order){const additions=[];
   for(const item of beam){const power=item.power+(task.hours===0?0:task.power),cost=item.cost+task.cost,res=item.res.map((n,i)=>n+task.res[i]);
    if(power>freePower||task.power>freePower||cost>state.cash-state.reserve+1e-7||res.some((n,i)=>n>state.res[i]+1e-7))continue;
    const critical=rank.get(task.id);additions.push({ids:[...item.ids,task.id],power,cost,res,score:item.score+(critical.hours+1)**2+critical.children});
   }
   beam=[...beam,...additions].sort((a,b)=>b.score-a.score||b.power-a.power||a.cost-b.cost).slice(0,32);
  }
  const chosen=new Set(beam[0].ids);return order.filter(t=>chosen.has(t.id));
 }
 return {ranks,ordered,select};
}

export function productionPlan(state,remaining,metrics,wiki,rank,policy){
 const demand=[0,1,2,3].map(i=>remaining.reduce((n,t)=>n+t.res[i],0));
 const largest=[0,1,2,3].map(i=>Math.max(0,...remaining.map(t=>t.res[i])));
 const frontier=remaining.filter(t=>t.deps.every(id=>['done','active'].includes(state.status[id]?.state))).sort((a,b)=>
  Number(b.deps.every(id=>state.status[id]?.state==='done'))-Number(a.deps.every(id=>state.status[id]?.state==='done'))||
  (rank.get(b.id)?.hours||0)-(rank.get(a.id)?.hours||0)||a.cost-b.cost);
 const focus=frontier.slice(0,policy==='legacy'?4:policy==='packing'?2:1);
 const primary=[0,1,2,3].map(i=>focus.reduce((n,t)=>n+t.res[i],0));
 const secondary=demand.map((n,i)=>Math.max(Math.min(n,[24,24,45,45][i]),largest[i]));
 const pending=(state.ships||[]).reduce((n,ship)=>n+ship.value,0),price=wiki.sellPrices.fuel;
 const cashNeed=state.goal==='cash'?Math.max(0,state.target-state.cash-pending):Math.max(0,remaining.reduce((n,t)=>n+t.cost,0)+state.reserve-state.cash-pending);
 const immediateCash=Math.max(0,focus.reduce((n,t)=>n+t.cost,0)+state.reserve-state.cash-pending);
 if(state.goal==='cash'){primary.fill(0);secondary.fill(0);primary[2]=cashNeed/price;}
 else if(state.goal==='resource'){primary.fill(0);secondary.fill(0);primary[state.goalResource]=state.target;}
 else {primary[2]+=immediateCash/price;secondary[2]=Math.max(secondary[2],largest[2]+Math.min(90,cashNeed/price));}
 const keep=demand.map((n,i)=>i===2?Math.min(n,Math.max(largest[i],30)):n);
 if(state.goal==='resource')keep[state.goalResource]=state.target;
 const missing=focus.length?Math.min(...focus.map(t=>t.res.reduce((n,c,i)=>n+Math.max(0,c-state.res[i]),0))):state.goal==='resource'?Math.max(0,state.target-state.res[state.goalResource]):0;
 const researchStock=demand.map((n,i)=>Math.min(n,Math.max(largest[i],focus.reduce((sum,t)=>sum+t.res[i],0))));
 return {primary,secondary,keep,researchStock,cashNeed,spaceNeed:Math.max(0,state.res.reduce((a,b)=>a+b,0)-metrics.capacity+Math.min(missing,metrics.capacity))};
}

// Couple a Fuel sale to its replacement staffing. These are disposable forecast
// states; no projected production or delivery payment enters the recorded HQ.
export function planDispatch(state,remaining,metrics,wiki,rank,policy,capacity,hours){
 const planningState={...state,interval:Math.max(0,hours)},makePlan=s=>productionPlan(s,remaining,metrics,wiki,rank,policy);
 const initial=makePlan(planningState),ordinary=chooseDelivery(planningState,initial,capacity,wiki);
 const afterSale=sale=>({...planningState,res:planningState.res.map((n,i)=>n-(i===sale?.resource?sale.quantity:0)),ships:[...(state.ships||[]),...(sale?[{value:sale.value}]:[])]});
 const result=sale=>{const next=afterSale(sale);return {sale,allocation:planAssignments(next,makePlan(next),metrics)};};
 const baseline=result(null);
 if(state.productionBuffer==='minimum'||state.goal==='resource'||!initial.cashNeed||capacity<=0||hours<=0||!baseline.allocation.buffer.enabled)return result(ordinary);
 // Worst distribution of a loss of half the assigned staff: for each resource,
 // remove those workers there first, while other resources still fill storage.
 const lossStock=(s,assign)=>{
  const losses=Math.ceil(assign.reduce((a,b)=>a+b,0)/2),head=Math.max(0,metrics.capacity-s.res.reduce((a,b)=>a+b,0));
  return assign.map((_,resource)=>{
   const gain=assign.map((n,i)=>Math.max(0,n-(i===resource?losses:0))*metrics.rates[i]*hours/24*s.uptime/100),sum=gain.reduce((a,b)=>a+b,0);
   return s.res[resource]+gain[resource]*(sum>head?head/sum:1);
  });
 };
 const baseStock=lossStock(planningState,baseline.allocation.assign);
 const protectedStock=baseStock.map((n,i)=>Math.min(n,i===2?initial.researchStock[i]:initial.keep[i]));
 const max=Math.max(0,Math.min(Math.floor(state.res[2]+1e-7),capacity,Math.ceil(initial.cashNeed/wiki.sellPrices.fuel)));
 // Exhaustive for normal small shipments; bounded for unusually large imports.
 const quantities=new Set(Array.from({length:Math.min(max,64)},(_,i)=>Math.floor(max*(64-i)/64)));
 if(max<=64){quantities.clear();for(let n=max;n>0;n--)quantities.add(n);}
 for(const quantity of quantities){
  if(!quantity)continue;
  const sale={resource:2,quantity,value:quantity*wiki.sellPrices.fuel};
  if(ordinary&&(initial.spaceNeed?ordinary.quantity>quantity||ordinary.quantity===quantity&&ordinary.value>=sale.value:ordinary.value>=sale.value))continue;
  const candidate=result(sale),next=afterSale(sale),stock=lossStock(next,candidate.allocation.assign);
  if(stock.some((n,i)=>n+1e-7<protectedStock[i]))continue;
  // A sale beyond the ordinary reserve needs actual replacement production.
  const relaxed=quantity>Math.max(0,state.res[2]-initial.keep[2]);
  if(relaxed&&stock[2]+1e-7<Math.min(state.res[2],initial.keep[2]))continue;
  candidate.sale={...sale,replenishment:{hours,workerLoss:Math.ceil(candidate.allocation.assign.reduce((a,b)=>a+b,0)/2),fuel:stock[2],protectedFuel:Math.max(protectedStock[2],Math.min(state.res[2],initial.keep[2]))}};
  return candidate;
 }
 return result(ordinary);
}

export function chooseDelivery(state,plan,capacity,wiki){
 if(capacity<=0||(!plan.cashNeed&&!plan.spaceNeed))return null;
 const candidates=[];
 for(let i=0;i<4;i++){
  const price=wiki.sellPrices[['cm','pm','fuel','equipment'][i]],surplus=Math.max(0,Math.floor(state.res[i]-plan.keep[i]+1e-7));
  const quantity=Math.min(surplus,capacity,Math.max(Math.ceil(plan.spaceNeed),Math.ceil(plan.cashNeed/price)));
  if(quantity>0)candidates.push({resource:i,quantity,value:quantity*price});
 }
 candidates.sort((a,b)=>plan.spaceNeed?(b.quantity-a.quantity||b.value-a.value):(b.value-a.value||a.quantity-b.quantity));
 return candidates[0]||null;
}

export function chooseAssignments(state,plan,metrics){
 const alloc=[0,0,0,0],head=Math.max(0,metrics.capacity-state.res.reduce((a,b)=>a+b,0));if(!head||!metrics.ops)return alloc;
 const units=metrics.rates.map(rate=>rate*state.interval/24*state.uptime/100);
 let gain=0;
 for(let n=0;n<Math.min(metrics.ops,4000)&&gain<head-1e-7;n++){
  const scores=target=>target.map((v,i)=>units[i]>0&&alloc[i]<1000?Math.max(0,v-state.res[i]-alloc[i]*units[i])/metrics.rates[i]:0);
  let values=scores(plan.primary);if(!values.some(n=>n>1e-7))values=scores(plan.secondary);
  const best=values.indexOf(Math.max(...values));if(values[best]<=1e-7)break;
  alloc[best]++;gain+=units[best];
 }
 // The last worker may fill storage partway through the interval; projectStock caps output.
 return alloc;
}

export function planAssignments(state,plan,metrics){
 const base=chooseAssignments(state,plan,metrics),total=base.reduce((a,b)=>a+b,0),head=Math.max(0,metrics.capacity-state.res.reduce((a,b)=>a+b,0));
 const risk=state.uptime<100||(state.unavailable?.Operations||0)>0||(state.raid!==0&&state.win!==100);
 const result={assign:base,buffer:{extra:0,base,enabled:state.productionBuffer!=='minimum'&&risk}};
 const available=Math.min(metrics.ops,4000);
 if(!result.buffer.enabled||!total||total>=available||!head)return result;
 const units=metrics.rates.map(rate=>rate*state.interval/24*state.uptime/100);
 const projected=assign=>{const raw=assign.map((n,i)=>n*units[i]),sum=raw.reduce((a,b)=>a+b,0),scale=sum>head?head/sum:1;return raw.map(n=>n*scale);};
 const protectedGain=projected(base);
 const hours=assign=>Math.max(0,...protectedGain.map((n,i)=>n?state.interval*n/(assign[i]*units[i]):0));
 let best=base,bestHours=hours(base);
 const consider=assign=>{
  if(assign.some((n,i)=>!Number.isInteger(n)||n<base[i]||n>1000)||assign.reduce((a,b)=>a+b,0)>available)return;
  // Shared storage must never crowd out any resource the minimum plan would produce.
  if(projected(assign).some((n,i)=>n+1e-7<protectedGain[i]))return;
  const time=hours(assign),size=assign.reduce((a,b)=>a+b,0);
  if(time<bestHours-1e-7||(Math.abs(time-bestHours)<1e-7&&size>best.reduce((a,b)=>a+b,0))){best=assign;bestHours=time;}
 };
 // Exact multiples preserve the resource mix even when shared storage fills.
 const gcd=(a,b)=>b?gcd(b,a%b):a,divisor=base.reduce(gcd,0),ratio=base.map(n=>n/divisor),ratioTotal=total/divisor;
 const multiple=Math.min(Math.floor(available/ratioTotal),...ratio.filter(Boolean).map(n=>Math.floor(1000/n)));
 consider(ratio.map(n=>n*multiple));
 // Check a bounded set of nearby proportional allocations when staff cannot divide evenly.
 for(let size=available;size>total&&size>=available-4;size--){
  const scaled=base.map(n=>n*size/total);
  for(let mask=0;mask<16;mask++)consider(scaled.map((n,i)=>(mask&(1<<i))?Math.ceil(n):Math.floor(n)));
 }
 result.assign=best;result.buffer={...result.buffer,extra:best.reduce((a,b)=>a+b,0)-total,minimumHours:hours(base),bufferedHours:bestHours};
 return result;
}
