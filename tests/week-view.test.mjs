import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {classWeekMarkup} from '../schedule-view.mjs';
import {subjectsInLesson} from '../lesson-content.mjs';
import {printPagesMarkup} from '../print-layout.mjs';
const box={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const config=box.window.SchoolScheduleConfig;

test('Every configured class gets all seven slots across five weekdays, including empty cells',()=>{
  for(const [index,label] of config.classes.entries()){
    const html=classWeekMarkup(config,label,0);
    const occupied=config.scheduleRows.filter(row=>row.classes[index]).length;
    const subjects=config.scheduleRows.flatMap(row=>subjectsInLesson(row.classes[index])).length;
    assert.equal((html.match(/data-week-row=/g)||[]).length,7,label);
    assert.equal((html.match(/data-cell-day=/g)||[]).length,35,label);
    assert.equal((html.match(/data-subject=/g)||[]).length,subjects,label);
    assert.equal((html.match(/Уроку немає/g)||[]).length,35-occupied,label);
    assert.equal((html.match(/scope="col"/g)||[]).length,6);
    assert.equal((html.match(/СЬОГОДНІ/g)||[]).length,1);
  }
});

test('10th and 11th class IDs and labels open their own columns even when classes are reordered',()=>{
  const sample={...config,classes:['11 клас','5 клас','10 клас'],scheduleRows:[
    {day:'Понеділок',lesson:1,classes:['Астрономія','Математика','Геометрія']}
  ]};
  for(const [grade,subject,other] of [['10','Геометрія','Астрономія'],['11','Астрономія','Геометрія']]){
    const html=classWeekMarkup(sample,grade);
    assert.match(html,new RegExp(grade+' клас · Навчальний тиждень'));
    assert.ok(html.includes('data-subject="'+subject+'"'));
    assert.ok(!html.includes('data-subject="'+other+'"'));
    assert.equal(html,classWeekMarkup(sample,grade+' клас'));
  }
  assert.throws(()=>classWeekMarkup(sample,'9'),/Unknown class/);
});

test('Matrix escapes subjects and has no fake weekday today at weekends',()=>{
  const copy=structuredClone(config);
  copy.scheduleRows[0].classes[0]='<script>alert("x")</script>';
  const html=classWeekMarkup(copy,'5',-1);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('СЬОГОДНІ'));
});

test('Printed pages identify Romanivka and escape page titles',()=>{
  const html=printPagesMarkup([{title:'11 клас <тиждень>',content:'<table></table>'}]);
  assert.match(html,/Романівський ліцей ім. М. Т. Рильського/);
  assert.match(html,/Романівка · Розклад уроків і дзвінків/);
  assert.match(html,/11 клас &lt;тиждень&gt;/);
  assert.doesNotMatch(html,/Почуй/);
});
