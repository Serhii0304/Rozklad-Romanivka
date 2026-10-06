import {wholeWeekPosters,weekPosterForDay,wholeWeekPdfPath} from './week-posters.mjs?v=20261006-romanivka';
import {openPrintPdf} from './print-files.mjs?v=20261006-romanivka';
const C=window.SchoolScheduleConfig;
const pages=wholeWeekPosters(C);
const selected=weekPosterForDay(C,new URLSearchParams(location.search).get('day'));
const $=selector=>document.querySelector(selector);
const sheets=new Map();
let loaded=0,failed=0;
function updateStatus(){
 $('#week-print-status').textContent=failed?'Не всі зображення завантажилися. Оновіть сторінку.':loaded===pages.length?'Усі 5 сторінок готові до друку':'Підготовлено '+loaded+' із '+pages.length+' зображень…';
 $('#print-whole-week').disabled=loaded!==pages.length;
}
function printPages(dayId=null){
 openPrintPdf(dayId===null?wholeWeekPdfPath:weekPosterForDay(C,dayId).pdfPath);
}
for(const [index,page] of pages.entries()){
 const nav=document.createElement('a');nav.href='#day-'+page.dayId;nav.textContent=page.label;
 if(selected?.dayId===page.dayId)nav.setAttribute('aria-current','location');
 nav.addEventListener('click',()=>{$('#week-day-links').querySelectorAll('a').forEach(a=>a.removeAttribute('aria-current'));nav.setAttribute('aria-current','location');});
 $('#week-day-links').append(nav);
 const article=document.createElement('article');article.className='week-poster-preview';article.id='day-'+page.dayId;
 const heading=document.createElement('h2');heading.textContent=page.label+' · 5–11 класи';article.append(heading);
 const figure=document.createElement('figure');figure.className='poster-frame';
 const preview=document.createElement('img');preview.src=page.printPreviewPath+'?v=20261006-romanivka';preview.alt='Загальний розклад: '+page.label+', усі 5–11 класи';preview.width=1400;preview.height=990;preview.loading=index?'lazy':'eager';figure.append(preview);
 const actions=document.createElement('figcaption');actions.className='week-page-actions';
 const printButton=document.createElement('button');printButton.type='button';printButton.textContent='Друкувати цей день';printButton.disabled=true;printButton.addEventListener('click',()=>printPages(page.dayId));
 const download=document.createElement('a');download.href=page.printImagePath+'?v=20261006-romanivka';download.download=page.downloadName;download.textContent='Зберегти PNG';
 const resolution=document.createElement('span');resolution.textContent='A4 · альбомний аркуш';
 actions.append(printButton,download,resolution);figure.append(actions);article.append(figure);$('#week-previews').append(article);
 const sheet=document.createElement('section');sheet.className='week-print-sheet';sheet.dataset.day=page.dayId;
 const original=document.createElement('img');original.alt=preview.alt;
 original.addEventListener('load',()=>{loaded++;printButton.disabled=false;resolution.textContent='A4 · поля 5 мм';updateStatus();});
 original.addEventListener('error',()=>{failed++;updateStatus();});
 original.src=page.imagePath+'?v=20261006-romanivka';sheet.append(original);$('#week-print-area').append(sheet);sheets.set(page.dayId,{sheet,original});
}
$('#print-whole-week').addEventListener('click',()=>printPages());
window.addEventListener('afterprint',()=>{for(const {sheet} of sheets.values())sheet.hidden=false;});
if(selected)requestAnimationFrame(()=>$('#day-'+selected.dayId)?.scrollIntoView({block:'start'}));
