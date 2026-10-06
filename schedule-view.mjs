import {subjectCellMarkup} from './lesson-content.mjs';
import {classIndex} from './time-core.mjs';
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function classWeekMarkup(config,grade,today=-1){
  const index=classIndex(config,grade);
  if(index<0)throw new Error('Unknown class: '+grade);
  const label=escapeHtml(config.classes[index]);
  const days=config.dayOrder,bells=config.bellSchedule;
  return '<div class="table-wrap class-week-wrap" tabindex="0" role="region" aria-label="Тижневий розклад: '+label+'. Таблицю можна гортати вбік."><table class="schedule-table week-matrix"><caption class="sr-only">'+label+' · Навчальний тиждень · І семестр 2026–2027</caption><thead><tr><th scope="col">Урок / час</th>'+days.map((d,i)=>'<th scope="col" data-day-head="'+i+'" class="'+(i===today?'is-today':'')+'">'+'<button type="button" class="weekday-column-button" data-day="'+i+'" data-weekday="'+i+'" data-focus-day aria-label="'+escapeHtml(d.label)+' — розклад дня">'+escapeHtml(d.label)+(i===today?'<small class="day-button-status">СЬОГОДНІ</small>':'')+'</button></th>').join('')+'</tr></thead><tbody>'+bells.map(b=>'<tr data-week-row="'+b.lesson+'"><th scope="row"><span class="lesson-number">'+b.lesson+'</span><span class="lesson-time"><span class="time-start">'+b.start+'</span><span class="time-separator">–</span><span class="time-end">'+b.end+'</span></span><span class="row-state"></span></th>'+days.map((d,i)=>{
    const name=config.scheduleRows.find(r=>r.day===d.label&&r.lesson===b.lesson)?.classes[index]||'';
    return '<td data-cell-day="'+i+'" data-cell-lesson="'+b.lesson+'">'+subjectCellMarkup(config,name,'week-subject')+'</td>';
  }).join('')+'</tr>').join('')+'</tbody></table></div>';
}
