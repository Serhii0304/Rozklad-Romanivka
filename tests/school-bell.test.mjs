import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SchoolBellPlayer,schoolBellPlan} from '../school-bell.mjs';
const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const C=box.window.SchoolScheduleConfig;
const duration=12.173,at=(time,day='2026-09-08',zone='+03:00')=>Date.parse(day+'T'+time+zone);
const times=['08:30','09:15','09:25','10:10','10:30','11:15','11:35','12:20','12:30','13:15','13:25','14:10','14:20','15:05'];

test('All 14 bells ring exactly at lesson starts and ends on every weekday',()=>{
  for(const day of ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11']){
    for(const [i,time] of times.entries()){
      const plan=schoolBellPlan(at(time+':00',day),C,duration,100);
      assert.equal(plan.kind,i%2?'finish':'start');assert.equal(plan.lesson,Math.floor(i/2)+1);
      assert.equal(plan.when,100);assert.equal(plan.offset,0);assert.equal(plan.duration,duration);
    }
  }
  const before=schoolBellPlan(at('09:14:00'),C,duration,100);
  assert.equal(before.active,false);assert.equal(before.when,160);
});
test('Bells use Kyiv time in summer and winter and never ring on weekends',()=>{
  assert.equal(schoolBellPlan(Date.parse('2026-09-08T05:30:00Z'),C,duration).active,true);
  assert.equal(schoolBellPlan(Date.parse('2027-01-11T06:30:00Z'),C,duration).active,true);
  for(const day of ['2026-09-12','2026-09-13'])assert.equal(schoolBellPlan(at('08:30:00',day),C,duration),null);
});
test('Preparation is silent; late entry seeks only within the recording interval',()=>{
  assert.equal(schoolBellPlan(at('08:27:59'),C,duration),null);
  const before=schoolBellPlan(at('08:29:59.999'),C,duration,100);
  assert.ok(Math.abs(before.when-100.001)<1e-8);assert.equal(before.offset,0);
  const late=schoolBellPlan(at('08:30:04'),C,duration,100);
  assert.equal(late.offset,4);assert.ok(Math.abs(late.duration-8.173)<1e-8);
  assert.ok(schoolBellPlan(at('08:30:12.172'),C,duration));
  assert.equal(schoolBellPlan(at('08:30:12.173'),C,duration),null);
  for(const t of ['07:30:00','08:25:00','09:00:00','09:00:59','09:15:30','15:05:13','18:00:00'])assert.equal(schoolBellPlan(at(t),C,duration),null,t);
});
test('Even a changed schedule cannot play the school bell during the silence minute',()=>{
  const config={bellSchedule:[{lesson:1,start:'08:59',end:'09:00'},{lesson:2,start:'09:00',end:'09:45'}]};
  const plan=schoolBellPlan(at('08:59:30'),config,90,100);
  assert.equal(plan.duration,30);assert.equal(plan.stopAt,130);
  assert.equal(schoolBellPlan(at('09:00:00'),config,90),null);
  assert.equal(schoolBellPlan(at('09:00:59.999'),config,90),null);
  assert.equal(schoolBellPlan(at('09:01:00'),config,90),null);
});

function setup(time){
  let now=at(time);const sources=[];
  const context={state:'running',currentTime:100,destination:{},createBufferSource(){
    const source={connect(){},disconnect(){},start(...args){this.started=args;},stop(...args){(this.stops??=[]).push(args);}};
    sources.push(source);return source;
  }};
  const p=Object.create(SchoolBellPlayer.prototype);
  Object.assign(p,{clock:{now:()=>now},config:C,context,buffer:{duration},source:null,plan:null,releaseLock:null,
    claiming:false,otherTab:false,error:false,closed:false,generation:0,completed:new Set(),fallback:false,onState(){},
    claim(plan){this.start(plan.id);}});
  return {p,context,sources,setTime(t){const next=at(t);context.currentTime+=(next-now)/1000;now=next;},correctTime(t){now=at(t);}};
}
test('Hardware schedules one source per signal and a fixed stop, without replay on repeated ticks',()=>{
  const {p,context,sources,setTime}=setup('08:29:30');
  p.reconcile();p.reconcile();assert.equal(sources.length,1);
  assert.deepEqual(sources[0].started,[130,0,duration]);assert.equal(sources[0].stops[0][0],130+duration);
  setTime('08:30:04');p.reconcile();assert.equal(sources.length,1);
  setTime('08:30:12.172');sources[0].onended();p.reconcile();assert.equal(sources.length,1);
  setTime('09:15:00');p.reconcile();assert.equal(sources.length,2);
  assert.equal(sources[1].started[0],context.currentTime);assert.equal(sources[1].started[1],0);
});
test('Reload and suspension rejoin the remaining clip; a late unlock never replays a missed bell',()=>{
  const first=setup('09:15:00');first.p.reconcile();first.p.cancel();
  const reload=setup('09:15:04');reload.p.reconcile();assert.equal(reload.sources[0].started[1],4);
  reload.context.state='suspended';reload.p.reconcile();assert.equal(reload.p.source,null);
  reload.setTime('09:15:13');reload.context.state='running';reload.p.reconcile();assert.equal(reload.sources.length,1);
  const blocked=setup('08:29:30');blocked.context.state='suspended';blocked.p.reconcile();
  blocked.setTime('08:30:15');blocked.context.state='running';blocked.p.reconcile();assert.equal(blocked.sources.length,0);
});
test('Clock correction cancels an obsolete source and seeks or schedules to the corrected time',()=>{
  const {p,sources,correctTime}=setup('08:30:03');p.reconcile();
  correctTime('08:30:08');p.reconcile();assert.equal(sources[0].stops.length,2);assert.equal(sources[1].started[1],8);
  correctTime('09:00:10');p.reconcile();assert.equal(p.source,null);assert.equal(sources.length,2);
});

const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('A fallback source stops immediately when another tab owns the lease',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){return JSON.stringify({owner:'another-tab',until:Date.now()+60000});},removeItem(){throw new Error('Must not remove another tab lease');}}});
  try{
    const {p,sources}=setup('09:15:04');p.reconcile();p.fallback=true;p.leaseKey='test';p.tabId='this-tab';
    p.claim=()=>{};p.reconcile();assert.equal(p.source,null);assert.equal(sources[0].stops.length,2);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
test('Romanivka bell locks coexist with Pochuyki while allowing only one Romanivka ringing tab',async()=>{
  const otherSchoolLock='pochuyki-school-bell:2026-09-08:finish:1';
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),held=new Set([otherSchoolLock]);
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{async request(name,options,callback){
    if(held.has(name))return callback(null);
    held.add(name);try{return await callback({name});}finally{held.delete(name);}
  }}}});
  try{
    const a=setup('09:15:00'),b=setup('09:15:00');delete a.p.claim;delete b.p.claim;
    a.p.reconcile();b.p.reconcile();await flush();
    assert.equal(a.sources.length+b.sources.length,1);assert.equal(b.p.otherTab,true);
    assert.ok(held.has('romanivka-school-bell:2026-09-08:finish:1'));
    a.p.closed=true;a.p.cancel();await flush();b.setTime('09:15:05');b.p.reconcile();await flush();
    assert.equal(b.sources.length,1);assert.equal(b.sources[0].started[1],5);
    b.setTime('09:15:13');b.p.reconcile();await flush();assert.equal(held.size,1);assert.ok(held.has(otherSchoolLock));
  }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('A pending lock cannot ring after the page closes or the event expires',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let grant;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request(name,options,callback){
    return new Promise(resolve=>{grant=()=>resolve(callback({name}));});
  }}}});
  try{
    const a=setup('09:15:00');delete a.p.claim;a.p.reconcile();a.p.closed=true;a.p.cancel();grant();await flush();assert.equal(a.sources.length,0);
    const b=setup('09:15:00');delete b.p.claim;b.p.reconcile();b.setTime('09:15:15');grant();await flush();assert.equal(b.sources.length,0);
  }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
