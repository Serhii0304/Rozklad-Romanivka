import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {readViewState,selectViewMode} from '../view-mode.mjs';
import {schoolState} from '../time-core.mjs';
import {classWeekMarkup} from '../schedule-view.mjs';

const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const config=box.window.SchoolScheduleConfig;
const thursday=Date.parse('2026-09-10T09:10:00+03:00');
const friday=Date.parse('2026-09-11T09:10:00+03:00');

test('Initial and unsupported views keep the full-week default',()=>{
  for(const query of ['', 'view=week', 'view=unknown', 'view=DAY']){
    assert.deepEqual(readViewState(new URLSearchParams(query),thursday,config),{
      view:'week',day:3,autoDay:true
    },query);
  }
});

test('The Day period button returns to actual Thursday after a manual Monday selection',()=>{
  for(const view of ['day','week']){
    const previous=Object.freeze({view,day:0,autoDay:false});
    assert.deepEqual(selectViewMode('day',previous,thursday,config),{
      view:'day',day:3,autoDay:true
    });
    assert.deepEqual(previous,{view,day:0,autoDay:false});
  }
  assert.deepEqual(selectViewMode('day',{view:'day',day:3,autoDay:true},friday,config),{
    view:'day',day:4,autoDay:true
  });
});

test('Automatic day links keep day mode and resolve the weekday when reloaded later',()=>{
  const selected=selectViewMode('day',{view:'week',day:0,autoDay:false},thursday,config);
  const url=new URL('https://school.example/class.html');
  url.searchParams.set('view',selected.view);
  // Automatic links omit a fixed weekday, allowing later visits to follow Kyiv time.
  assert.equal(selected.autoDay,true);
  const serialized=url.toString();
  assert.deepEqual(readViewState(new URL(serialized).searchParams,thursday,config),selected);
  assert.deepEqual(readViewState(new URL(serialized).searchParams,friday,config),{
    view:'day',day:4,autoDay:true
  });
});

test('Valid explicit weekday links stay manual, including a different current weekday',()=>{
  const url=new URL('https://school.example/class.html?view=day&day=monday');
  for(const now of [thursday,friday]){
    assert.deepEqual(readViewState(new URL(url.toString()).searchParams,now,config),{
      view:'day',day:0,autoDay:false
    });
  }
  assert.deepEqual(readViewState(new URLSearchParams('day=friday'),thursday,config),{
    view:'week',day:4,autoDay:false
  });
});

test('Missing and invalid weekday IDs use the current day without disabling automatic updates',()=>{
  for(const query of ['view=day','view=day&day=','view=day&day=0','view=day&day=MONDAY','view=day&day=saturday']){
    assert.deepEqual(readViewState(new URLSearchParams(query),thursday,config),{
      view:'day',day:3,autoDay:true
    },query);
  }
});

test('The Week period button preserves the day selection and displays all configured weekdays',()=>{
  for(const autoDay of [true,false]){
    const previous=Object.freeze({view:'day',day:0,autoDay});
    assert.deepEqual(selectViewMode('week',previous,thursday,config),{
      view:'week',day:0,autoDay
    });
  }
  const html=classWeekMarkup(config,'5',3);
  for(const [index,day] of config.dayOrder.entries()){
    assert.ok(html.includes('data-day-head="'+index+'"'),day.label);
  }
  assert.equal((html.match(/data-cell-day=/g)||[]).length,config.dayOrder.length*config.bellSchedule.length);
});

test('Automatic day selection crosses Kyiv midnight with summer and winter offsets',()=>{
  for(const [before,after] of [
    ['2026-09-09T20:59:59.999Z','2026-09-09T21:00:00.000Z'],
    ['2027-01-13T21:59:59.999Z','2027-01-13T22:00:00.000Z']
  ]){
    const query=new URLSearchParams('view=day');
    assert.equal(readViewState(query,Date.parse(before),config).day,2,before);
    assert.equal(readViewState(query,Date.parse(after),config).day,3,after);
    assert.equal(selectViewMode('day',{view:'week',day:0,autoDay:false},Date.parse(after),config).day,3,after);
  }
});

test('Weekend day mode falls back to Monday while live school status has no current lesson',()=>{
  for(const date of ['2026-09-12T09:10:00+03:00','2026-09-13T09:10:00+03:00']){
    const now=Date.parse(date);
    const expected={view:'day',day:0,autoDay:true};
    assert.deepEqual(readViewState(new URLSearchParams('view=day'),now,config),expected);
    assert.deepEqual(selectViewMode('day',{view:'week',day:4,autoDay:false},now,config),expected);
    const live=schoolState(now,config);
    assert.equal(live.kind,'weekend');
    assert.equal(live.lesson,null);
    assert.equal(live.nextLesson,undefined);
    assert.notEqual(live.dayIndex,0);
  }
});
