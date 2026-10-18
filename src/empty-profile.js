import {detectedTimezone} from './time.js';
export function createEmptyProfile(tasks,{now=Date.now(),timezone=detectedTimezone()}={}){
 const areas=['Operations','Delivery','Logistics','Defense','Infirmary','Training'];
 return {version:1,profileSchemaVersion:2,researchCatalogVersion:2,setupComplete:false,timezone,
  cash:0,res:[0,0,0,0],snapshot:now,staff:Object.fromEntries(areas.map(a=>[a,{}])),unavailable:Object.fromEntries(areas.map(a=>[a,0])),assign:[0,0,0,0],
  status:Object.fromEntries(tasks.map(t=>[t.id,{state:'todo'}])),legacy:{},ships:[],power:0,capacity:0,autoCapacity:true,reserve:0,
  uptime:90,raid:null,win:null,anchor:'',interval:12,session:{scheduled:null,completed:[]},goal:'all',target:0,goalResource:2,history:[],overrides:{}};
}
