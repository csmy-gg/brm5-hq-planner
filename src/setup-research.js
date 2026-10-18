
export function createSetupResearch({getState,commit,data}){
 const form=document.querySelector('#guide-research-form'),list=form.querySelector('.guide-research-list'),search=form.querySelector('input[type=search]'),message=form.querySelector('[role=status]'),count=form.querySelector('.guide-selection-count');
 let baseRevision,base=[],draft=[],dirty=false;
 const entries=data.tasks.map(t=>({key:'task:'+t.id,name:t.name,group:t.category,id:t.id}));
 const checked=(s,t)=>s.status[t.id].state==='done';
 function filter(){const query=search.value.trim().toLowerCase();list.querySelectorAll('label').forEach((el,i)=>el.hidden=!entries[i].name.toLowerCase().includes(query));}
 function updateCount(){count.textContent=draft.filter(Boolean).length+' selected as completed'+(dirty?' · unsaved':'');}
 function load(){const s=getState();baseRevision=s.revision;base=entries.map(t=>checked(s,t));draft=[...base];dirty=false;list.replaceChildren();
  entries.forEach((t,i)=>{const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span'),name=document.createElement('strong'),group=document.createElement('small');input.type='checkbox';input.checked=draft[i];input.dataset.selection=i;name.textContent=t.name;group.textContent=t.group;text.append(name,group);label.append(input,text);list.append(label);});
  filter();updateCount();
 }
 search.addEventListener('input',filter);
 list.addEventListener('change',e=>{if(e.target.dataset.selection===undefined)return;draft[Number(e.target.dataset.selection)]=e.target.checked;dirty=draft.some((x,i)=>x!==base[i]);updateCount();message.textContent='';});
 form.querySelector('[data-reload-selections]').onclick=()=>{load();message.textContent='Selections reloaded from saved progress.';};
 form.onsubmit=e=>{e.preventDefault();try{
   const s=getState();if(s.revision!==baseRevision)throw Error('Progress changed while you were selecting. Choose Reload saved selections, then review your choices.');
   const next=structuredClone(s);next.legacy??={};let changed=0;
   entries.forEach((t,i)=>{if(draft[i]===base[i])return;changed++;next.status[t.id]={state:draft[i]?'done':'todo'};});
   if(changed)commit(next,'Research setup: saved completed research selections.');
   load();message.textContent='Completed research saved. Cash and resources were kept as entered.';
  }catch(error){message.textContent=error.message;}
 };
 load();
 return {get hasDrafts(){return dirty;},sync(){if(!dirty)load();},reset(){load();message.textContent='';}};
}
