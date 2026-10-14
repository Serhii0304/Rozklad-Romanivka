import test from 'node:test';import assert from 'node:assert/strict';
import {KyivClock} from '../kyiv-clock.mjs';

function withFetch(handler,run){
  const realFetch=globalThis.fetch,calls=[];
  globalThis.location={href:'https://serhii0304.github.io/Rozklad-Romanivka/?view=week#schedule'};
  globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),method:options.method||'GET'});return handler(String(url));};
  return run(calls).finally(()=>{globalThis.fetch=realFetch;delete globalThis.location;});
}

test('Clock uses the site server Date header when the time API is unreachable, and stops retrying the API',()=>withFetch(url=>{
  if(url.includes('worldtimeapi'))throw new TypeError('connection reset');
  return {ok:true,headers:new Map([['date','Wed, 14 Oct 2026 08:43:07 GMT']])};
},async calls=>{
  const clock=new KyivClock();
  await clock.sync();
  assert.equal(clock.source,'Звірено онлайн');
  assert.ok(Math.abs(clock.now()-Date.parse('2026-10-14T08:43:07.500Z'))<1000);
  await clock.sync();
  assert.deepEqual(calls.map(c=>c.method),['GET','HEAD','HEAD']);
  assert.equal(calls[1].url,'https://serhii0304.github.io/Rozklad-Romanivka/?view=week');
}));

test('Clock keeps device time when no online source answers',()=>withFetch(()=>{throw new TypeError('offline');},async()=>{
  const clock=new KyivClock();
  await clock.sync();
  assert.equal(clock.source,'Час пристрою');
  assert.ok(Math.abs(clock.now()-Date.now())<1000);
}));

test('A whole-second server Date within one second of the clock does not shift it, so playing audio is not restarted',()=>withFetch(url=>{
  if(url.includes('worldtimeapi'))throw new TypeError('connection reset');
  return {ok:true,headers:new Map([['date',new Date(Math.floor(Date.now()/1000)*1000).toUTCString()]])};
},async()=>{
  const clock=new KyivClock(),before={epoch:clock.baseEpoch,mono:clock.baseMono};
  await clock.sync();
  assert.equal(clock.source,'Звірено онлайн');
  assert.deepEqual({epoch:clock.baseEpoch,mono:clock.baseMono},before);
}));
