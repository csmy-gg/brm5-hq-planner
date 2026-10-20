import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createReleaseMonitor,updateBlocker,validRelease,installReleaseUpdates} from '../src/release-updates.js';
import {releaseMetadata} from '../scripts/release-metadata.mjs';
const release=id=>({format:1,id});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('release metadata is unique per build, public and strictly validated',()=>{
 const a=releaseMetadata('a'.repeat(40)),b=releaseMetadata('a'.repeat(40));
 assert(validRelease(a));assert.notEqual(a.id,b.id);assert.match(a.id,/^aaaaaaaaaaaa-/);assert.deepEqual(Object.keys(a),['format','id']);
 assert(!releaseMetadata('secret-input').id.includes('secret-input'));
 for(const value of [null,{},release(''),release('<script>'),release('x'.repeat(101)),{format:2,id:'new'}])assert(!validRelease(value));
});
test('every save and editing hazard blocks updates, including offline guests and deferred remote saves',()=>{
 assert.equal(updateBlocker(), '');
 for(const key of ['dirty','editing','pending','locked','conflict','saveError','storageError','deferred'])assert(updateBlocker({[key]:true}),key);
 assert.match(updateBlocker({online:false}),/offline/);
 assert.match(updateBlocker({locked:true,saveError:true}),/Reconnect/);
});
test('same build stays quiet; a changed build, including a rollback, offers a user-triggered update',async()=>{
 let remote='current',reloads=0,calls=0;
 const monitor=createReleaseMonitor({current:'current',fetchRelease:async()=>{calls++;return release(remote);},reload:()=>reloads++});
 await monitor.check();assert(!monitor.state.available);assert.equal(reloads,0);
 remote='next';await monitor.check({force:true});assert(monitor.state.available);assert.equal(reloads,0);
 assert(await monitor.update());assert.equal(reloads,1);assert.equal(calls,3);
 remote='current';await monitor.check({force:true});assert(!monitor.state.available);
 remote='older-rollback';await monitor.check({force:true});assert(monitor.state.available);
});
test('checks are deduplicated, throttled on focus and paused while hidden or offline',async()=>{
 let clock=0,online=true,visible=true,calls=0;const response=deferred();
 const monitor=createReleaseMonitor({current:'a',now:()=>clock,online:()=>online,visible:()=>visible,fetchRelease:()=>{calls++;return response.promise;}});
 const first=monitor.check(),second=monitor.check();await Promise.resolve();assert.equal(calls,1);response.resolve(release('b'));await Promise.all([first,second]);
 await monitor.check();assert.equal(calls,1);clock=30000;visible=false;await monitor.check();assert.equal(calls,1);
 visible=true;online=false;await monitor.check();assert.equal(calls,1);online=true;await monitor.check();assert.equal(calls,2);
});
test('update rechecks safety after the network request and cannot interrupt a new edit or double reload',async()=>{
 let unsafe='',reloads=0,waiting=null;
 const monitor=createReleaseMonitor({current:'a',blocker:()=>unsafe,fetchRelease:()=>waiting?waiting.promise:Promise.resolve(release('b')),reload:()=>reloads++});
 await monitor.check();unsafe='Unsaved edits';assert.equal(await monitor.update(),false);assert.equal(reloads,0);
 unsafe='';waiting=deferred();const attempt=monitor.update();assert.equal(await monitor.update(),false);
 unsafe='Saving';waiting.resolve(release('b'));assert.equal(await attempt,false);assert.equal(reloads,0);
 unsafe='';waiting=null;assert(await monitor.update());assert.equal(reloads,1);
});
test('failed, malformed and withdrawn releases never reload or erase work',async()=>{
 let response=release('b'),fail=false,reloads=0;
 const monitor=createReleaseMonitor({current:'a',fetchRelease:async()=>{if(fail)throw Error('offline');return response;},reload:()=>reloads++});
 await monitor.check();fail=true;assert.equal(await monitor.update(),false);assert(monitor.state.available);assert.match(monitor.state.error,/Try again/);
 fail=false;response={format:1,id:'unsafe/url'};assert.equal(await monitor.update(),false);
 response=release('a');assert.equal(await monitor.update(),false);assert(!monitor.state.available);assert.equal(reloads,0);
});
test('stopping a monitor cancels the effect of an in-flight response',async()=>{
 const response=deferred();let changes=0;
 const monitor=createReleaseMonitor({current:'a',fetchRelease:()=>response.promise,onChange:()=>changes++});
 const pending=monitor.check();monitor.stop();const before=changes;response.resolve(release('b'));await pending;assert.equal(changes,before);assert(!monitor.state.available);
});
test('confirmed discard bypasses only form edits; a pending save still prevents reload',async()=>{
 let dirty=true,pending=false,discarded=null;
 const monitor=createReleaseMonitor({current:'a',fetchRelease:async()=>release('b'),blocker:discard=>updateBlocker({dirty:dirty&&!discard,pending}),reload:options=>discarded=options.discard});
 await monitor.check();assert.equal(await monitor.update(),false);
 pending=true;assert.equal(await monitor.update({discard:true}),false);assert.equal(discarded,null);
 pending=false;assert(await monitor.update({discard:true}));assert.equal(discarded,true);
});
test('the banner preserves input drafts, uses fresh same-origin metadata and waits for an explicit click',async()=>{
 const handlers=new Map(),nodes=Object.fromEntries(['release-update','release-update-message','release-update-hint','release-update-button'].map(id=>[id,{hidden:true,textContent:'',addEventListener:(event,fn)=>handlers.set(id+':'+event,fn),removeEventListener(){}}]));
 const doc={hidden:false,querySelector:selector=>nodes[selector.slice(1)],addEventListener:(event,fn)=>handlers.set(event,fn),removeEventListener(){}};
 const ticks=[],win={navigator:{onLine:true},addEventListener:(event,fn)=>handlers.set(event,fn),removeEventListener(){},setInterval:(fn,ms)=>{ticks.push({fn,ms});return ticks.length;},clearInterval(){}};
 let calls=0,reloads=0,safety={};const options=[];
 const ui=installReleaseUpdates({current:'a',enabled:true,document:doc,window:win,getSafety:()=>safety,reload:()=>reloads++,fetch:async(url,init)=>{calls++;options.push([url,init]);return {ok:true,json:async()=>release('b')};}});
 await new Promise(resolve=>setImmediate(resolve));assert(!nodes['release-update'].hidden);assert.equal(reloads,0);assert(ticks.some(t=>t.ms===120000));
 assert.equal(options[0][0],'/version.json');assert.equal(options[0][1].cache,'no-store');assert.equal(options[0][1].credentials,'same-origin');assert.equal(options[0][1].redirect,'error');
 handlers.get('input')({target:{form:{id:'sale'}}});assert(nodes['release-update-button'].disabled);assert.match(nodes['release-update-hint'].textContent,/Save or discard/);
 ui.savedForm('sale');assert(!nodes['release-update-button'].disabled);
 safety={pending:true};ticks.find(t=>t.ms===1000).fn();assert(nodes['release-update-button'].disabled);
 safety={};ticks.find(t=>t.ms===1000).fn();handlers.get('release-update-button:click')();await new Promise(resolve=>setImmediate(resolve));assert.equal(reloads,1);assert.equal(calls,2);ui.stop();
});
test('cache rules keep release metadata fresh and only cache fingerprinted assets long term',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url)));
 const headers=path=>Object.fromEntries(config.headers.find(rule=>rule.source===path).headers.map(h=>[h.key,h.value]));
 assert.equal(headers('/version.json')['Cache-Control'],'no-store');assert.equal(headers('/version.json')['Vercel-CDN-Cache-Control'],'no-store');
 for(const path of ['/','/index.html'])assert.match(headers(path)['Cache-Control'],/max-age=0, must-revalidate/);
 assert.match(headers('/assets/(.*)')['Cache-Control'],/immutable/);assert.equal(headers('/auth/callback')['Cache-Control'],'no-store');
});
