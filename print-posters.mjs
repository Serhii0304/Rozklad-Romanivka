import {classIndex,classGrade} from './time-core.mjs';
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function posterForClass(config,grade){
  const index=classIndex(config,grade);
  if(index<0)return null;
  const id=classGrade(config,index);
  if(!/^(?:[5-9]|10|11)$/.test(id))return null;
  return {grade:id,label:config.classes[index],imagePath:'assets/print/class-'+id+'-week.png',pdfPath:'assets/print/class-'+id+'-week.pdf',previewPath:'assets/print/class-'+id+'-preview.webp',printImagePath:'assets/print-ready/class-'+id+'-week.png',printPreviewPath:'assets/print-ready/class-'+id+'-week-preview.webp',pagePath:'print.html?class='+encodeURIComponent(id),downloadName:'Романівський ліцей ім. М. Т. Рильського — '+config.classes[index]+' — розклад 2026-2027.png'};
}

export function posterPrintMarkup(poster){
  const alt=poster.kind==='bells'?'Розклад дзвінків Романівського ліцею ім. М. Т. Рильського, І семестр 2026–2027':poster.kind==='school-week'?poster.label+' — загальний розклад 5–11 класів Романівського ліцею ім. М. Т. Рильського, І семестр 2026–2027':poster.label+' — тижневий розклад уроків Романівського ліцею ім. М. Т. Рильського, І семестр 2026–2027';
  return '<section class="print-page poster-print-page'+(poster.kind==='bells'?' bells-print-page':poster.kind==='school-week'?' general-week-print-page':'')+'"><div class="print-sheet poster-print-sheet"><img class="class-print-poster" src="'+escapeHtml(poster.imagePath)+'?v=20261006-romanivka" alt="'+escapeHtml(alt)+'"></div></section>';
}
