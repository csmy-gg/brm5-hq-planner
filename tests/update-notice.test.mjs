import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberUpdateIntent,consumeUpdateNotice,UPDATE_INTENT_KEY,UPDATE_NOTICE_KEY} from '../src/update-notice.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('existing 1.1 users see scheduling notice once; new visitors and ordinary later refreshes stay quiet',()=>{
 const local=storage(),session=storage(),options={version:'1.2.0',current:'build12',local,session};
 assert.equal(consumeUpdateNotice({...options,existing:false}),false);
 assert.equal(consumeUpdateNotice({...options,existing:true}),true);assert.equal(local.getItem(UPDATE_NOTICE_KEY),'1.2.0');
 assert.equal(consumeUpdateNotice({...options,existing:true}),false);
 assert.equal(consumeUpdateNotice({...options,version:'1.2.1',existing:true}),false);
});
test('update-button intent survives reload and is consumed only by the matching build',()=>{
 const local=storage(),session=storage();rememberUpdateIntent(session,{id:'new',version:'1.2.1'});
 assert.equal(consumeUpdateNotice({version:'1.2.1',current:'old',local,session,existing:true}),false);assert(session.getItem(UPDATE_INTENT_KEY));
 assert.equal(consumeUpdateNotice({version:'1.2.1',current:'new',local,session,existing:true}),true);assert.equal(session.getItem(UPDATE_INTENT_KEY),null);
 assert.equal(consumeUpdateNotice({version:'1.2.1',current:'new',local,session,existing:true}),false);
});
test('unavailable or malformed notice storage never prevents loading or updating',()=>{
 const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.doesNotThrow(()=>rememberUpdateIntent(broken,{id:'new'}));assert.equal(consumeUpdateNotice({version:'1.2.1',current:'new',local:broken,session:broken}),false);
});
test('new users completing setup on 1.2 do not receive the legacy migration notice later',()=>{
 const local=storage(),session=storage(),options={version:'1.2.0',current:'build12',local,session};
 assert.equal(consumeUpdateNotice({...options,existing:false,settled:true}),false);
 assert.equal(consumeUpdateNotice({...options,existing:true}),false);
});
