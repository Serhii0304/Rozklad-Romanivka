import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {posterForClass,posterPrintMarkup} from '../print-posters.mjs';
import {printPagesMarkup} from '../print-layout.mjs';
const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const C=box.window.SchoolScheduleConfig;

test('Every class resolves to its own weekly PNG and print preview',()=>{
 const paths=new Set();
 for(const label of C.classes){
  const poster=posterForClass(C,label);
  assert.ok(poster,label);
  assert.equal(posterForClass(C,poster.grade).imagePath,poster.imagePath);
  assert.ok(poster.imagePath.endsWith('class-'+poster.grade+'-week.png'));
  assert.ok(poster.pagePath.endsWith('class='+poster.grade));
  paths.add(poster.imagePath);
 }
 assert.equal(paths.size,7);
 for(const invalid of ['all','4','12','../../image',''])assert.equal(posterForClass(C,invalid),null);
});

test('Class printing uses one full-resolution poster while ordinary day printing keeps its table',()=>{
 const poster=posterForClass(C,'6');
 const html=printPagesMarkup([{title:'6 клас',poster}]);
 assert.equal(html,posterPrintMarkup(poster));
 assert.equal((html.match(/<img /g)||[]).length,1);
  assert.doesNotMatch(html,/3508|2480/);
 assert.ok(html.includes('class-6-week.png'));
 assert.ok(!html.includes('<table'));
 const day=printPagesMarkup([{title:'Понеділок',content:'<table><tr><td>Математика</td></tr></table>'}]);
 assert.ok(day.includes('<table>'));
 assert.ok(!day.includes('poster-print-page'));
});
