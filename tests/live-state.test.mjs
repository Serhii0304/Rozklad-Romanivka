import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {displaySchoolState} from '../live-state.mjs';
const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const C=box.window.SchoolScheduleConfig;
const at=time=>Date.parse('2026-09-14T'+time+'+03:00');

test('All pages show the same real lesson and remaining time, including a class without that slot',()=>{
  const general=displaySchoolState(at('14:25:00'),C);
  assert.equal(general.lesson,7);assert.equal(general.remaining,40*60);
  for(const label of C.classes){
    const state=displaySchoolState(at('14:25:00'),C,label);
    assert.equal(state.kind,'lesson');assert.equal(state.lesson,7);assert.equal(state.remaining,general.remaining);
  }
  assert.match(displaySchoolState(at('14:25:00'),C,'5').detail,/уроку в розкладі немає/);
});

test('A class shows its own subject and the actual weekday without altering bell time',()=>{
  const state=displaySchoolState(at('08:35:00'),C,'6');
  assert.equal(state.title,'Фізична культура');
  assert.match(state.detail,/Понеділок · 6 клас · 1-й урок · 08:30–09:15/);
  assert.equal(state.remaining,40*60);
});

test('The break clock is visible everywhere even after one class finishes its own lessons',()=>{
  for(const grade of ['all','5','11']){
    const state=displaySchoolState(at('14:15:00'),C,grade);
    assert.equal(state.kind,'break');assert.equal(state.nextLesson,7);assert.equal(state.remaining,5*60);
  }
});

test('After the final bell and at weekends no page invents a running lesson',()=>{
  assert.equal(displaySchoolState(at('15:05:00'),C,'5').kind,'after');
  const weekend=displaySchoolState(Date.parse('2026-09-12T10:00:00+03:00'),C,'11');
  assert.equal(weekend.kind,'weekend');assert.equal(weekend.lesson,null);assert.equal(weekend.remaining,0);
});
