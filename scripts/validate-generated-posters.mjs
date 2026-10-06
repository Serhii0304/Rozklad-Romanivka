import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const box={window:{}};vm.runInNewContext(read('schedule-config.js').toString('utf8'),box,{timeout:1000});
const C=JSON.parse(JSON.stringify(box.window.SchoolScheduleConfig));
const manifest=JSON.parse(read('assets/print/manifest.json'));
assert.equal(manifest.schemaVersion,2);assert.equal(manifest.generationMethod,'builtin-imagegen-full');
assert.equal(manifest.originalsUnmodified,true);assert.equal(manifest.complete,true);
assert.equal(manifest.configSha256,hash(JSON.stringify(C)),'Schedule changed: generate and visually review new complete timetable images.');
assert.equal(manifest.posters.length,C.classes.length);
const seen=new Set();
for(const poster of manifest.posters){
 const index=C.classes.indexOf(poster.className);assert.ok(index>=0);
 const grade=Number(C.classes[index].match(/\d+/)[0]);assert.equal(poster.grade,grade);
 assert.ok(!seen.has(grade));seen.add(grade);
 assert.equal(poster.path,`assets/print/class-${grade}-week.png`);assert.equal(poster.previewPath,`assets/print/class-${grade}-preview.webp`);
 assert.equal(poster.reviewPath,`assets/print-generation/class-${grade}-review.json`);
 assert.equal(poster.promptPath,`assets/print-generation/class-${grade}-prompt.txt`);
 const png=read(poster.path);assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[poster.width,poster.height]);
 assert.equal(hash(png),poster.sha256);assert.equal(hash(read(poster.previewPath)),poster.previewSha256);
 assert.equal(hash(read(poster.promptPath).toString('utf8').replace(/\r\n?/g,'\n')),poster.promptSha256);
 const review=JSON.parse(read(poster.reviewPath));assert.equal(review.imageSha256,poster.sha256);
 assert.equal(review.method,'builtin-imagegen-full');assert.equal(review.accepted,true);assert.equal(review.cellsChecked,35);
 for(const key of ['titlesCentered','spellingChecked','timesChecked'])assert.equal(review[key],true);
 assert.deepEqual(review.remainingIssues,[]);
 assert.equal(poster.cellCount,35);assert.equal(poster.cells.length,35);
 const keys=new Set();
 for(const cell of poster.cells){
  const day=C.dayOrder.find(d=>d.id===cell.dayId);assert.equal(cell.day,day?.label);
  const key=cell.dayId+'/'+cell.lesson;assert.ok(!keys.has(key));keys.add(key);
  const bell=C.bellSchedule.find(b=>b.lesson===cell.lesson);assert.deepEqual([cell.start,cell.end],[bell?.start,bell?.end]);
  const row=C.scheduleRows.find(r=>r.day===cell.day&&r.lesson===cell.lesson);assert.equal(cell.value,row?.classes[index]);
 }
 assert.equal(poster.filledCount,C.scheduleRows.filter(r=>r.classes[index]).length);
}
console.log('7 fully generated PNG originals and visual-review records verified; source schedule unchanged.');
