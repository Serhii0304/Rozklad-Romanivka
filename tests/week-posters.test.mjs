import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {weekPosterForDay,wholeWeekPosters} from '../week-posters.mjs';

const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const config=JSON.parse(JSON.stringify(box.window.SchoolScheduleConfig));

test('Each school day resolves to the same full PNG from an index, ID, label or day object',()=>{
  for(const [index,day] of config.dayOrder.entries()){
    const poster=weekPosterForDay(config,index);
    assert.deepEqual(weekPosterForDay(config,day.id),poster);
    assert.deepEqual(weekPosterForDay(config,day.label),poster);
    assert.deepEqual(weekPosterForDay(config,day),poster);
    assert.equal(poster.kind,'school-week');
    assert.equal(poster.dayId,day.id);
    assert.equal(poster.label,day.label);
    assert.equal(poster.imagePath,`assets/print-week/${day.id}.png`);
    assert.equal(poster.previewPath,`assets/print-week/${day.id}-preview.webp`);
    assert.equal(poster.pagePath,`week-print.html?day=${day.id}`);
    assert.ok(poster.downloadName.includes(day.label));
    assert.ok(poster.downloadName.endsWith('.png'));
  }
});

test('The whole-school print set has five distinct pages in configured day order',()=>{
  const posters=wholeWeekPosters(config);
  assert.equal(posters.length,5);
  assert.equal(new Set(posters.map(poster=>poster.imagePath)).size,5);
  assert.deepEqual(posters.map(poster=>poster.dayId),['monday','tuesday','wednesday','thursday','friday']);
  const reordered={...config,dayOrder:[...config.dayOrder].reverse()};
  assert.deepEqual(wholeWeekPosters(reordered).map(poster=>poster.dayId),['friday','thursday','wednesday','tuesday','monday']);
  assert.equal(weekPosterForDay(reordered,0).dayId,'friday');
});

test('Invalid or unconfigured days never produce asset paths',()=>{
  for(const invalid of [null,undefined,'','all','saturday','0','../../image',-1,5,1.5,NaN,{},true])
    assert.equal(weekPosterForDay(config,invalid),null,String(invalid));
  assert.equal(weekPosterForDay({dayOrder:[{id:'../unsafe',label:'Unsafe'}]},0),null);
  assert.equal(weekPosterForDay({},0),null);
  assert.deepEqual(wholeWeekPosters(null),[]);
});
