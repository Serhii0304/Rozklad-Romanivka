import test from 'node:test';import assert from 'node:assert/strict';import {SilencePlayer} from '../minute-of-silence.mjs';
const at=t=>Date.parse('2026-09-07T'+t+'+03:00');
function setup(t){let now=at(t);const sources=[];const context={state:'running',currentTime:100,destination:{},createBufferSource(){const s={buffer:null,connect(){},disconnect(){},start(...args){this.started=args;},stop(...args){this.stops=(this.stops||[]).concat([args]);}};sources.push(s);return s;}};
const p=Object.create(SilencePlayer.prototype);Object.assign(p,{clock:{now:()=>now},context,buffer:{duration:60.5},source:null,plan:null,releaseLock:null,onState:()=>{},claiming:false,busy:false,fallback:false,claim(){this.start();}});return {p,context,sources,setTime(t){now=at(t);}};}
test('Audio engine seeks on late entry and schedules hardware stop',()=>{const {p,sources}=setup('09:00:35');p.start();assert.deepEqual(sources[0].started,[100,35,25]);assert.deepEqual(sources[0].stops,[[125]]);});
test('Audio engine schedules early visits without playing before 09:00',()=>{const {p,sources}=setup('08:59:30');p.start();assert.deepEqual(sources[0].started,[130,0,60]);assert.deepEqual(sources[0].stops,[[190]]);});
test('Backward time correction cancels currently playing sound and reschedules',()=>{const {p,sources,setTime}=setup('09:00:20');p.start();setTime('08:59:50');p.reconcile();assert.equal(sources[0].stops.length,2);assert.deepEqual(sources[1].started,[110,0,60]);});
test('Forward correction rejoins corrected offset',()=>{const {p,sources,setTime}=setup('09:00:20');p.start();setTime('09:00:45');p.reconcile();assert.equal(sources[0].stops.length,2);assert.deepEqual(sources[1].started,[100,45,15]);});
test('09:01 cancels sound and cannot create another source',()=>{const {p,sources,setTime}=setup('09:00:20');p.start();setTime('09:01:00');p.reconcile();assert.equal(p.source,null);assert.equal(sources.length,1);p.start();assert.equal(sources.length,1);});
test('Suspending audio cancels sources; resuming later uses current offset',()=>{const {p,context,sources,setTime}=setup('09:00:20');p.start();context.state='suspended';context.resume=()=>new Promise(()=>{});p.reconcile();assert.equal(p.source,null);context.state='running';setTime('09:00:50');p.reconcile();assert.deepEqual(sources[1].started,[100,50,10]);});
test('Delayed autoplay permission after deadline never starts audio',async()=>{const {p,context,sources,setTime}=setup('09:00:59');context.state='suspended';let resolve;context.resume=()=>new Promise(r=>resolve=r);p.enable();setTime('09:01:02');context.state='running';resolve();await Promise.resolve();assert.equal(sources.length,0);});
test('Reload during minute has no once-per-day suppression',()=>{const first=setup('09:00:10');first.p.start();first.p.cancel();const reload=setup('09:00:35');reload.p.start();assert.deepEqual(reload.sources[0].started,[100,35,25]);});
test('Minute-of-silence locks coexist with other schools and prevent duplicate Romanivka playback',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),held=new Set(['pochuyki-minute-of-silence','kvitneve-minute-of-silence']);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{async request(name,options,callback){
  if(held.has(name))return callback(null);
  held.add(name);try{return await callback({name});}finally{held.delete(name);}
 }}}});
 const a=setup('09:00:10'),b=setup('09:00:10');delete a.p.claim;delete b.p.claim;
 try{
  a.p.reconcile();b.p.reconcile();await flush();
  assert.equal(a.sources.length+b.sources.length,1);
  assert.ok(held.has('romanivka-minute-of-silence'));assert.ok(held.has('pochuyki-minute-of-silence'));assert.ok(held.has('kvitneve-minute-of-silence'));
  a.p.cancel();await flush();b.setTime('09:00:35');b.p.reconcile();await flush();
  assert.equal(b.sources.length,1);assert.equal(b.sources[0].started[1],35);
 }finally{
  a.p.cancel();b.p.cancel();await flush();
  if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;
 }
});
