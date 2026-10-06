import {hhmmSeconds,durationLabel} from './time-core.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hours=(start,end,className)=>'<span class="'+className+'"><time datetime="'+esc(start)+'">'+esc(start)+'</time><span aria-hidden="true">–</span><time datetime="'+esc(end)+'">'+esc(end)+'</time></span>';

export function bellsMarkup(config){
 return config.bellSchedule.map((bell,index,all)=>{
  const lesson='<div class="bell-row" data-bell="'+esc(bell.lesson)+'"><span class="bell-number">'+esc(bell.lesson)+'</span><span class="bell-name">'+esc(bell.lesson)+'-й урок<small class="bell-state"></small></span>'+hours(bell.start,bell.end,'bell-hours')+'</div>';
  const next=all[index+1];
  if(!next)return lesson;
  const duration=(hhmmSeconds(next.start)-hhmmSeconds(bell.end))/60;
  return lesson+'<div class="bell-break'+(duration>=20?' large':'')+'" data-break="'+esc(bell.lesson)+'" aria-label="Перерва після '+esc(bell.lesson)+'-го уроку"><span class="break-name">'+(duration>=20?'Велика перерва':'Перерва')+'</span>'+hours(bell.end,next.start,'break-hours')+'<span class="break-duration">'+duration+' хв</span><small class="break-state"></small></div>';
 }).join('');
}

export function updateBellHighlights(root,state){
 for(const row of root.querySelectorAll('[data-bell],[data-break]')){
  const lesson=row.hasAttribute('data-bell');
  const active=lesson?state.kind==='lesson'&&Number(row.dataset.bell)===state.lesson:state.kind==='break'&&Number(row.dataset.break)===state.nextLesson-1;
  row.classList.toggle('is-current',active);
  if(active){if(row.getAttribute('aria-current')!=='time')row.setAttribute('aria-current','time');}
  else if(row.hasAttribute('aria-current'))row.removeAttribute('aria-current');
  const label=row.querySelector(lesson?'.bell-state':'.break-state');
  const content=active?(lesson?'До кінця: ':'Залишилося ')+durationLabel(state.remaining):'';
  if(label.textContent!==content)label.textContent=content;
 }
}
