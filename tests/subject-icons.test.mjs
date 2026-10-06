import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {classWeekMarkup} from '../schedule-view.mjs';
import {subjectIconMarkup} from '../subject-icons.mjs';
import {subjectsInLesson,subjectCellMarkup} from '../lesson-content.mjs';
const root=new URL('../',import.meta.url),box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('schedule-config.js',root),'utf8'),box);
const config=box.window.SchoolScheduleConfig;
test('Every canonical subject has distinct portable SVG artwork shipped locally',()=>{
 const names=Object.keys(config.subjectIcons),paths=new Set(),hashes=new Set();
 const usedSubjects=new Set(config.scheduleRows.flatMap(r=>r.classes).flatMap(subjectsInLesson));
 assert.equal(usedSubjects.size,names.length);
 for(const used of usedSubjects)assert.ok(subjectIconMarkup(config,used),used);
 for(const name of names){
  const asset=/src="([^"]+)"/.exec(subjectIconMarkup(config,name))?.[1];assert.ok(asset,'Missing icon: '+name);
  const svg=fs.readFileSync(new URL(asset,root),'utf8');
  assert.match(svg,/viewBox="0 0 64 64"/);assert.match(svg,/<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.doesNotMatch(svg,/<(?:script|text|foreignObject|image|filter)\b|(?:href|onload)=/);
  paths.add(asset);hashes.add(createHash('sha256').update(svg).digest('hex'));
 }
 assert.equal(paths.size,names.length);assert.equal(hashes.size,names.length);
 for(const grade of config.classes){
  const html=classWeekMarkup(config,grade);
  assert.equal((html.match(/class="subject-icon"/g)||[]).length,(html.match(/data-subject=/g)||[]).length);
 }
});
test('Unknown subjects and unsafe asset paths do not inject markup',()=>{
 assert.equal(subjectIconMarkup(config,'Unknown'),'');
 assert.equal(subjectIconMarkup({subjectIcons:{Bad:'https://example.test/a.svg'}},'Bad'),'');
 assert.equal(subjectIconMarkup({subjectIcons:{Bad:'assets/subjects/a.svg" onerror="x'}},'Bad'),'');
 const aliases={subjectIcons:{"Здоров'я":'assets/subjects/health.svg'}};
 assert.equal(subjectIconMarkup(aliases,'Здоров’я'),subjectIconMarkup(aliases,"Здоров'я"));
});
test('Combined subjects remain one lesson cell with separate subject controls and original subgroup labels',()=>{
 const value='Інформатика / Технології (2 підгрупа)',html=subjectCellMarkup(config,value,'week-subject');
 assert.deepEqual(subjectsInLesson(value),['Інформатика','Технології']);
 assert.equal((html.match(/data-subject=/g)||[]).length,2);
 assert.equal((html.match(/class="subject-icon"/g)||[]).length,2);
 assert.match(html,/>\(2 підгрупа\)</);
 assert.match(html,/subject-divider/);
 assert.deepEqual(subjectsInLesson('Фізика (астрономія)'),['Фізика (астрономія)']);
});
