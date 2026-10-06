import {posterForClass} from './print-posters.mjs?v=20261006-romanivka';
import {openPrintPdf} from './print-files.mjs?v=20261006-romanivka';
const C=window.SchoolScheduleConfig;
const $=selector=>document.querySelector(selector);
const requested=new URLSearchParams(location.search).get('class');
const poster=posterForClass(C,requested)||posterForClass(C,C.classes[0]);
document.title=poster.label+' · Розклад для друку · Романівський ліцей ім. М. Т. Рильського';
$('#poster-title').textContent=poster.label+' · Розклад для друку';
$('#schedule-link').href='class.html?class='+encodeURIComponent(poster.label)+'&view=week#schedule';
for(const label of C.classes){
  const item=posterForClass(C,label);
  if(!item)continue;
  const link=document.createElement('a');
  link.href=item.pagePath;link.textContent=item.label;
  if(item.grade===poster.grade)link.setAttribute('aria-current','page');
  $('#poster-classes').append(link);
}
$('#download-poster').href=poster.printImagePath+'?v=20261006-romanivka';
$('#download-poster').download=poster.downloadName;
$('#poster-preview').alt=poster.label+' — повний тижневий розклад з уроками, підгрупами й дзвінками';
$('#poster-preview').src=poster.printPreviewPath+'?v=20261006-romanivka';
const original=$('#poster-original');
original.alt=$('#poster-preview').alt;
original.addEventListener('load',()=>{ $('#print-poster').disabled=false;$('#poster-status').textContent=''; });
original.addEventListener('error',()=>{ $('#poster-status').textContent='Не вдалося завантажити зображення. Оновіть сторінку.'; });
original.src=poster.imagePath+'?v=20261006-romanivka';
$('#print-poster').addEventListener('click',()=>openPrintPdf(poster.pdfPath));
