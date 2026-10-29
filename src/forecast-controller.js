import {forecast} from './engine.js';

export function planningSnapshot(profile){const {history,...planning}=profile;return structuredClone(planning);}
export function forecastKey(profile,at,identity='guest'){
 const snapshot=planningSnapshot(profile);
 const deadlines=[...Object.values(snapshot.status||{}).filter(t=>t.state==='active').map(t=>t.end),...(snapshot.ships||[]).map(s=>s.end),snapshot.session?.scheduled].filter(Number.isFinite);
 return identity+'|'+JSON.stringify(snapshot)+'|'+Math.floor(at/60000)+'|'+deadlines.map(t=>Number(t<=at)).join('');
}

export function createForecastController({data,compute,onChange=()=>{},workerFactory,now=Date.now}={}){
 let worker=null,workerFailed=false,serial=0,pending=null,latest=null,identity=null,error=null;
 const callbacks=new Map();
 function failWorker(){workerFailed=true;worker?.terminate();worker=null;const waiting=[...callbacks.values()];callbacks.clear();for(const entry of waiting)entry.reject(Error('Worker unavailable'));}
 function workerCompute(profile,at){
  if(workerFailed)return Promise.resolve().then(()=>forecast(profile,data,at));
  if(!worker)try{
   worker=workerFactory?workerFactory():new Worker(new URL('./forecast.worker.js',import.meta.url),{type:'module'});
   worker.onmessage=({data:message})=>{const entry=callbacks.get(message.id);if(!entry)return;callbacks.delete(message.id);message.error?entry.reject(Error(message.error)):entry.resolve(message.result);};
   worker.onerror=failWorker;
  }catch{workerFailed=true;}
  if(workerFailed)return Promise.resolve().then(()=>forecast(profile,data,at));
  const id=++workerCompute.sequence;
  return new Promise((resolve,reject)=>{callbacks.set(id,{resolve,reject});try{worker.postMessage({id,profile,at});}catch(e){callbacks.delete(id);reject(e);}}).catch(()=>{failWorker();return forecast(profile,data,at);});
 }
 workerCompute.sequence=0;
 const calculate=compute||workerCompute;
 const notify=()=>queueMicrotask(()=>onChange(view()));
 function view(){return {result:latest?.result??null,pending:Boolean(pending),error,identity,key:pending?.key??latest?.key,current:!pending&&!error&&Boolean(latest)};}
 function request(profile,at=now(),who='guest'){
  const key=forecastKey(profile,at,who);
  if(identity!==who){identity=who;latest=null;pending=null;serial++;}
  if(pending?.key===key)return pending.promise;
  if(!pending&&latest?.key===key)return Promise.resolve(latest.result);
  const id=++serial,job={key,id,promise:null},snapshot=planningSnapshot(profile);error=null;pending=job;
  job.promise=Promise.resolve().then(()=>calculate(snapshot,at)).then(result=>{if(id!==serial)return null;latest={key,result};pending=null;notify();return result;},failure=>{if(id!==serial)return null;pending=null;error=failure;notify();throw failure;});
  notify();return job.promise;
 }
 return {request,view,clear(){serial++;latest=null;pending=null;identity=null;error=null;notify();},destroy(){serial++;worker?.terminate();for(const entry of callbacks.values())entry.reject(Error('Forecast closed'));callbacks.clear();pending=null;latest=null;}};
}
