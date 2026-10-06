import test from 'node:test';
import assert from 'node:assert/strict';
import {subjectCellMarkup,subjectsInLesson} from '../lesson-content.mjs';

test('A repeated subject in one lesson renders one name and one filter target',()=>{
  const value='Українська мова / українська   мова / Українська мова';
  const html=subjectCellMarkup({},value);
  assert.deepEqual(subjectsInLesson(value),['Українська мова']);
  assert.equal((html.match(/data-subject=/g)||[]).length,1);
  assert.equal((html.match(/class="subject-name"/g)||[]).length,1);
  assert.ok(!html.includes('subject-divider'));
});

test('Merging a subject retains its subgroup labels and other distinct subjects',()=>{
  const value='Українська мова (1 підгрупа) / Українська мова (2 підгрупа) / Англійська мова';
  const html=subjectCellMarkup({},value);
  assert.deepEqual(subjectsInLesson(value),['Українська мова','Англійська мова']);
  assert.equal((html.match(/data-subject=/g)||[]).length,2);
  assert.ok(html.includes('(1 підгрупа)'));
  assert.ok(html.includes('(2 підгрупа)'));
  assert.deepEqual(subjectsInLesson('Фізика / Фізика (астрономія)'),['Фізика','Фізика (астрономія)']);
});


test('Romanivka group labels retain their source wording with one canonical informatics subject',()=>{
  const value='Інформатика (1 група) / Інформатика (2 група)';
  const html=subjectCellMarkup({subjectIcons:{'Інформатика':'assets/subjects/informatics.svg'}},value);
  assert.deepEqual(subjectsInLesson(value),['Інформатика']);
  assert.equal((html.match(/data-subject=/g)||[]).length,1);
  assert.equal((html.match(/class="subject-icon"/g)||[]).length,1);
  assert.ok(html.includes('(1 група) · (2 група)'));
  assert.deepEqual(subjectsInLesson('Інформатика (1 група)'),['Інформатика']);
  assert.deepEqual(subjectsInLesson('Інформатика (2 група)'),['Інформатика']);
});
