import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {kyivParts,silenceWindow,playbackPlan,schoolState,durationLabel,hhmmSeconds,classIndex,classGrade,classRangeLabel} from '../time-core.mjs';
const box={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);const C=box.window.SchoolScheduleConfig;
const date=s=>Date.parse('2026-09-07T'+s+'+03:00');
test('Kyiv timezone uses DST and does not depend on device timezone',()=>{assert.equal(kyivParts(Date.parse('2026-09-07T06:00:35Z')).seconds,32435);assert.equal(kyivParts(Date.parse('2027-01-11T07:00:35Z')).seconds,32435);});
test('Silence begins at 09:00 inclusive and ends at 09:01 exclusive',()=>{for(const [t,active]of [['08:59:59.999',false],['09:00:00.000',true],['09:00:35.000',true],['09:00:59.999',true],['09:01:00.000',false],['14:00:00',false]])assert.equal(silenceWindow(date(t)).active,active,t);});
test('Late opening joins exact elapsed fraction and retains a fixed deadline',()=>{const p=playbackPlan(date('09:00:35.250'),500);assert.equal(p.offset,35.25);assert.equal(p.duration,24.75);assert.equal(p.when,500);assert.equal(p.stopAt,524.75);assert.equal(p.endEpoch,date('09:01:00'));});
test('Advance preparation schedules at 09:00, never plays early',()=>{const p=playbackPlan(date('08:59:35'),100);assert.equal(p.when,125);assert.equal(p.offset,0);assert.equal(p.stopAt,185);assert.equal(playbackPlan(date('08:30:00')),null);});
test('No late retries and next day is independent',()=>{assert.equal(playbackPlan(date('09:01:00')),null);assert.equal(playbackPlan(date('23:59:59')),null);assert.equal(playbackPlan(Date.parse('2026-09-08T09:00:10+03:00')).offset,10);assert.equal(silenceWindow(Date.parse('2026-09-12T09:00:10+03:00')).active,true);});
test('The 08:30 start and all seven bell boundaries drive lesson and break state',()=>{
 assert.equal(C.bellSchedule[0].start,'08:30');
 assert.equal(schoolState(date('08:29:59'),C).kind,'before');
 assert.equal(schoolState(date('08:30:00'),C).lesson,1);
 assert.match(schoolState(date('08:30:00'),C).detail,/5–11 класи/);
 for(const [i,b] of C.bellSchedule.entries()){
  assert.equal(schoolState(date(b.start+':00'),C).lesson,b.lesson);
  assert.notEqual(schoolState(date(b.end+':00'),C).kind,'lesson');
  if(i<C.bellSchedule.length-1){
   const next=C.bellSchedule[i+1],state=schoolState(date(b.end+':00'),C);
   assert.equal(state.kind,'break');
   assert.equal(state.remaining,hhmmSeconds(next.start)-hhmmSeconds(b.end));
  }
 }
 assert.equal(schoolState(date(C.bellSchedule.at(-1).end+':00'),C).kind,'after');
});
test('Blank first, middle and final slots never become lessons for the selected upper class',()=>{
 const copy=structuredClone(C),index=classIndex(copy,'10');
 for(const row of copy.scheduleRows)row.classes[index]='';
 copy.scheduleRows.find(r=>r.day==='Понеділок'&&r.lesson===2).classes[index]='Алгебра';
 copy.scheduleRows.find(r=>r.day==='Понеділок'&&r.lesson===4).classes[index]='Історія України';
 const bells=copy.bellSchedule;
 const first=schoolState(date(bells[0].start+':00'),copy,'10');
 assert.equal(first.kind,'before');assert.equal(first.nextLesson,2);
 const second=schoolState(date(bells[1].start+':00'),copy,'10 клас');
 assert.equal(second.kind,'lesson');assert.equal(second.title,'Алгебра');
 const middle=schoolState(date(bells[2].start+':00'),copy,'10');
 assert.equal(middle.kind,'break');assert.equal(middle.nextLesson,4);
 assert.equal(schoolState(date(bells[3].end+':00'),copy,'10').kind,'after');
 const weekend=Date.parse('2026-09-12T09:30:00+03:00');
 assert.match(schoolState(weekend,copy,'10').detail,new RegExp(bells[1].start));
 assert.match(schoolState(weekend,copy,'all').detail,/08:30/);
 for(const row of copy.scheduleRows)row.classes[index]='';
 assert.doesNotMatch(schoolState(weekend,copy,'10').detail,/\d{2}:\d{2}/);
});
test('Seven classes retain every weekday slot and IDs resolve through their configured labels',()=>{
 assert.equal(C.classes.join(','),'5 клас,6 клас,7 клас,8 клас,9 клас,10 клас,11 клас');
 assert.equal(C.scheduleRows.length,35);
 assert.equal(C.bellSchedule.length,7);
 for(const day of C.dayOrder)assert.deepEqual(Array.from(C.scheduleRows.filter(r=>r.day===day.label),r=>r.lesson),[1,2,3,4,5,6,7]);
 for(const row of C.scheduleRows)assert.equal(row.classes.length,7);
 const reordered={classes:['11 клас','5 клас','10 клас']};
 assert.equal(classIndex(reordered,'10'),2);assert.equal(classIndex(reordered,'11 клас'),0);
 assert.equal(classGrade(reordered,0),'11');assert.equal(classRangeLabel(C),'5–11 класи');
 assert.equal(classIndex(C,'12'),-1);assert.equal(classIndex(C,''),-1);
});
test('Countdown never goes negative or truncates remaining fraction',()=>{assert.equal(durationLabel(.01),'00:01');assert.equal(durationLabel(-1),'00:00');assert.equal(durationLabel(3601),'1:00:01');});
