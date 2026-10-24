import {validateSchedule,visitPreview} from './schedule.js';

export function createScheduleControls(container,{getState,onEdit}){
 const root=document.createElement('div');root.className='visit-schedule-controls';
 root.innerHTML='<label>Schedule type<select id="schedule-mode" form="settings"><option value="interval">Every X hours</option><option value="daily">Specific times each day</option></select></label><div id="interval-visit-fields" class="settings-grid"></div><section id="daily-visit-fields" hidden aria-label="Daily visit times"><p class="hint">Choose 1–8 times, repeated each day in your selected timezone.</p><div id="daily-visit-times"></div><button type="button" id="add-visit-time" class="ghost">Add time</button><p class="hint">Your unfinished current session stays in place. New daily times apply to later visits.</p></section><p id="schedule-error" class="error" role="alert"></p><section class="visit-preview" aria-label="Draft visit preview"><h4>Next four visits · preview</h4><p class="hint">Changes apply only when you save. The current session may already be due.</p><ol id="visit-preview-list"></ol><p id="visit-preview-note" class="hint"></p></section>';
 container.prepend(root);
 const find=selector=>root.querySelector(selector),mode=find('#schedule-mode'),list=find('#daily-visit-times'),add=find('#add-visit-time'),error=find('#schedule-error');
 for(const id of ['anchor','interval'])find('#interval-visit-fields').append(document.getElementById(id).closest('label'));
 let nextId=0;
 function refreshRows(){
  [...list.children].forEach((row,i)=>{row.querySelector('label').firstChild.textContent=`Visit ${i+1}`;row.querySelector('button').setAttribute('aria-label',`Remove visit ${i+1}`);row.querySelector('button').disabled=list.children.length===1;});
  add.disabled=list.children.length>=8;
 }
 function addRow(value=''){
  const row=document.createElement('div');row.className='daily-time-row';
  const label=document.createElement('label');label.append(document.createTextNode('Visit'));
  const input=document.createElement('input');input.type='time';input.step='60';input.id='daily-visit-'+nextId++;input.setAttribute('form','settings');input.value=value;input.setAttribute('aria-describedby','schedule-error');label.append(input);
  const remove=document.createElement('button');remove.type='button';remove.className='ghost';remove.textContent='Remove';
  remove.onclick=()=>{const target=row.nextElementSibling||row.previousElementSibling;row.remove();refreshRows();target?.querySelector('input').focus();onEdit();preview();};
  row.append(label,remove);list.append(row);refreshRows();return input;
 }
 function toggle(){
  const daily=mode.value==='daily';find('#interval-visit-fields').hidden=daily;find('#daily-visit-fields').hidden=!daily;
  document.getElementById('anchor').disabled=daily;document.getElementById('interval').disabled=daily;
  document.getElementById('anchor').required=!daily&&getState().setupComplete;
  for(const input of list.querySelectorAll('input')){input.disabled=!daily;input.required=daily;}
 }
 function read(visitMinutes){
  try{const result=validateSchedule({mode:mode.value,times:mode.value==='daily'?[...list.querySelectorAll('input')].map(input=>input.value):[]},visitMinutes);error.textContent='';return result;}
  catch(problem){error.textContent=problem.message;throw problem;}
 }
 function preview(){
  toggle();const output=find('#visit-preview-list'),note=find('#visit-preview-note');output.replaceChildren();note.textContent='';
  try{
   const before=getState(),draft={...before,anchor:document.getElementById('anchor').value,interval:Number(document.getElementById('interval').value),timezone:document.getElementById('timezone').value,visitMinutes:Number(document.getElementById('visitMinutes').value)};
   draft.schedule=read(draft.visitMinutes);
   const rows=visitPreview(before,draft),format=new Intl.DateTimeFormat(undefined,{timeZone:draft.timezone,weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
   for(const row of rows){const li=document.createElement('li');li.textContent=format.format(row.time)+(row.gapHours===null?'':` · ${Number(row.gapHours.toFixed(2))} hours after previous visit`);output.append(li);}
   note.textContent=[...new Set(rows.flatMap(row=>row.warnings))].join(' ')||(!rows.length?'Choose a first visit to create your plan.':'');
  }catch(problem){error.textContent=problem.message;}
 }
 mode.onchange=()=>{if(mode.value==='daily'&&!list.children.length)addRow(document.getElementById('anchor').value.slice(11,16)||'14:00');onEdit();preview();};
 add.onclick=()=>{const input=addRow();toggle();input.focus();onEdit();preview();};
 root.addEventListener('input',()=>preview());
 return {read,preview,fill(state){mode.value=state.schedule?.mode||'interval';list.replaceChildren();for(const time of state.schedule?.times||[])addRow(time);preview();}};
}
