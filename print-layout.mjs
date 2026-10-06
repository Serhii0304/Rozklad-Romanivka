import {posterPrintMarkup} from './print-posters.mjs?v=20261006-romanivka';
export function printPagesMarkup(pages){
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return pages.map((page,i)=>page.poster?posterPrintMarkup(page.poster):'<section class="print-page"><div class="print-sheet"><header class="print-heading"><div><p class="print-school">Романівський ліцей ім. М. Т. Рильського</p><h1>'+esc(page.title)+'</h1><p class="print-term">І семестр · 2026–2027 навчальний рік</p></div><img src="assets/ui/'+(page.bells?'school-bell-refined.png':'school-building.png')+'" alt="" width="90" height="90"></header>'+page.content+'<div class="print-footer"><span>Романівка · Розклад уроків і дзвінків</span><span>'+String(i+1)+' / '+String(pages.length)+'</span></div></div></section>').join('');
}
export function fitPrintPages(stage){
 stage.classList.add('print-measure');
 stage.querySelectorAll('.print-page').forEach(page=>{
  const sheet=page.querySelector('.print-sheet');sheet.style.setProperty('--print-scale','1');
  if(page.classList.contains('poster-print-page'))return;
  const scale=Math.min(1,(page.clientHeight-2)/Math.max(1,sheet.scrollHeight));
  sheet.style.setProperty('--print-scale',String(scale));
 });
 stage.classList.remove('print-measure');
}
export async function settlePrintAssets(stage){
 if(document.fonts)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1800))]);
 await Promise.all([...stage.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})));
}
