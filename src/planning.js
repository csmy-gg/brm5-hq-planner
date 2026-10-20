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
 return {primary,secondary,keep,cashNeed,spaceNeed:Math.max(0,state.res.reduce((a,b)=>a+b,0)-metrics.capacity+Math.min(missing,metrics.capacity))};
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
