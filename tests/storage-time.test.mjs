import test from 'node:test';
import assert from 'node:assert/strict';
import {projectStock,forecast,metrics,dispatch} from '../src/engine.js';
import {storageWarning} from '../src/forecast-ui.js';
import {createEmptyProfile} from '../src/empty-profile.js';
import {DATA} from '../src/full-data.js';
const hour=3600000,now=Date.UTC(2026,9,22,15);
function profile(){const s=createEmptyProfile(DATA.tasks,{now,timezone:'Europe/Prague'});Object.assign(s,{cash:13433,res:[30,7,28,19],capacity:179,autoCapacity:false,interval:24,uptime:90,assign:[0,0,8,0],goal:'cash',target:200000,setupComplete:true,anchor:'2026-10-23T17:00'});s.session.scheduled=now+24*hour;s.staff.Operations={'S++':8};s.staff.Delivery={'S++':6};return s;}

test('storage fill time uses the shared free space, recorded staffing and uptime',()=>{
 const s=profile(),m=metrics(s,DATA.wiki),expected=Math.ceil(now+95/(8*30.8*.9/24)*hour),original=structuredClone(s);
 const full=projectStock(s,now+24*hour,m);assert.equal(full.fullAt,expected);assert.equal(full.capped,true);assert.deepEqual(full.res,[30,7,123,19]);assert.deepEqual(s,original);
 assert.equal(projectStock(s,expected-1,m).fullAt,null);assert.equal(projectStock(s,expected,m).fullAt,expected);
 s.assign=[0,5,1,2];s.capacity=110;const mixed=Math.ceil(now+26/((5*2.2+30.8+2*4.5)*.9/24)*hour);assert.equal(projectStock(s,now+24*hour,metrics(s,DATA.wiki)).fullAt,mixed);
});

test('filling exactly at a visit and splitting a production interval retain the same timestamp',()=>{
 const s=profile();s.res=[0,0,0,0];s.assign=[1,0,0,0];s.uptime=100;const m={capacity:10,rates:[24,0,0,0],ops:1};
 const exact=projectStock(s,now+10*hour,m);assert.equal(exact.fullAt,now+10*hour);assert.equal(exact.capped,false);
 const first=projectStock(s,now+3*hour,m),second=projectStock({...s,res:first.res,snapshot:now+3*hour},now+12*hour,m);assert.equal(second.fullAt,exact.fullAt);
});

test('full or over-capacity snapshots and zero production never invent a fill time',()=>{
 const s=profile(),m=metrics(s,DATA.wiki);s.res=[179,0,0,0];assert.equal(projectStock(s,now+24*hour,m).fullAt,null);
 s.res=[3000,0,0,0];const over=projectStock(s,now+24*hour,m);assert.equal(over.fullAt,null);assert.deepEqual(over.res,s.res);
 s.res=[0,0,0,0];s.assign=[0,0,0,0];assert.equal(projectStock(s,now+24*hour,m).fullAt,null);
 s.assign=[0,0,8,0];s.uptime=0;assert.equal(projectStock(s,now+24*hour,m).fullAt,null);
 s.uptime=90;assert.equal(projectStock(s,now+24*hour,{...m,rates:[0,0,0,0]}).fullAt,null);
 assert.equal(projectStock(s,now+24*hour,{...m,capacity:0}).fullAt,null);
});

test('a fill beyond the supported date range is excluded before formatting',()=>{
 const s=profile();s.snapshot=8640000000000000-1000;const p=projectStock(s,8640000000000000,metrics(s,DATA.wiki));assert.equal(p.fullAt,null);
 assert.equal(storageWarning({storageFullAt:p.fullAt},84,179,now,()=>{throw Error('Must not format a missing date');}),'');
});

test('forecast keeps the first fill timestamp before research or dispatch makes room',()=>{
 const s=profile(),expected=projectStock(s,s.session.scheduled,metrics(s,DATA.wiki)).fullAt,before=structuredClone(s),f=forecast(s,DATA,now,2);
 assert.equal(f.rows[0].storageFullAt,expected);assert(f.rows[0].delivery);assert(f.rows[0].after.res.reduce((a,b)=>a+b,0)<179);assert.deepEqual(s,before);
 s.assign=[0,5,1,2];s.capacity=110;const current=forecast(s,DATA,now,1);assert.equal(current.rows[0].storageFullAt,projectStock(s,s.session.scheduled,metrics(s,DATA.wiki)).fullAt);
 s.capacity=500;assert.equal(forecast(s,DATA,now,1).rows[0].storageFullAt,null);
});

test('a full-storage forecast can dispatch whole stock despite floating-point residue',()=>{
 const s=profile();s.res[2]=123-1e-12;const sent=dispatch(s,2,123,DATA.wiki,now);assert.equal(sent.res[2],0);assert.equal(sent.ships.length,1);assert.equal(sent.cash,s.cash);
 s.res[2]=122.99;assert.throws(()=>dispatch(s,2,123,DATA.wiki,now));assert.equal(s.ships.length,0);assert.equal(s.res[2],122.99);
});

test('storage warning formats future and elapsed estimates in the selected timezone including DST',()=>{
 const formatter=zone=>t=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(t);
 const summer=Date.UTC(2026,9,25,0,30),winter=summer+hour,row={storageFullAt:summer};
 const future=storageWarning(row,84,179,now,formatter('Europe/Prague'));assert.match(future,/25 Oct, 02:30:00 CEST/);assert.match(future,/checking in before then/);
 assert.match(storageWarning({...row,storageFullAt:winter},84,179,now,formatter('Europe/Prague')),/25 Oct, 02:30:00 CET/);
 assert.match(storageWarning(row,84,179,winter,formatter('UTC')),/have filled at 25 Oct, 00:30:00 UTC/);
 assert.equal(storageWarning(row,179,179,now,formatter('UTC')),'Recorded storage is already full. Make room to resume production.');
 assert.equal(storageWarning(row,3000,179,now,formatter('UTC')),'');assert.equal(storageWarning(null,0,0,now,formatter('UTC')),'');
});
