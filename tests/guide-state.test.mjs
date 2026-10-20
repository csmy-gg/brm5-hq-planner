import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_KEY,guideInitiallyOpen,rememberGuideState,closeGuideForUpdate} from '../src/guide-state.js';
function environment(hash='#guide'){
 const values=new Map(),location={hash,pathname:'/',search:'?view=planner'},replacements=[];
 const history={state:{keep:true},replaceState(state,_title,url){replacements.push({state,url});location.hash=new URL(url,'https://example.test').hash;}};
 return {storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},location,history,replacements};
}
test('a closed guide stays closed after reload even with an old guide fragment',()=>{
 for(const setupComplete of [true,false])assert.equal(guideInitiallyOpen(setupComplete,'false','#guide'),false);
 assert.equal(guideInitiallyOpen(true,null,''),false);assert.equal(guideInitiallyOpen(false,null,''),true);assert.equal(guideInitiallyOpen(true,'true','#guide'),true);
});
test('closing the guide remembers the choice and removes only the stale guide fragment',()=>{
 const env=environment();rememberGuideState(false,env);
 assert.equal(env.storage.getItem(GUIDE_KEY),'false');assert.deepEqual(env.replacements,[{state:{keep:true},url:'/?view=planner#today'}]);
 const stock=environment('#stock');rememberGuideState(false,stock);assert.deepEqual(stock.replacements,[]);
});
test('update reload persists a closed guide synchronously, without waiting for toggle events',()=>{
 const env=environment(),guide={open:true};env.storage.setItem(GUIDE_KEY,'true');closeGuideForUpdate(guide,env);
 assert.equal(guide.open,false);assert.equal(env.storage.getItem(GUIDE_KEY),'false');assert.equal(env.location.hash,'#today');assert.equal(guideInitiallyOpen(false,env.storage.getItem(GUIDE_KEY),env.location.hash),false);
});
test('manual reopening still works and unavailable preference storage does not prevent updating',()=>{
 const env=environment();rememberGuideState(true,env);assert.equal(env.storage.getItem(GUIDE_KEY),'true');assert.equal(env.location.hash,'#guide');
 env.storage.setItem=()=>{throw Error('storage unavailable');};const guide={open:true};assert.doesNotThrow(()=>closeGuideForUpdate(guide,env));assert.equal(guide.open,false);assert.equal(env.location.hash,'#today');
});
