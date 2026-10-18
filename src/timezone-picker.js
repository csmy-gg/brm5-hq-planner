import locations from './timezone-data.json' with {type:'json'};
import {validTimezone,detectedTimezone} from './time.js';
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function timezoneOffset(zone,now=Date.now()){return new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(now).find(part=>part.type==='timeZoneName').value.replace('GMT','UTC');}
export function searchTimezones(query,selected='UTC',now=Date.now()){
  const q=normalize(query.trim()),entries=locations.filter(entry=>validTimezone(entry.id));
  if(validTimezone(selected)&&!entries.some(entry=>entry.id===selected))entries.unshift({id:selected,city:selected.split('/').at(-1).replaceAll('_',' '),countries:[]});
  return entries.filter(entry=>!q||normalize([entry.id,entry.city,...entry.countries,...(entry.id==='Europe/Prague'?['Czechia','Slovakia']:[])].join(' ')).includes(q)).map(entry=>({...entry,label:`${entry.city} · ${entry.countries.join(', ')||'Worldwide'} · ${timezoneOffset(entry.id,now)} · ${entry.id}`}));
}
export function mapClusters(entries){const clusters=new Map();for(const entry of entries){if(entry.id==='UTC'||!Number.isFinite(entry.lat)||!Number.isFinite(entry.lon))continue;const x=(entry.lon+180)*2,y=(90-entry.lat)*2,key=Math.round(x/48)+':'+Math.round(y/48);if(!clusters.has(key))clusters.set(key,{x:0,y:0,entries:[]});const cluster=clusters.get(key);cluster.entries.push(entry);cluster.x+=x;cluster.y+=y;}return [...clusters.values()].map(c=>({...c,x:c.x/c.entries.length,y:c.y/c.entries.length}));}
export function createTimezonePicker(input,container,onChange=()=>{}){
  input.removeAttribute('list');input.type='hidden';
  const ownLabel=input.closest('label');ownLabel?.classList.add('timezone-value-label');
  container.innerHTML='<label for="timezone-search">Find a city, country or timezone</label><input type="search" id="timezone-search" placeholder="Try Prague, Czechia or Europe/Prague" autocomplete="off"><label for="timezone-choice">Matching timezones</label><select id="timezone-choice" size="5"></select><button type="button" class="ghost" id="detect-timezone">Use my device timezone</button><p id="timezone-preview" class="timezone-preview"></p><details class="timezone-map-details"><summary>Choose a city on the world map</summary><p class="hint">Markers group nearby cities. Choose a marker, then an exact timezone. Search works without the map.</p><div class="timezone-map" role="group" aria-label="World timezone city map"><img src="/world-map.svg" alt="World land outline" width="720" height="360"><svg id="timezone-markers" viewBox="0 0 720 360" aria-hidden="true"></svg><div id="timezone-map-buttons"></div></div><div id="timezone-map-candidates" class="timezone-candidates" aria-live="polite"></div></details>';
  const search=container.querySelector('#timezone-search'),select=container.querySelector('#timezone-choice'),preview=container.querySelector('#timezone-preview');
  function selected(){preview.textContent=`Selected: ${input.value} · ${timezoneOffset(input.value)} · local time ${new Intl.DateTimeFormat('en-GB',{timeZone:input.value,dateStyle:'medium',timeStyle:'short'}).format(Date.now())}`;select.value=input.value;}
  function options(){const result=searchTimezones(search.value,input.value);select.replaceChildren();for(const entry of result){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.label;select.append(option);}select.value=input.value;if(!result.length){const option=document.createElement('option');option.textContent='No matching timezones. Try a city or country.';option.disabled=true;select.append(option);}}
  function choose(zone){if(!validTimezone(zone))return;input.value=zone;search.value='';options();selected();input.dispatchEvent(new Event('change',{bubbles:true}));onChange();}
  search.addEventListener('input',options);select.addEventListener('change',()=>choose(select.value));
  container.querySelector('#detect-timezone').onclick=()=>choose(detectedTimezone());
  const markerContainer=container.querySelector('#timezone-map-buttons');
  const clusters=mapClusters(locations.filter(entry=>validTimezone(entry.id)));
  for(const cluster of clusters){
    const button=document.createElement('button');button.type='button';button.className='timezone-marker';button.style.left=cluster.x/720*100+'%';button.style.top=cluster.y/360*100+'%';button.setAttribute('aria-label',`Choose ${cluster.entries.length===1?cluster.entries[0].city:cluster.entries.length+' nearby cities'}`);button.title=cluster.entries.map(e=>e.city).join(', ');button.textContent=cluster.entries.length>1?String(cluster.entries.length):'•';
    button.onclick=()=>{const candidates=container.querySelector('#timezone-map-candidates');candidates.replaceChildren();const title=document.createElement('p');title.textContent='Choose your city’s timezone:';candidates.append(title);const bounds=markerContainer.parentElement.getBoundingClientRect(),target=button.getBoundingClientRect().width,nearby=clusters.filter(other=>Math.abs(other.x-cluster.x)*bounds.width/720<target&&Math.abs(other.y-cluster.y)*bounds.height/360<target);const entries=[...new Map(nearby.flatMap(other=>other.entries).map(entry=>[entry.id,entry])).values()];for(const entry of entries){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=`${entry.city} · ${entry.id} · ${timezoneOffset(entry.id)}`;b.onclick=()=>{choose(entry.id);preview.focus();};candidates.append(b);}candidates.querySelector('button')?.focus();};markerContainer.append(button);
  }
  preview.tabIndex=-1;
  return {sync(){if(!validTimezone(input.value))input.value=detectedTimezone();search.value='';options();selected();}};
}
