import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {bellsMarkup} from '../bells-view.mjs';
const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const config=box.window.SchoolScheduleConfig;

test('The bell view keeps all seven exact lesson intervals and all six break intervals',()=>{
 const html=bellsMarkup(config);
 assert.doesNotMatch(html,/class="break-number"/);
 const lessons=[...html.matchAll(/class="bell-row" data-bell="(\d+)"[\s\S]*?<\/div>/g)];
 assert.deepEqual(lessons.map(m=>Number(m[1])),[1,2,3,4,5,6,7]);
 for(const [index,match] of lessons.entries()){
  assert.deepEqual([...match[0].matchAll(/datetime="([^"]+)"/g)].map(m=>m[1]),[config.bellSchedule[index].start,config.bellSchedule[index].end]);
 }
 const breaks=[...html.matchAll(/class="bell-break[^"]*" data-break="(\d+)"[\s\S]*?<\/div>/g)];
 assert.deepEqual(breaks.map(m=>Number(m[1])),[1,2,3,4,5,6]);
 const expected=[['09:15','09:25',10],['10:10','10:30',20],['11:15','11:35',20],['12:20','12:30',10],['13:15','13:25',10],['14:10','14:20',10]];
 for(const [index,match] of breaks.entries()){
  const [start,end,duration]=expected[index];
  assert.deepEqual([...match[0].matchAll(/datetime="([^"]+)"/g)].map(m=>m[1]),[start,end]);
  assert.ok(match[0].includes('class="break-duration">'+duration+' хв'));
  assert.ok(match[0].includes('<small class="break-state"></small>'));
 }
 assert.equal((html.match(/class="bell-break large"/g)||[]).length,2);
});

test('Break intervals and durations derive from the configured bells instead of fixed display labels',()=>{
 const changed=JSON.parse(JSON.stringify(config));
 changed.bellSchedule[1].start='09:35';
 const firstBreak=bellsMarkup(changed).match(/class="bell-break[^"]*" data-break="1"[\s\S]*?<\/div>/)[0];
 assert.ok(firstBreak.includes('datetime="09:35"'));
 assert.ok(firstBreak.includes('class="break-duration">20 хв'));
 assert.ok(firstBreak.includes('class="bell-break large"'));
});
