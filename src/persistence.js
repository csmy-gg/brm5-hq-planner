import {createClient} from '@supabase/supabase-js';

const copy=value=>JSON.parse(JSON.stringify(value));
const token=()=>globalThis.crypto.randomUUID();
export function createPersistence({validate,empty,onChange=()=>{},onStatus=()=>{},storage=globalThis.localStorage,client:injected,url=import.meta.env?.VITE_SUPABASE_URL,key:publishable=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY}={}){
 const client=injected??(url&&publishable?createClient(url,publishable,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}}):null);
 const prefix='brm5-public-v2:'+((url||'guest').replace(/^https?:\/\//,'').split('.')[0]);
 let user=null,envelope=null,busy=false,generation=0,running=false,again=false,choice=null,problem='',providers=[];
 const listeners=()=>onStatus();
 const guestKey=prefix+':guest',accountKey=id=>prefix+':account:'+id;
 const activeKey=()=>user?accountKey(user.id):guestKey;
 function read(k=activeKey()){const raw=storage.getItem(k);if(!raw)return null;const e=JSON.parse(raw);if(e?.format!==1||!Number.isInteger(e.baseRevision)||e.baseRevision<0||typeof e.dirty!=='boolean'||typeof e.mutationId!=='string')throw Error('Saved HQ could not be read. Export or restore a backup before continuing.');e.profile=validate(e.profile);return e;}
 function persist(e){storage.setItem(activeKey(),JSON.stringify(e));envelope=e;}
 function fresh(profile=empty()){return {format:1,profile:validate(profile),baseRevision:0,dirty:false,mutationId:token()};}
 function notify(){onChange(copy(envelope.profile));listeners();}
 function changedGuest(){const e=read(guestKey);return e&&(e.profile.setupComplete||e.profile.history?.length||e.profile.cash||e.profile.res.some(Boolean)||Object.values(e.profile.status).some(x=>x.state!=='todo')||Object.values(e.profile.staff).some(a=>Object.values(a).some(Boolean)))?e:null;}
 function setChoice(kind,remote){choice={kind,remote,local:copy(envelope.profile),guest:changedGuest()?.profile||null};listeners();}
 function recover(remote,local){
  const backup={exportedAt:new Date().toISOString(),account: user?.id,cloud:remote?.profile??null,device:copy(local)};
  const recoveryKey=prefix+':recovery:'+(user?.id||'guest');
  const previous=JSON.parse(storage.getItem(recoveryKey)||'[]');storage.setItem(recoveryKey,JSON.stringify([...previous,backup].slice(-3)));return backup;
 }
 async function fetchRow(){const {data,error}=await client.from('hq_profiles').select('profile,revision,updated_at,last_mutation_id').eq('user_id',user.id).maybeSingle();if(error)throw error;return data?{...data,profile:validate(data.profile)}:null;}
 function accept(remote){persist({...fresh(remote.profile),baseRevision:remote.revision});choice=null;problem='';notify();}
 async function refresh(){
  if(!user||!client||busy||choice)return;
  if(envelope.dirty)return flush();
  const epoch=generation;try{const remote=await fetchRow();if(epoch!==generation)return;if(envelope.dirty)return flush();if(remote&&remote.revision!==envelope.baseRevision)accept(remote);problem='';listeners();}catch{problem='Could not reach account saves. Your device copy is safe.';listeners();}
 }
 async function flush(){
  if(!user||!client||busy||choice||!envelope.dirty)return;
  if(running){again=true;return;}
  running=true;const epoch=generation,sending=copy(envelope);listeners();
  try{
   const {data,error}=await client.rpc('save_hq_profile',{p_profile:sending.profile,p_expected_revision:sending.baseRevision,p_mutation_id:sending.mutationId});
   if(error)throw error;if(epoch!==generation)return;
   const remote=Array.isArray(data)?data[0]:data;
   if(!remote||!Number.isInteger(remote.revision))throw Error('Invalid save response');
   // A newer local action may have happened while the request was in flight.
   const latest=read();if(latest&&latest.mutationId!==envelope.mutationId){envelope=latest;onChange(copy(latest.profile));}
   persist({...envelope,baseRevision:remote.revision,dirty:envelope.mutationId!==sending.mutationId});problem='';
  }catch(error){
   if(epoch!==generation)return;
   if(error.code==='40001'){
    try{const remote=await fetchRow();if(epoch===generation)setChoice('conflict',remote);}catch{problem='A save changed on another device. Reconnect to review both copies.';}
   }else problem='Offline or account save unavailable—changes waiting to sync.';
  }finally{running=false;listeners();if(user&&!busy&&!choice&&(again||(!problem&&envelope.dirty))){again=false;queueMicrotask(flush);}}
 }
 async function switchUser(next){
  const id=next?.id??null;if(id===(user?.id??null)&&envelope)return;
  generation++;const epoch=generation;user=next;busy=Boolean(user);choice=null;problem='';
  // Never display the previous user's HQ, even while the next account is loading.
  try{envelope=read()||fresh();}catch{envelope=fresh();problem='This device has an unreadable save. Restore a backup before editing.';}
  notify();if(!user){busy=false;listeners();return;}
  try{
   const remote=await fetchRow();if(epoch!==generation)return;
   if(envelope.dirty){
    if(remote?.last_mutation_id===envelope.mutationId)accept(remote);
    else if((remote?.revision||0)!==envelope.baseRevision)setChoice('conflict',remote);
   }else if(remote){if(changedGuest())setChoice('import',remote);else accept(remote);}
   else setChoice('new',null);
  }catch{problem='Could not load your account save. Reconnect before editing to keep both copies safe.';}
  finally{if(epoch===generation){busy=false;listeners();if(!choice&&!problem)flush();}}
 }
 return {
  get key(){return activeKey();},get user(){return user;},get client(){return client;},get providers(){return providers;},get choice(){return choice;},get pending(){return Boolean(user&&envelope?.dirty);},get locked(){return busy||Boolean(choice)||Boolean(user&&problem&&!envelope?.dirty);},
  get status(){return !user?'Saved in this browser':choice?'Choose which HQ to use':busy?'Loading account save…':envelope?.dirty?(problem?'Offline—changes waiting to sync':'Saving to account'):problem?'Account save unavailable':'Saved to account';},
  get detail(){return problem;},
  get canReset(){return !busy&&!running&&!choice&&!problem&&!envelope?.dirty&&(!user||globalThis.navigator?.onLine!==false);},
  load(){envelope=read()||fresh();return copy(envelope.profile);},
  readRaw(){const latest=read();return latest?JSON.stringify(latest.profile):null;},
  receiveStorage(raw){const e=JSON.parse(raw);e.profile=validate(e.profile);envelope=e;listeners();if(user)queueMicrotask(refresh);return copy(e.profile);},
  save(profile){
   if(this.locked)throw Error('Review your account save before making changes. Your device copy is preserved.');
   const latest=read();if(latest&&latest.profile.revision!==envelope.profile.revision)throw Error('Progress changed in another tab. Reload and review before saving.');
   const next={...envelope,profile:validate(profile),dirty:Boolean(user),mutationId:token()};persist(next);listeners();if(user)queueMicrotask(flush);
  },
  async init(){
   if(!client)return;
   try{const response=await fetch(url+'/auth/v1/settings',{headers:{apikey:publishable}});if(response.ok){const settings=await response.json();providers=['google','discord'].filter(p=>settings.external?.[p]===true);}}catch{}
   if(location.pathname==='/auth/callback'){
    const params=new URLSearchParams(location.search),code=params.get('code');let error=params.get('error_description');
    if(code){const result=await client.auth.exchangeCodeForSession(code);error=result.error?.message||error;}
    history.replaceState(null,'','/'+(error?'#account':'#today'));if(error)problem='Sign-in did not finish. Try again.';
   }
   const {data,error}=await client.auth.getSession();if(error)throw Error('Sign-in session could not be restored. Try signing in again.');await switchUser(data.session?.user??null);
   client.auth.onAuthStateChange((_event,session)=>{queueMicrotask(()=>switchUser(session?.user??null));});listeners();
  },
  async signIn(provider){if(!providers.includes(provider))throw Error('This sign-in provider is not enabled yet. Guest tracking and backups are available.');const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+'/auth/callback'}});if(error)throw error;},
  async signOut(){
   if(running)throw Error('A save is still in progress. Wait for it to finish, then sign out.');
   // The durable account draft already exists. A full recovery quota must not prevent sign-out.
   if(envelope.dirty||choice){try{recover(choice?.remote,envelope.profile);}catch{}}
   const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error('Could not sign out. Reconnect and try again.');await switchUser(null);
  },
  async resetProfile(){
   if(!this.canReset)throw Error('Finish syncing and resolve account save issues before resetting.');
   const latest=read();if(latest&&latest.profile.revision!==envelope.profile.revision)throw Error('Progress changed in another tab. Review the latest save before resetting.');
   const epoch=generation,originalMutation=envelope.mutationId,originalRevision=envelope.profile.revision;busy=true;listeners();
   try{
    const remote=user?await fetchRow():null;
    if(epoch!==generation)throw Error('The active account changed. Reset was cancelled.');
    const current=read();if(current&&(current.mutationId!==originalMutation||current.profile.revision!==originalRevision))throw Error('Progress changed in another tab while preparing reset. Review the latest save before resetting.');
    if(user&&(remote?.revision||0)!==envelope.baseRevision){setChoice('conflict',remote);throw Error('Account progress changed elsewhere. Review both saves before resetting.');}
    recover(remote,envelope.profile);
    const profile=validate({...empty(),revision:token()});
    persist({...fresh(profile),baseRevision:envelope.baseRevision,dirty:Boolean(user)});problem='';
   }finally{if(epoch===generation){busy=false;listeners();}}
   notify();if(user)await flush();
   if(epoch!==generation)throw Error('The active account changed while resetting.');
   if(choice||envelope.dirty)throw Error(choice?'Reset conflicted with another device. Review saves; your previous HQ is preserved in recovery.':'Reset is saved on this device and waiting to sync. Keep this device copy until the account save succeeds.');
   return copy(envelope.profile);
  },
  async resolve(which){
   if(!choice||busy)throw Error('No save choice is waiting.');
   if(!['cloud','device','guest','empty'].includes(which))throw Error('Unknown save choice.');
   const c=choice,local=which==='guest'?c.guest:which==='empty'?empty():envelope.profile;
   if(which==='cloud'&&!c.remote||which==='guest'&&!c.guest)throw Error('That save is not available.');
   const backup=recover(c.remote,local); // Storage must succeed before replacing either copy.
   if(which==='cloud')accept(c.remote);
   else{persist({format:1,profile:validate(local),baseRevision:c.remote?.revision||0,dirty:true,mutationId:token()});choice=null;problem='';notify();await flush();}
   return backup;
  },refresh,flush
 };
}
