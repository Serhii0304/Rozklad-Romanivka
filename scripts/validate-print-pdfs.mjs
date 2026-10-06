import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {posterForClass} from '../print-posters.mjs';
import {wholeWeekPosters,wholeWeekPdfPath} from '../week-posters.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const box={window:{}};vm.runInNewContext(read('schedule-config.js').toString('utf8'),box,{timeout:1000});
const C=JSON.parse(JSON.stringify(box.window.SchoolScheduleConfig));
const expected=new Map();
for(const label of C.classes){const p=posterForClass(C,label);expected.set(p.pdfPath,{type:'class',sources:[p.imagePath]});}
const week=wholeWeekPosters(C);
for(const p of week)expected.set(p.pdfPath,{type:'day',sources:[p.imagePath]});
expected.set(wholeWeekPdfPath,{type:'week',sources:week.map(p=>p.imagePath)});
const manifest=JSON.parse(read('assets/print-pdfs.json'));
assert.equal(manifest.schemaVersion,2);assert.equal(manifest.generationMethod,'reportlab-image-only');
assert.equal(manifest.safetyMarginMm,5);
assert.equal(manifest.originalsUnmodified,true);assert.deepEqual(manifest.pageSizeMm,[297,210]);
assert.equal(manifest.pdfCount,13);assert.equal(manifest.documents.length,13);assert.equal(manifest.imagePageCount,17);
const seen=new Set();let pageCount=0;
for(const document of manifest.documents){
 const item=expected.get(document.path);assert.ok(item,'Unexpected PDF '+document.path);
 assert.ok(!seen.has(document.path));seen.add(document.path);
 assert.equal(document.type,item.type);assert.equal(document.pageCount,item.sources.length);pageCount+=document.pageCount;
 assert.deepEqual(document.sources.map(s=>s.path),item.sources);
 assert.ok(Math.abs(document.pageSizePt[0]-841.8897637795277)<.001&&Math.abs(document.pageSizePt[1]-595.2755905511812)<.001);
 for(const field of ['singleImagePerPage','withinPrintableArea','uncroppedImage','noText','noAnnotations'])assert.equal(document.validation[field],true);
 assert.equal(document.placementsPt.length,item.sources.length);
 document.placementsPt.forEach(({x,y,width,height},index)=>{
  const [pageWidth,pageHeight]=document.pageSizePt,margin=manifest.safetyMarginMm*72/25.4;
  const source=document.sources[index],scale=Math.min((pageWidth-2*margin)/source.width,(pageHeight-2*margin)/source.height);
  assert.ok([x,y,width,height].every(Number.isFinite));
  assert.ok(x>=margin-.001&&y>=margin-.001&&x+width<=pageWidth-margin+.001&&y+height<=pageHeight-margin+.001,'Unsafe print margin: '+document.path);
  assert.ok(Math.abs(width-source.width*scale)<.001&&Math.abs(height-source.height*scale)<.001,'Image proportions changed: '+document.path);
  assert.ok(Math.abs(x-(pageWidth-width)/2)<.001&&Math.abs(y-(pageHeight-height)/2)<.001,'Image is not centered: '+document.path);
 });
 const pdf=read(document.path);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal(hash(pdf),document.sha256,'Changed PDF: '+document.path);
 for(const source of document.sources){const png=read(source.path);assert.equal(hash(png),source.sha256,'Regenerate PDFs after changing '+source.path);assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[source.width,source.height]);}
}
assert.equal(seen.size,expected.size);assert.equal(pageCount,17);
console.log('13 verified image-only A4 PDFs: 17 centered, uncropped images with minimum 5 mm print margins.');
