import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pdfForPrintRequest,openPrintPdf} from '../print-files.mjs';
const box={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../schedule-config.js',import.meta.url),'utf8'),box);
const C=box.window.SchoolScheduleConfig;

test('Each class prints its own image-only PDF',()=>{
 for(const label of C.classes){const grade=label.split(' ')[0];assert.equal(pdfForPrintRequest(C,{grade,view:'week'}),`assets/print/class-${grade}-week.pdf`);}
});
test('The homepage week and individual days resolve to the correct PDF pages',()=>{
 assert.equal(pdfForPrintRequest(C),'assets/print-week/week-all-classes.pdf');
 C.dayOrder.forEach((day,index)=>{
  assert.equal(pdfForPrintRequest(C,{view:'day',day:index}),`assets/print-week/${day.id}.pdf`);
  assert.equal(pdfForPrintRequest(C,{printDay:index}),`assets/print-week/${day.id}.pdf`);
 });
});
test('Bells use their illustrated portrait PDF while single-class day tables keep ordinary printing',()=>{
 assert.equal(pdfForPrintRequest(C,{section:'bells'}),'assets/print-bells/bells-a4.pdf');
 assert.equal(pdfForPrintRequest(C,{grade:'6',view:'day'}),null);
});

test('PDF is delivered through a download link without popups or leaving the sound-enabled page',()=>{
 const previous=globalThis.document,calls=[];
 const link={click(){calls.push({href:this.href,download:this.download});},remove(){calls.push('removed');}};
 try{
  globalThis.document={createElement:tag=>{assert.equal(tag,'a');return link;},body:{append:item=>assert.equal(item,link)}};
  openPrintPdf('assets/print/class-10-week.pdf');
  assert.deepEqual(calls,[{href:'assets/print/class-10-week.pdf?v=20261006-romanivka',download:'class-10-week.pdf'},'removed']);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
