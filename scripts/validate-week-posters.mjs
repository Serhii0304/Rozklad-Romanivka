import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {wholeWeekPosters} from '../week-posters.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const box={window:{}};
vm.runInNewContext(read('schedule-config.js').toString('utf8'),box,{timeout:1000});
const config=JSON.parse(JSON.stringify(box.window.SchoolScheduleConfig));
const pages=wholeWeekPosters(config);
assert.deepEqual(pages.map(page=>page.dayId),['monday','tuesday','wednesday','thursday','friday']);
assert.equal(config.classes.length,7);
assert.equal(new Set(config.classes).size,7);
assert.equal(config.bellSchedule.length,7);
assert.equal(new Set(config.bellSchedule.map(bell=>bell.lesson)).size,7);
const manifest=JSON.parse(read('assets/print-week/manifest.json'));
assert.equal(manifest.schemaVersion,2);
assert.equal(manifest.format,'A4 landscape');
assert.equal(manifest.generationMethod,'builtin-imagegen-full');
assert.equal(manifest.style,'academic-navy-ivory-gold-v1');
assert.equal(manifest.originalsUnmodified,true);
assert.equal(manifest.complete,true);
assert.equal(manifest.configHashMethod,'sha256(JSON.stringify(parsed SchoolScheduleConfig))');
assert.equal(manifest.configSha256,hash(JSON.stringify(config)),
  'Schedule changed: generate and visually review five new general timetable images.');
assert.equal(manifest.posters.length,5);

for(const [index,page] of pages.entries()){
  const poster=manifest.posters[index];
  assert.equal(poster.dayId,page.dayId);
  assert.equal(poster.label,page.label);
  assert.equal(poster.path,page.imagePath);
  assert.equal(poster.previewPath,page.previewPath);
  assert.equal(poster.promptPath,`assets/print-week-generation/${page.dayId}-prompt.txt`);
  assert.equal(poster.reviewPath,`assets/print-week-generation/${page.dayId}-review.json`);
  const png=read(poster.path);
  assert.ok(png.length>=33);
  assert.deepEqual(png.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  assert.equal(png.readUInt32BE(8),13);
  assert.equal(png.subarray(12,16).toString(),'IHDR');
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[poster.width,poster.height]);
  assert.ok(poster.width>=1400&&poster.height>=980);
  assert.ok(poster.width/poster.height>1.35&&poster.width/poster.height<1.5);
  assert.equal(hash(png),poster.sha256);
  const preview=read(poster.previewPath);
  assert.equal(preview.subarray(0,4).toString(),'RIFF');
  assert.equal(preview.subarray(8,12).toString(),'WEBP');
  assert.equal(hash(preview),poster.previewSha256);
  const prompt=read(poster.promptPath).toString('utf8');
  assert.ok(prompt.trim());
  assert.equal(hash(prompt.replace(/\r\n?/g,'\n')),poster.promptSha256);
  const reviewBytes=read(poster.reviewPath);
  assert.equal(hash(reviewBytes.toString('utf8').replace(/\r\n?/g,'\n')),poster.reviewSha256);
  const review=JSON.parse(reviewBytes);
  assert.equal(review.dayId,page.dayId);
  assert.equal(review.imageSha256,poster.sha256);
  assert.equal(review.promptPath,poster.promptPath);
  assert.ok(typeof review.sourceGeneratedPath==='string'&&review.sourceGeneratedPath.trim());
  assert.equal(review.method,'builtin-imagegen-full');
  assert.equal(review.accepted,true);
  assert.equal(review.cellsChecked,49);
  assert.deepEqual([review.nativeWidth,review.nativeHeight],[poster.width,poster.height]);
  for(const field of ['titlesCentered','spellingChecked','timesChecked','iconsApproved','styleMatched','gridFillsPage'])assert.equal(review[field],true);
  assert.deepEqual(review.remainingIssues,[]);

  const expected=[];
  for(const bell of config.bellSchedule){
    const rows=config.scheduleRows.filter(row=>row.day===page.label&&row.lesson===bell.lesson);
    assert.equal(rows.length,1);
    assert.equal(rows[0].classes.length,7);
    for(const [classIndex,className] of config.classes.entries()){
      assert.equal(typeof rows[0].classes[classIndex],'string');
      expected.push({className,lesson:bell.lesson,start:bell.start,end:bell.end,value:rows[0].classes[classIndex]});
    }
  }
  assert.equal(poster.cellCount,49);
  assert.equal(poster.cells.length,49);
  assert.deepEqual(poster.cells,expected,`Stale or incomplete cells: ${page.dayId}`);
  assert.equal(poster.filledCount,expected.filter(cell=>cell.value).length);
}
console.log('5 full ImageGen PNGs, WebP previews, prompts and visual-review records verified against the unchanged schedule (245 cells). No OCR was performed.');
